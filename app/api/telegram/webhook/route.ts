import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendTelegramMessage,
  answerCallbackQuery,
  notifyModeration,
  notifyPublished,
} from "@/lib/telegram";
import {
  s3Configured,
  uploadToS3,
  generateFileKey,
} from "@/lib/s3";

const BOT_SECRET = process.env.TELEGRAM_BOT_SECRET;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: { id: number };
    text?: string;
    photo?: Array<{ file_id: string; file_size: number }>;
    caption?: string;
  };
  callback_query?: {
    id: string;
    data: string;
    message?: {
      chat: { id: number };
    };
  };
}

export async function POST(request: NextRequest) {
  // Require secret token if configured
  if (!BOT_SECRET) {
    return NextResponse.json({ error: "Bot secret not configured" }, { status: 500 });
  }

  const secretToken = request.headers.get("x-telegram-bot-api-secret-token");
  if (secretToken !== BOT_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  const update: TelegramUpdate = await request.json();

  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return NextResponse.json({ ok: true });
    }

    if (update.message) {
      await handleMessage(update.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

// ==================== MESSAGE HANDLER ====================

async function handleMessage(message: TelegramUpdate["message"] & {}) {
  const { from, chat, text, photo, caption } = message;
  const telegramId = String(from.id);
  const chatId = chat.id;

  // Find or create user
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        telegramName: from.username || from.first_name,
        name: from.first_name,
        role: "USER",
      },
    });
  }

  const content = text || caption || "";

  // Handle commands
  if (content.startsWith("/")) {
    await handleCommand(chatId, user, content, photo);
    return;
  }

  // Regular message → create post
  if (!content && (!photo || photo.length === 0)) {
    await sendTelegramMessage(chatId, "Отправьте текст или фото для создания публикации.");
    return;
  }

  await createPost(chatId, user, content, photo, "NEWS");
}

// ==================== COMMAND HANDLER ====================

async function handleCommand(
  chatId: number,
  user: { id: string; telegramId: string | null; name: string | null; role: string },
  text: string,
  photo?: Array<{ file_id: string; file_size: number }>
) {
  const [cmd, ...args] = text.split(" ");
  const command = cmd.toLowerCase();

  switch (command) {
    case "/start":
      await sendTelegramMessage(
        chatId,
        `Привет! Я бот для публикации новостей.\n\n` +
          `📝 <b>Отправьте текст</b> — создам публикацию\n` +
          `📸 <b>Отправьте фото</b> — станет обложкой\n` +
          `#️⃣ <b>Хештеги</b> — автоматически станут тегами\n\n` +
          `<b>Команды:</b>\n` +
          `/my — мои публикации\n` +
          `/stats — статистика\n` +
          `/delete [id] — удалить публикацию\n` +
          `/status [id] — статус публикации\n` +
          `/help — помощь`
      );
      break;

    case "/help":
      await sendTelegramMessage(
        chatId,
        `<b>Как создать публикацию:</b>\n` +
          `1. Отправьте текст (или фото с подписью)\n` +
          `2. Добавьте хештеги: #ремонт #объект\n` +
          `3. Пост уйдёт на модерацию\n\n` +
          `<b>Хештеги:</b>\n` +
          `#портфолио — добавить в портфолио\n` +
          `Любые другие #хештеги — автоматические теги\n\n` +
          `<b>Команды:</b>\n` +
          `/my — мои публикации\n` +
          `/stats — статистика\n` +
          `/delete [id] — удалить\n` +
          `/status [id] — статус`
      );
      break;

    case "/my":
      await handleMyPosts(chatId, user);
      break;

    case "/stats":
      await handleStats(chatId);
      break;

    case "/delete":
      await handleDelete(chatId, args[0]);
      break;

    case "/status":
      await handleStatus(chatId, args[0]);
      break;

    default:
      await sendTelegramMessage(chatId, "Неизвестная команда. Отправьте /help для списка команд.");
  }
}

// ==================== COMMAND IMPLEMENTATIONS ====================

async function handleMyPosts(chatId: number, user: { id: string }) {
  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, title: true, status: true, type: true, createdAt: true },
  });

  if (posts.length === 0) {
    await sendTelegramMessage(chatId, "У вас пока нет публикаций.");
    return;
  }

  const statusLabels: Record<string, string> = {
    DRAFT: "📝 Черновик",
    PENDING: "⏳ На модерации",
    PUBLISHED: "✅ Опубликовано",
    ARCHIVED: "📦 В архиве",
  };

  const list = posts
    .map(
      (p, i) =>
        `${i + 1}. ${statusLabels[p.status] || p.status} <b>${p.title.slice(0, 40)}</b>\n` +
        `   ID: <code>${p.id.slice(0, 8)}</code> | ${new Date(p.createdAt).toLocaleDateString("ru-RU")}`
    )
    .join("\n\n");

  await sendTelegramMessage(chatId, `<b>Ваши публикации:</b>\n\n${list}`);
}

