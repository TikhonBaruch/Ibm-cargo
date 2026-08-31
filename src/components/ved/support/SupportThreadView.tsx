"use client";

import type { ReactNode } from "react";
import { isActiveSupportStatus, type SupportTicketAction } from "@/lib/ved/support-ticket";
import { SupportTicketChip } from "./SupportTicketChip";

export type SupportMessage = {
  id: string;
  body: string;
  createdAt: string;
  isSystem?: boolean;
  author?: { name?: string | null; role?: string | null } | null;
};

export function SupportThreadView({
  subject,
  ticketStatus,
  audience,
  messages,
  reply,
  onReplyChange,
  onSend,
  busy,
  actions,
}: {
  subject?: string | null;
  ticketStatus?: string | null;
  audience: "client" | "admin";
  messages: SupportMessage[];
  reply: string;
  onReplyChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  actions?: ReactNode;
}) {
  const canReply = isActiveSupportStatus(ticketStatus);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {subject ? (
          <h3 className="text-base font-semibold" style={{ fontFamily: "var(--kb-font-display)" }}>
            {subject}
          </h3>
        ) : null}
        <SupportTicketChip status={ticketStatus} audience={audience} />
      </div>
      <div className="chat-box tall" style={{ maxHeight: "min(50vh, 420px)" }}>
        {messages.map((m) =>
          m.isSystem ? (
            <div key={m.id} className="bubble" style={{ marginLeft: "auto", marginRight: "auto", textAlign: "center" }}>
              {m.body}
              <div className="meta">
                {m.createdAt ? new Date(m.createdAt).toLocaleString("ru-RU") : ""}
              </div>
            </div>
          ) : (
            <div
              key={m.id}
              className={
                audience === "admin"
                  ? m.author?.role === "ADMIN" || m.author?.role === "EDITOR"
                    ? "bubble me"
                    : "bubble"
                  : m.author?.role === "CLIENT"
                    ? "bubble me"
                    : "bubble"
              }
            >
              <div className="meta">
                {m.author?.name || m.author?.role || "Участник"}
                {m.author?.role ? ` · ${m.author.role}` : ""}
                {" · "}
                {m.createdAt ? new Date(m.createdAt).toLocaleString("ru-RU") : ""}
              </div>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          )
        )}
        {messages.length === 0 && <div className="bubble">Пока нет сообщений</div>}
      </div>
      {canReply && (
        <>
          <div className="field" style={{ marginTop: 12 }}>
            <label>{audience === "admin" ? "Ответ клиенту" : "Ваш ответ"}</label>
            <textarea
              rows={3}
              value={reply}
              onChange={(e) => onReplyChange(e.target.value)}
              placeholder={audience === "admin" ? "Ответ клиенту" : "Ваш ответ"}
              maxLength={4000}
            />
          </div>
          <button
            type="button"
            disabled={busy || !reply.trim()}
            onClick={onSend}
            className="btn btn-primary btn-sm"
          >
            Отправить
          </button>
        </>
      )}
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function supportActionLabel(action: SupportTicketAction): string {
  if (action === "resolve") return "Закрыть";
  if (action === "archive") return "В архив";
  return "Открыть снова";
}
