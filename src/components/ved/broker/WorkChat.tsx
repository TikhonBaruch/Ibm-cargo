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
    <div>
      <div className="card-head" style={{ marginBottom: 10 }}>
        <div>
          <h3 style={{ marginBottom: 0 }}>Чат</h3>
        </div>
        {waitingOn === "CLIENT" && <span className="pill warn">ждёт клиента</span>}
        {waitingOn === "BROKER" && <span className="pill blue">ждёт вас</span>}
      </div>
      <div className={`chat-box${tall ? " tall" : ""}`}>
        {chat.map((m) => {
          const mine = m.author?.role === "BROKER";
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