async function handleStats(chatId: number) {
  const [total, pending, published, draft] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { status: "PENDING" } }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.post.count({ where: { status: "DRAFT" } }),
  ]);

  const users = await prisma.user.count();
  const tags = await prisma.tag.count();

  await sendTelegramMessage(
    chatId,
    `<b>📊 Статистика:</b>\n\n` +
      `Публикации: ${total}\n` +
      `  ✅ Опубликовано: ${published}\n` +
      `  ⏳ На модерации: ${pending}\n` +
      `  📝 Черновиков: ${draft}\n\n` +
      `Пользователи: ${users}\n` +
      `Теги: ${tags}`
  );
}

async function handleDelete(chatId: number, postIdArg: string | undefined) {
  if (!postIdArg) {
    await sendTelegramMessage(chatId, "Укажите ID: /delete [id]\nID можно посмотреть в /my");
    return;
  }

  // Find post by partial ID match
  const post = await prisma.post.findFirst({
    where: {
      id: { startsWith: postIdArg },
      authorId: (await prisma.user.findFirst({ where: { telegramId: String(chatId) } }))?.id || "",
    },
  });

  if (!post) {
    await sendTelegramMessage(chatId, "Публикация не найдена или не принадлежит вам.");
    return;
  }

  // Only allow deleting DRAFT or PENDING posts
  if (post.status === "PUBLISHED") {
    await sendTelegramMessage(chatId, "Нельзя удалить опубликованную публикацию. Используйте архивацию в админке.");
    return;
  }

  await prisma.post.delete({ where: { id: post.id } });
  await sendTelegramMessage(chatId, `🗑 Публикация "${post.title}" удалена.`);
}

async function handleStatus(chatId: number, postIdArg: string | undefined) {
  if (!postIdArg) {
    await sendTelegramMessage(chatId, "Укажите ID: /status [id]\nID можно посмотреть в /my");
    return;
  }

  const post = await prisma.post.findFirst({
    where: {
      id: { startsWith: postIdArg },
    },
    select: { id: true, title: true, status: true, type: true, publishedAt: true, createdAt: true },
  });

  if (!post) {
    await sendTelegramMessage(chatId, "Публикация не найдена.");
    return;
  }

  const statusLabels: Record<string, string> = {
    DRAFT: "📝 Черновик",
    PENDING: "⏳ На модерации",
    PUBLISHED: "✅ Опубликовано",
    ARCHIVED: "📦 В архиве",
  };

  await sendTelegramMessage(
    chatId,
    `<b>${post.title}</b>\n\n` +
      `Статус: ${statusLabels[post.status] || post.status}\n` +
      `Тип: ${post.type}\n` +
      `Создано: ${new Date(post.createdAt).toLocaleDateString("ru-RU")}` +
      (post.publishedAt ? `\nОпубликовано: ${new Date(post.publishedAt).toLocaleDateString("ru-RU")}` : "")
  );
}

// ==================== POST CREATION ====================

