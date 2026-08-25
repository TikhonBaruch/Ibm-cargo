"use client";

import { useRef, useState } from "react";
import type { Calc, ChatMsg } from "./types";
import { compressImageForUpload } from "@/lib/ved/compress-image-client";

export function OrderChat({
  selected,
  chat,
  waitingOn,
  chatMsg,
  busy,
  onChatMsg,
  onSend,
}: {
  selected: Calc | null;
  chat: ChatMsg[];
  waitingOn?: "CLIENT" | "BROKER" | null;
  chatMsg: string;
  busy: boolean;
  onChatMsg: (v: string) => void;
  onSend: (attachmentUrl?: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!selected || !["IN_REVIEW", "DONE", "QUEUED", "SLA_RISK"].includes(selected.status)) {
    return null;
  }

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImageForUpload(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch("/api/v1/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onSend(data.url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium text-sm">Чат с брокером</div>
        {waitingOn === "BROKER" && (
          <span className="text-xs text-amber-600">ждёт ответа брокера</span>
        )}
        {waitingOn === "CLIENT" && (
          <span className="text-xs text-[#2b72f4]">ждёт вашего ответа</span>
        )}
      </div>
      <div className="mb-2 max-h-48 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3 text-sm">
        {chat.map((m) => (
          <div key={m.id}>
            <div className="text-xs text-[#7a7f89]">{m.author?.name || "Система"}</div>
            {m.body}
            {m.attachmentUrl && (
              <a className="ml-1 text-[#2b72f4]" href={m.attachmentUrl}>
                [файл]
              </a>
            )}
          </div>
        ))}
        {chat.length === 0 && <div className="text-[#7a7f89]">Пока нет сообщений</div>}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border px-3 py-2 text-sm"
          value={chatMsg}
          onChange={(e) => onChatMsg(e.target.value)}
          placeholder="Сообщение брокеру"
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
          className="rounded-full bg-[#2b72f4] px-4 py-2 text-sm font-semibold text-white"
        >
          Отправить
        </button>
      </div>
    </div>
  );
}
