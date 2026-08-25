"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Send, Image as ImageIcon, X, FileText, Tag, Star } from "lucide-react";
import NextImage from "next/image";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  post?: {
    id: string;
    title: string;
    type: string;
    status: string;
    isFeatured: boolean;
    tags: string[];
  };
  photo?: string;
}

const TYPE_LABELS: Record<string, string> = {
  NEWS: "Новость",
  WORK: "Работа",
  UPDATE: "Обновление",
  EVENT: "Событие",
};

const TYPE_COLORS: Record<string, string> = {
  NEWS: "bg-blue-500/20 text-blue-400",
  WORK: "bg-emerald-500/20 text-emerald-400",
  UPDATE: "bg-amber-500/20 text-amber-400",
  EVENT: "bg-purple-500/20 text-purple-400",
};

export default function ChatPage() {
  const { data: session } = useSession();
  const isSpecialist = (session?.user as any)?.role === "SPECIALIST";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content: isSpecialist
        ? "Отправьте текст или фото для создания публикации.\n\n" +
          "Публикация будет отправлена на проверку администратору."
        : "Отправьте текст или фото для создания публикации.\n\n" +
          "Используйте #хештеги для автоматических тегов.\n" +
          "#портфолио — добавить в портфолио.",
    },
  ]);
  const [input, setInput] = useState("");
  const [postType, setPostType] = useState("NEWS");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus textarea on mobile
  useEffect(() => {
    if (isSpecialist && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isSpecialist]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "chat");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url;
    } catch {
      return null;
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && !photoFile) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      photo: photoPreview || undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      let coverImage: string | null = null;
      if (photoFile) {
        coverImage = await uploadPhoto(photoFile);
      }
      removePhoto();

      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, coverImage, type: postType }),
      });

      const data = await res.json();

      if (data.ok) {
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "bot",
          content: isSpecialist
            ? `✅ Публикация отправлена на проверку:\n` +
              `"${data.post.title}"\n` +
              `Тип: ${TYPE_LABELS[data.post.type] || data.post.type}` +
              (data.post.tags.length > 0 ? `\nТеги: ${data.post.tags.join(", ")}` : "")
            : `✅ Публикация создана:\n` +
              `"${data.post.title}"\n` +
              `Тип: ${TYPE_LABELS[data.post.type] || data.post.type}` +
              (data.post.tags.length > 0 ? `\nТеги: ${data.post.tags.join(", ")}` : "") +
              (data.post.isFeatured ? "\n⭐ В портфолио" : "") +
              `\nСтатус: На модерации`,
          post: data.post,
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "bot",
          content: `❌ Ошибка: ${data.error || "Не удалось создать публикацию"}`,
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: "❌ Ошибка соединения с сервером",
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Specialist: mobile-optimized full-screen chat
  if (isSpecialist) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-blue-600/60 text-white"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {msg.photo && (
                    <div className="mb-2">
                      <NextImage
                        src={msg.photo}
                        alt="Фото из сообщения"
                        width={300}
                        height={200}
                        className="max-h-40 rounded-lg object-cover"
                      />
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                  {msg.post && (
                    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/50 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="text-xs text-slate-400">Пост создан</span>
                      </div>
                      <div className="text-sm font-medium text-slate-100">
                        {msg.post.title}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${TYPE_COLORS[msg.post.type] || "bg-slate-700 text-slate-300"}`}
                        >
                          {TYPE_LABELS[msg.post.type] || msg.post.type}
                        </span>
                        {msg.post.isFeatured && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-400">
                            <Star className="h-3 w-3" /> Портфолио
                          </span>
                        )}
                        {msg.post.tags.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Tag className="h-3 w-3" />
                            {msg.post.tags.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-800 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Photo preview */}
        {photoPreview && (
          <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-2">
            <NextImage
              src={photoPreview}
              alt="Превью фото"
              width={48}
              height={48}
              className="h-12 w-12 rounded-lg object-cover"
            />
            <div className="flex-1 text-xs text-slate-400">Фото прикреплено</div>
            <button
              onClick={removePhoto}
              className="rounded-lg p-1 text-slate-400 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Input area — sticky bottom, mobile-optimized */}
        <div className="sticky bottom-0 border-t border-slate-800 bg-slate-950 p-3">
          <div className="flex items-end gap-2">
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              className="shrink-0 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-2.5 text-xs text-slate-100 focus:border-slate-600 focus:outline-none"
            >
              <option value="NEWS">Новость</option>
              <option value="WORK">Работа</option>
              <option value="UPDATE">Обновление</option>
              <option value="EVENT">Событие</option>
            </select>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 rounded-lg border border-slate-800 bg-slate-900/50 px-2.5 py-2.5 text-slate-400 hover:text-slate-100"
              title="Фото"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Сообщение..."
              rows={1}
              className="max-h-24 flex-1 resize-none rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-600 focus:outline-none"
              style={{ minHeight: "40px" }}
            />

            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !photoFile)}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-2.5 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin/Editor: original chat layout
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-100">Чат</h1>
        <p className="text-sm text-slate-400">
          Быстрое создание публикаций через сообщения
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600/60 text-white"
                    : "bg-slate-800 text-slate-100"
                }`}
              >
                {msg.photo && (
                  <div className="mb-2">
                    <NextImage
                      src={msg.photo}
                      alt="Фото из сообщения"
                      width={384}
                      height={192}
                      className="max-h-48 rounded-lg object-cover"
                    />
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                {msg.post && (
                  <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/50 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-400">Пост создан</span>
                    </div>
                    <div className="text-sm font-medium text-slate-100">
                      {msg.post.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${TYPE_COLORS[msg.post.type] || "bg-slate-700 text-slate-300"}`}
                      >
                        {TYPE_LABELS[msg.post.type] || msg.post.type}
                      </span>
                      {msg.post.isFeatured && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-400">
                          <Star className="h-3 w-3" /> Портфолио
                        </span>
                      )}
                      {msg.post.tags.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Tag className="h-3 w-3" />
                          {msg.post.tags.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-800 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="mt-4">
        {photoPreview && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
            <NextImage
              src={photoPreview}
              alt="Превью прикреплённого фото"
              width={64}
              height={64}
              className="h-16 w-16 rounded-lg object-cover"
            />
            <div className="flex-1 text-sm text-slate-400">Фото прикреплено</div>
            <button
              onClick={removePhoto}
              className="rounded-lg p-1 text-slate-400 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-3">
          <select
            value={postType}
            onChange={(e) => setPostType(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
          >
            <option value="NEWS">Новость</option>
            <option value="WORK">Работа</option>
            <option value="UPDATE">Обновление</option>
            <option value="EVENT">Событие</option>
          </select>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-slate-400 hover:text-slate-100"
            title="Прикрепить фото"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите сообщение..."
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-600 focus:outline-none"
            style={{ minHeight: "42px" }}
          />

          <button
            onClick={sendMessage}
            disabled={loading || (!input.trim() && !photoFile)}
            className="rounded-xl bg-slate-800 px-4 py-2.5 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
