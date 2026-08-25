"use client";

import { useEffect, useState } from "react";
import { Bot, Check, X, RefreshCw } from "lucide-react";

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_message?: string;
}

export default function TelegramPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchInfo() {
      setLoading(true);
      try {
        const res = await fetch("/api/telegram/setup", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setWebhookInfo(data.result || data);
        }
      } catch {
        // Ignore errors
      }
      if (!cancelled) setLoading(false);
    }
    fetchInfo();
    return () => { cancelled = true; };
  }, []);

  const fetchWebhookInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/setup", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setWebhookInfo(data.result || data);
      }
    } catch {
      // Ignore errors
    }
    setLoading(false);
  };

  const handleSetWebhook = async () => {
    if (!webhookUrl) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/telegram/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: webhookUrl }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage({ type: "success", text: "Webhook установлен успешно" });
        fetchWebhookInfo();
      } else {
        setMessage({ type: "error", text: data.description || "Ошибка" });
      }
    } catch {
      setMessage({ type: "error", text: "Ошибка сети" });
    }

    setLoading(false);
  };

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-slate-100">Telegram Bot</h1>

      {/* Webhook status */}
      <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Статус webhook</h2>
          <button
            onClick={fetchWebhookInfo}
            disabled={loading}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {webhookInfo ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {webhookInfo.url ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <X className="h-5 w-5 text-red-500" />
              )}
              <span className="text-sm text-slate-300">
                {webhookInfo.url || "Webhook не установлен"}
              </span>
            </div>
            {webhookInfo.url && (
              <div className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-400 break-all">
                {webhookInfo.url}
              </div>
            )}
            {webhookInfo.last_error_message && (
              <div className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">
                {webhookInfo.last_error_message}
              </div>
            )}
            <div className="text-xs text-slate-500">
              Ожидающих обновлений: {webhookInfo.pending_update_count}
            </div>
          </div>
        ) : (
          <div className="text-slate-400">Загрузка...</div>
        )}
      </div>

      {/* Set webhook */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">
          Установить webhook
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Укажите URL вашего приложения. Telegram будет отправлять обновления на этот адрес.
        </p>

        <div className="flex gap-3">
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-app.vercel.app/api/telegram/webhook"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-600 focus:outline-none"
          />
          <button
            onClick={handleSetWebhook}
            disabled={loading || !webhookUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Bot className="h-4 w-4" />
            Установить
          </button>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-xl px-4 py-2 text-sm ${
              message.type === "success"
                ? "bg-green-900/30 text-green-400"
                : "bg-red-900/30 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Как использовать</h2>
        <ol className="space-y-2 text-sm text-slate-400">
          <li>1. Создайте бота через @BotFather в Telegram</li>
          <li>2. Скопируйте токен в переменную окружения TELEGRAM_BOT_TOKEN</li>
          <li>3. Установите webhook, указав URL вашего приложения</li>
          <li>4. Отправьте боту сообщение с текстом или фото</li>
          <li>5. Публикация появится в очереди модерации</li>
          <li>6. Одобрите публикацию — она появится на сайте</li>
        </ol>
      </div>
    </div>
  );
}
