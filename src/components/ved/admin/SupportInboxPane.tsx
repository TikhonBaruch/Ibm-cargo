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
    <section>
      <div className="card">
        <h3>Обращения</h3>
        <div className="filter-chips">
          {ADMIN_SUPPORT_BOXES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={box === item.id ? "on" : ""}
              onClick={() => onBox(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="activity-list" style={{ maxHeight: 560, overflowY: "auto" }}>
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`activity-item${selectedId === t.id ? " on" : ""}`}
              onClick={() => onOpen(t.id)}
            >
              <div className="dot" />
              <div>
                <strong>{t.subject || "Без темы"}</strong>
                <span>
                  {t.createdByUser?.name || t.createdByUser?.email || "клиент"}
                  {t.company?.name ? ` · ${t.company.name}` : ""}
                  {t.messages?.[0]?.body ? ` · ${t.messages[0].body}` : ""}
                </span>
              </div>
              <SupportTicketChip status={t.ticketStatus} audience="admin" />
            </button>
          ))}
          {threads.length === 0 && (
            <VedEmptyState title={BOX_EMPTY[box].title} hint={BOX_EMPTY[box].hint} />
          )}
        </div>
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
                className={`btn btn-sm ${
                  action === "resolve" || action === "archive" ? "btn-ghost" : "btn-primary"
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
