"use client";

import { useRef, useState } from "react";
import type { Calc, ChatMsg } from "./types";
import { compressImageForUpload } from "@/lib/ved/compress-image-client";

export function WorkChat({
  selected,
  chat,
  waitingOn,
  chatMsg,
  busy,
  tall,
  onChatMsg,
  onSend,
  onUploaded,
  onUploadError,
}: {
  selected: Calc | null;
  chat: ChatMsg[];
  waitingOn?: "CLIENT" | "BROKER" | null;
  chatMsg: string;
  busy: boolean;
  /** Larger message pane for chat-first layout. */
  tall?: boolean;
  onChatMsg: (v: string) => void;
  onSend: (attachmentUrl?: string) => void;
  onUploaded?: (url: string) => void;
  onUploadError?: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImageForUpload(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch("/api/v1/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUploaded?.(data.url);
      onSend(data.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      onUploadError?.(msg);
    } finally {
      setUploading(false);
    }
  };

  if (!selected || selected.status === "QUEUED") return null;

  return (
    <div className="border-t border-slate-100 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">Чат</div>
        {waitingOn === "CLIENT" && (
          <span className="text-xs text-amber-600">ждёт ответа клиента</span>
        )}
        {waitingOn === "BROKER" && (
          <span className="text-xs text-[#2b72f4]">ждёт вашего ответа</span>
        )}
      </div>
      <div
        className={`mb-2 space-y-1 overflow-y-auto rounded-2xl bg-slate-50 p-2 text-sm ${
          tall ? "max-h-[min(28rem,55vh)] min-h-[12rem]" : "max-h-40"
        }`}
      >
        {chat.map((m) => (
          <div key={m.id}>
            <span className="text-xs text-[#7a7f89]">{m.author?.name || "Система"}: </span>
            {m.body}
            {m.attachmentUrl && (
              <a className="ml-1 text-[#2b72f4]" href={m.attachmentUrl}>
                [файл]
              </a>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border px-2 py-1.5 text-sm"
          value={chatMsg}
          onChange={(e) => onChatMsg(e.target.value)}
          placeholder="Сообщение клиенту"
        />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <button
          type="button"
          disabled={uploading || busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-full border px-3 py-1 text-xs font-semibold"
        >
          📎
        </button>
        <button
          type="button"
          disabled={busy || !chatMsg.trim()}
          onClick={() => onSend()}
          className="rounded-full bg-[#2b72f4] px-3 py-1 text-xs font-semibold text-white"
        >
          →
        </button>
      </div>
    </div>
  );
}
