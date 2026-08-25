import { prisma } from "./prisma";
import { AUTHOR } from "./author";

export async function checkAndNotifyInstall() {
  try {
    const notified = await prisma.siteSetting.findUnique({
      where: { key: "install_notified" },
    });

    if (notified?.value === true) return;

    // Get super admin email
    const admin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
      select: { email: true, name: true },
    });

    if (!admin?.email) return;

    // Send notification to author via Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const authorChatId = process.env.TELEGRAM_AUTHOR_CHAT_ID;

    if (botToken && authorChatId) {
      const message = [
        `🆕 *Новая установка ${AUTHOR.name}*`,
        ``,
        `📧 Admin: ${admin.email}`,
        `👤 Name: ${admin.name || "N/A"}`,
        `🌐 URL: ${process.env.NEXT_PUBLIC_SITE_URL || "unknown"}`,
        `📅 Date: ${new Date().toLocaleDateString("ru-RU")}`,
        `📦 Version: ${AUTHOR.version}`,
      ].join("\n");

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: authorChatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }).catch(() => {});
    }

    // Mark as notified
    await prisma.siteSetting.upsert({
      where: { key: "install_notified" },
      update: { value: true },
      create: { key: "install_notified", value: true },
    });
  } catch {
    // Silent fail - don't break the app
  }
}

export async function notifyAdminChange(oldEmail: string, newEmail: string, action: string) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const authorChatId = process.env.TELEGRAM_AUTHOR_CHAT_ID;

    if (!botToken || !authorChatId) return;

    const message = [
      `⚠️ *Попытка изменения супер-админа*`,
      ``,
      `📧 Было: ${oldEmail}`,
      `📧 Стало: ${newEmail}`,
      `🔧 Действие: ${action}`,
      `🌐 URL: ${process.env.NEXT_PUBLIC_SITE_URL || "unknown"}`,
      `📅 Date: ${new Date().toLocaleDateString("ru-RU")}`,
    ].join("\n");

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: authorChatId,
        text: message,
        parse_mode: "Markdown",
      }),
    }).catch(() => {});
  } catch {
    // Silent fail
  }
}
