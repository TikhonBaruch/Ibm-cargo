const TELEGRAM_API = "https://api.telegram.org/bot";

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return token;
}

function api(method: string, body?: Record<string, unknown>) {
  return fetch(`${TELEGRAM_API}${getToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: Record<string, unknown>
) {
  return api("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
) {
  return api("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

export async function setWebhook(url: string) {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  return api("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
  });
}

export async function getWebhookInfo() {
  return api("getWebhookInfo");
}

export async function notifyModeration(
  postId: string,
  title: string,
  authorName: string
) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) return null;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Одобрить", callback_data: `approve:${postId}` },
        { text: "❌ Отклонить", callback_data: `reject:${postId}` },
      ],
    ],
  };

  return sendTelegramMessage(
    chatId,
    `<b>Новая публикация на модерации</b>\n\n` +
      `<b>${title}</b>\n` +
      `Автор: ${authorName}\n\n` +
      `Одобрите или отклоните публикацию:`,
    keyboard
  );
}

export async function notifyPublished(title: string, url: string) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) return null;

  return sendTelegramMessage(
    chatId,
    `<b>Публикация опубликована</b>\n\n` +
      `<b>${title}</b>\n` +
      `<a href="${url}">Открыть на сайте</a>`
  );
}

export async function notifyBooking(text: string, targetRole?: string) {
  const { prisma } = await import("./prisma");

  const role = targetRole || "manager";
  let recipients = await prisma.telegramRecipient.findMany({
    where: { isActive: true, role },
  });

  if (recipients.length === 0 && role !== "manager") {
    recipients = await prisma.telegramRecipient.findMany({
      where: { isActive: true, role: "manager" },
    });
  }

  if (recipients.length > 0) {
    for (const recipient of recipients) {
      sendTelegramMessage(recipient.chatId, text).catch(() => {});
    }
  } else {
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (chatId) {
      sendTelegramMessage(chatId, text).catch(() => {});
    }
  }
}
