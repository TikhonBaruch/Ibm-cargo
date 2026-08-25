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
      <ul className="mb-4 max-h-[min(50vh,420px)] space-y-2 overflow-y-auto">
        {messages.map((m) =>
          m.isSystem ? (
            <li key={m.id} className="px-1 text-center text-xs italic text-[var(--kb-muted)]">
              {m.body}
              <span className="ml-2 not-italic">
                {m.createdAt ? new Date(m.createdAt).toLocaleString("ru-RU") : ""}
              </span>
            </li>
          ) : (
            <li key={m.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-[var(--kb-muted)]">
                {m.author?.name || m.author?.role || "Участник"}
                {m.author?.role ? ` · ${m.author.role}` : ""}
                {" · "}
                {m.createdAt ? new Date(m.createdAt).toLocaleString("ru-RU") : ""}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            </li>
          )
        )}
        {messages.length === 0 && (
          <li className="text-sm text-[var(--kb-muted)]">Пока нет сообщений</li>
        )}
      </ul>
      {canReply && (
        <>
          <textarea
            className="mb-3 min-h-[88px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={reply}
            onChange={(e) => onReplyChange(e.target.value)}
            placeholder={audience === "admin" ? "Ответ клиенту" : "Ваш ответ"}
            maxLength={4000}
          />
          <button
            type="button"
            disabled={busy || !reply.trim()}
            onClick={onSend}
            className="rounded-full bg-[#2b72f4] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