async function createPost(
  chatId: number,
  user: { id: string; name: string | null },
  content: string,
  photo?: Array<{ file_id: string; file_size: number }>,
  type: string = "NEWS"
) {
  // Extract hashtags (except #портфолио)
  const hashtagRegex = /#(\S+)/g;
  const tagNames: string[] = [];
  let match;
  while ((match = hashtagRegex.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    if (!["портфолио", "featured"].includes(tag)) {
      tagNames.push(match[1]);
    }
  }

  // Check for #портфолио
  const isFeatured = /#(портфолио|featured)/i.test(content);

  // Generate title
  const title =
    content.replace(/#\S+/g, "").trim().slice(0, 100).split("\n")[0] ||
    (photo ? "Фото из Telegram" : "Публикация из Telegram");

  // Generate unique slug
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-|-$/g, "");
  let slugCounter = 0;
  let candidateSlug = slug;
  while (await prisma.post.findUnique({ where: { slug: candidateSlug } })) {
    slugCounter++;
    candidateSlug = `${slug}-${slugCounter}`;
  }

  // Generate excerpt
  const excerpt = content
    ? content.replace(/#\S+/g, "").trim().slice(0, 150) + (content.length > 150 ? "..." : "")
    : null;

  // Create tags
  const tagConnections = [];
  for (const tagName of tagNames) {
    const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-");
    const tag = await prisma.tag.upsert({
      where: { slug: tagSlug },
      update: {},
      create: { name: tagName, slug: tagSlug },
    });
    tagConnections.push({ id: tag.id });
  }

  // Create post
  const post = await prisma.post.create({
    data: {
      title,
      slug: candidateSlug,
      content: content || null,
      excerpt,
      type: type as "NEWS" | "WORK" | "UPDATE" | "EVENT" | "PROMO",
      status: "PENDING",
      isFeatured,
      authorId: user.id,
      tags: tagConnections.length > 0 ? { connect: tagConnections } : undefined,
    },
    include: {
      author: { select: { name: true } },
      tags: { select: { name: true } },
    },
  });

  // Process photos
  if (photo && photo.length > 0) {
    const largestPhoto = photo.reduce((prev, curr) =>
      (curr.file_size || 0) > (prev.file_size || 0) ? curr : prev
    );

    try {
      const TELEGRAM_API = "https://api.telegram.org/bot";
      const token = process.env.TELEGRAM_BOT_TOKEN;

      // Get file info from Telegram
      const fileRes = await fetch(`${TELEGRAM_API}${token}/getFile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: largestPhoto.file_id }),
      });
      const fileData = await fileRes.json();

      if (!fileData.ok || !fileData.result?.file_path) {
        throw new Error(`getFile failed: ${fileData.description || "unknown"}`);
      }

      // Download the file
      const fileUrl = `${TELEGRAM_API}${token}/file/${fileData.result.file_path}`;
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      // Try S3 first, fallback to base64 data URL
      let coverImage: string;
      if (s3Configured) {
        const key = generateFileKey("telegram", `photo-${Date.now()}.jpg`);
        coverImage = await uploadToS3(key, imageBuffer, "image/jpeg");
      } else {
        // Store as base64 data URL (works everywhere, no filesystem needed)
        const base64 = imageBuffer.toString("base64");
        coverImage = `data:image/jpeg;base64,${base64}`;
      }

      await prisma.post.update({ where: { id: post.id }, data: { coverImage } });

      await prisma.media.create({
        data: {
          url: coverImage,
          type: "IMAGE",
          filename: `photo-${Date.now()}.jpg`,
          size: imageBuffer.length,
          postId: post.id,
        },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Post is created without photo — not a blocker
    }
  }

  // Notify admin
  await notifyModeration(post.id, post.title, post.author?.name || "Telegram");

  // Confirm to user
  const typeLabels: Record<string, string> = {
    NEWS: "Новость",
    WORK: "Работа",
    UPDATE: "Обновление",
    EVENT: "Событие",
    PROMO: "Акция",
  };

  await sendTelegramMessage(
    chatId,
    `✅ Публикация создана и отправлена на модерацию:\n\n` +
      `<b>${post.title}</b>\n` +
      `Тип: ${typeLabels[type] || type}\n` +
      (tagConnections.length > 0 ? `Теги: ${tagNames.join(", ")}\n` : "") +
      (isFeatured ? `⭐ В портфолио\n` : "") +
      `\nПосле одобрения она появится на сайте.`
  );
}

// ==================== CALLBACK QUERY HANDLER ====================

async function handleCallbackQuery(
  callbackQuery: TelegramUpdate["callback_query"] & {}
) {
  const { id: callbackId, data } = callbackQuery;

  if (!data) {
    await answerCallbackQuery(callbackId, "Неизвестная команда");
    return;
  }

  // Verify callback is from admin chat
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (callbackQuery.message && adminChatId && String(callbackQuery.message.chat.id) !== adminChatId) {
    await answerCallbackQuery(callbackId, "Не authorized");
    return;
  }

  const [action, postId] = data.split(":");

  if (action === "approve" && postId) {
    const post = await prisma.post.update({
      where: { id: postId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    await answerCallbackQuery(callbackId, "Публикация одобрена");

    if (callbackQuery.message) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
      await sendTelegramMessage(
        callbackQuery.message.chat.id,
        `✅ Публикация "${post.title}" опубликована`
      );
      await notifyPublished(post.title, `${siteUrl}/posts/${post.slug}`);
    }
  } else if (action === "reject" && postId) {
    await prisma.post.update({
      where: { id: postId },
      data: { status: "DRAFT" },
    });

    await answerCallbackQuery(callbackId, "Публикация отклонена");

    if (callbackQuery.message) {
      await sendTelegramMessage(
        callbackQuery.message.chat.id,
        `❌ Публикация отклонена и сохранена как черновик`
      );
    }
  }
}
