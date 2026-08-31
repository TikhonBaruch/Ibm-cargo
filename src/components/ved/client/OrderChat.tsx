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
      <div className="card-head" style={{ marginBottom: 10 }}>
        <div>
          <h3 style={{ marginBottom: 0 }}>Чат с брокером</h3>
        </div>
        {waitingOn === "BROKER" && <span className="pill warn">ждёт брокера</span>}
        {waitingOn === "CLIENT" && <span className="pill blue">ждёт вас</span>}
      </div>
      <div className="chat-box">
        {chat.map((m) => {
          const mine = m.author?.role === "CLIENT";
          return (
            <div key={m.id} className={mine ? "bubble me" : "bubble"}>
              <div className="meta" style={{ fontSize: 11, marginBottom: 4 }}>
                {m.author?.name || "Система"}
              </div>
              {m.body}
              {m.attachmentUrl && (
                <a className="ml-1" href={m.attachmentUrl}>
                  [файл]
                </a>
              )}
            </div>
          );
        })}
        {chat.length === 0 && <div className="bubble">Пока нет сообщений</div>}
      </div>
      <div className="chat-row">
        <input
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
          className="btn btn-ghost btn-sm"
        >
          📎
        </button>
        <button
          type="button"
          disabled={busy || !chatMsg.trim()}
          onClick={() => onSend()}
          className="btn btn-primary btn-sm"
        >
          Отправить
        </button>
      </div>
    </div>
  );
}
