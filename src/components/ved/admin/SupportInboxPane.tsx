"use client";

import { allowedSupportActions, type SupportTicketAction } from "@/lib/ved/support-ticket";
import { VedEmptyState } from "../VedShell";
import { VedDetailDrawer } from "../VedDetailDrawer";
import { SupportTicketChip } from "../support/SupportTicketChip";
import { SupportThreadView, supportActionLabel } from "../support/SupportThreadView";

export type AdminSupportThread = {
  id: string;
  subject: string | null;
  waitingOn?: string | null;
  ticketStatus?: string | null;
  createdByUser?: { name?: string | null; email?: string | null } | null;
  company?: { name?: string } | null;
  messages?: Array<{ body: string; author?: { name?: string | null } | null }>;
};

export type AdminSupportDetail = {
  id: string;
  subject: string | null;
  ticketStatus?: string | null;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    isSystem?: boolean;
    author?: { name?: string | null; role?: string | null } | null;
  }>;
};

export const ADMIN_SUPPORT_BOXES = [
  { id: "open", label: "Нужен ответ" },
  { id: "waiting_client", label: "Ждёт клиента" },
  { id: "resolved", label: "Закрыто" },
  { id: "archived", label: "Архив" },
] as const;

export type AdminSupportBox = (typeof ADMIN_SUPPORT_BOXES)[number]["id"];

const BOX_EMPTY: Record<AdminSupportBox, { title: string; hint: string }> = {
  open: {
    title: "Нужен ответ: новых нет",
    hint: "Когда клиент напишет в поддержку, обращение появится здесь.",
  },
  waiting_client: {
    title: "Нет тикетов, ждущих клиента",
    hint: "После вашего ответа обращение ждёт клиента в этой папке.",
  },
  resolved: {
    title: "Нет закрытых обращений",
    hint: "Закрытые тикеты появятся здесь.",
  },
  archived: {
    title: "Архив пуст",
    hint: "Архивные обращения хранятся отдельно от активной очереди.",
  },
};

export function SupportInboxPane({
  box,
  onBox,
  threads,
  selectedId,
  detail,
  reply,
  busy,
  onOpen,
  onCloseDetail,
  onReplyChange,
  onSend,
  onStatus,
}: {
  box: AdminSupportBox;
  onBox: (box: AdminSupportBox) => void;
  threads: AdminSupportThread[];
  selectedId: string;
  detail: AdminSupportDetail | null;
  reply: string;
  busy: boolean;
  onOpen: (id: string) => void;
  onCloseDetail: () => void;
  onReplyChange: (v: string) => void;
  onSend: () => void;
  onStatus: (action: SupportTicketAction) => void;
}) {
  const actions = detail ? allowedSupportActions(detail.ticketStatus, "ADMIN") : [];

  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--kb-font-display)" }}>
          Обращения
        </h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {ADMIN_SUPPORT_BOXES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onBox(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                box === item.id ? "bg-[#2b72f4] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <ul className="max-h-[560px] space-y-2 overflow-y-auto">
          {threads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={`w-full rounded-2xl px-3 py-2 text-left text-sm ${
                  selectedId === t.id
                    ? "bg-[rgba(43,114,244,0.08)] shadow-[inset_3px_0_0_#2b72f4]"
                    : "bg-slate-50 hover:bg-slate-100/80"
                }`}
                onClick={() => onOpen(t.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{t.subject || "Без темы"}</div>
                    <div className="text-xs text-[var(--kb-muted)]">
                      {t.createdByUser?.name || t.createdByUser?.email || "клиент"}
                      {t.company?.name ? ` · ${t.company.name}` : ""}
                    </div>
                    {t.messages?.[0]?.body && (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--kb-muted)]">{t.messages[0].body}</p>
                    )}
                  </div>
                  <SupportTicketChip status={t.ticketStatus} audience="admin" />
                </div>
              </button>
            </li>
          ))}
          {threads.length === 0 && (
            <li>
              <VedEmptyState title={BOX_EMPTY[box].title} hint={BOX_EMPTY[box].hint} />
            </li>
          )}
        </ul>
      </div>
      {detail && (
        <VedDetailDrawer
          open
          title={detail.subject || "Без темы"}
          subtitle="Поддержка"
          onClose={onCloseDetail}
        >
          <SupportThreadView
            ticketStatus={detail.ticketStatus}
            audience="admin"
            messages={detail.messages}
            reply={reply}
            onReplyChange={onReplyChange}
            onSend={onSend}
            busy={busy}
            actions={actions.map((action) => (
              <button
                key={action}
                type="button"
                disabled={busy}
                onClick={() => onStatus(action)}
                className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                  action === "resolve" || action === "archive"
                    ? "border border-slate-200 bg-white text-slate-800"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {supportActionLabel(action)}
              </button>
            ))}
          />
        </VedDetailDrawer>
      )}
    </section>
  );
}
