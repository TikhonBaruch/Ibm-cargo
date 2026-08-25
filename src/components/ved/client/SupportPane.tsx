"use client";

import { useState } from "react";
import Link from "next/link";
import { allowedSupportActions, type SupportTicketAction } from "@/lib/ved/support-ticket";
import { VedEmptyState } from "../VedShell";
import { SupportTicketChip } from "../support/SupportTicketChip";
import { SupportThreadView, supportActionLabel } from "../support/SupportThreadView";

export type SupportThread = {
  id: string;
  subject: string | null;
  waitingOn?: string | null;
  ticketStatus?: string | null;
  updatedAt?: string;
  messages?: Array<{
    id: string;
    body: string;
    createdAt: string;
    isSystem?: boolean;
    author?: { name?: string | null; role?: string | null } | null;
  }>;
};

const FAQ = [
  {
    q: "Как оплатить просчёт?",
    a: "Пополните баланс компании (раздел «Баланс»), затем нажмите «Оплатить» в карточке заявки со статусом AI_READY.",
  },
  {
    q: "Куда писать по конкретной заявке?",
    a: "Откройте заявку в «Заявки / просчёты» — чат с брокером доступен после оплаты и взятия в работу.",
  },
  {
    q: "Сколько позиций в тарифе?",
    a: "EXPRESS — 1, STANDARD — до 3, PRO — до 10 позиций (лимит D10).",
  },
];

type SupportBox = "active" | "archive";
type SupportView = "list" | "compose";

export function SupportPane({
  threads,
  calcsWithChat,
  orderHrefFor,
  box,
  onBox,
  selected,
  subject,
  body,
  reply,
  busy,
  sentHint,
  onSubject,
  onBody,
  onReply,
  onSubmit,
  onSendReply,
  onOpenThread,
  onBackToList,
  onStatus,
}: {
  threads: SupportThread[];
  calcsWithChat: Array<{ id: string; number: string; title: string; status: string }>;
  orderHrefFor: (calculationId: string) => string;
  box: SupportBox;
  onBox: (box: SupportBox) => void;
  selected: SupportThread | null;
  subject: string;
  body: string;
  reply: string;
  busy: boolean;
  sentHint?: string;
  onSubject: (v: string) => void;
  onBody: (v: string) => void;
  onReply: (v: string) => void;
  onSubmit: () => void;
  onSendReply: () => void;
  onOpenThread: (threadId: string) => void | Promise<void>;
  onBackToList: () => void;
  onStatus: (action: SupportTicketAction) => void | Promise<void>;
}) {
  const [view, setView] = useState<SupportView>("list");
  const actions = selected ? allowedSupportActions(selected.ticketStatus, "CLIENT") : [];

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-4 rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold" style={{ fontFamily: "var(--kb-font-display)" }}>
          Частые вопросы
        </h2>
        <ul className="space-y-3">
          {FAQ.map((item) => (
            <li key={item.q} className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">{item.q}</div>
              <p className="mt-1 text-sm text-[var(--kb-muted)]">{item.a}</p>
            </li>
          ))}
        </ul>
        {calcsWithChat.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-semibold">Заявки с чатом брокера</div>
            <ul className="space-y-2">
              {calcsWithChat.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    href={orderHrefFor(c.id)}
                    className="text-sm font-medium text-[#2b72f4] hover:underline"
                  >
                    {c.number} · {c.title}
                  </Link>
                  <span className="ml-2 text-xs text-[var(--kb-muted)]">{c.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["active", "Активные"],
              ["archive", "Архив"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setView("list");
                onBox(key);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                box === key && view !== "compose"
                  ? "bg-[#2b72f4] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onBackToList();
              setView("compose");
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              view === "compose" && !selected
                ? "bg-[#2b72f4] text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Новое обращение
          </button>
        </div>

        {selected ? (
          <div>
            <button
              type="button"
              className="mb-3 text-sm font-semibold text-[#2b72f4]"
              onClick={() => {
                setView("list");
                onBackToList();
              }}
            >
              ← К списку
            </button>
            <SupportThreadView
              subject={selected.subject || "Без темы"}
              ticketStatus={selected.ticketStatus}
              audience="client"
              messages={selected.messages || []}
              reply={reply}
              onReplyChange={onReply}
              onSend={onSendReply}
              busy={busy}
              actions={actions.map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled={busy}
                  onClick={() => void onStatus(action)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                    action === "resolve"
                      ? "border border-slate-200 bg-white text-slate-800"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {supportActionLabel(action)}
                </button>
              ))}
            />
          </div>
        ) : view === "compose" ? (
          <>
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--kb-font-display)" }}>
              Новое обращение
            </h2>
            <p className="text-sm text-[var(--kb-muted)]">
              Общие вопросы по кабинету — сюда. По конкретной заявке лучше писать брокеру в карточке.
            </p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={subject}
              onChange={(e) => onSubject(e.target.value)}
              placeholder="Тема"
              maxLength={200}
            />
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={body}
              onChange={(e) => onBody(e.target.value)}
              placeholder="Опишите вопрос"
              maxLength={4000}
            />
            <button
              type="button"
              disabled={busy || !subject.trim() || !body.trim()}
              onClick={onSubmit}
              className="rounded-full bg-[#2b72f4] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Отправить
            </button>
            {sentHint && <p className="text-sm text-emerald-700">{sentHint}</p>}
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--kb-font-display)" }}>
              {box === "archive" ? "Архив обращений" : "Активные обращения"}
            </h2>
            {threads.length === 0 ? (
              box === "archive" ? (
                <VedEmptyState
                  title="Архив пуст"
                  hint="Закрытые и архивные обращения появятся здесь."
                  actionLabel="К активным"
                  onAction={() => onBox("active")}
                />
              ) : (
                <VedEmptyState
                  title="Нет открытых обращений"
                  hint="Общие вопросы по кабинету — сюда. По конкретной заявке лучше писать брокеру."
                  actionLabel="Новое обращение"
                  onAction={() => setView("compose")}
                />
              )
            ) : (
              <ul className="space-y-2">
                {threads.map((t) => {
                  const preview = t.messages?.[0]?.body ?? "";
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="w-full rounded-2xl bg-slate-50 px-3 py-3 text-left hover:bg-slate-100/80"
                        onClick={() => void onOpenThread(t.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{t.subject || "Без темы"}</div>
                            {preview && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-[var(--kb-muted)]">{preview}</p>
                            )}
                          </div>
                          <SupportTicketChip status={t.ticketStatus} audience="client" />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
