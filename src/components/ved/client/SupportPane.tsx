"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { allowedSupportActions, type SupportTicketAction } from "@/lib/ved/support-ticket";
import { VedEmptyState } from "../VedShell";
import { SupportTicketChip } from "../support/SupportTicketChip";
import { SupportThreadView, supportActionLabel } from "../support/SupportThreadView";
import { Icon } from "@/lbm-bro/components/icon";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

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
  faqHref = "/cabinet/faq",
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
  faqHref?: string;
}) {
  const [view, setView] = useState<SupportView>(() => {
    if (typeof window === "undefined") return "list";
    return new URLSearchParams(window.location.search).get("open") === "support"
      ? "compose"
      : "list";
  });
  const [listQ, setListQ] = useState("");
  const actions = selected ? allowedSupportActions(selected.ticketStatus, "CLIENT") : [];
  const open = Boolean(selected) || view === "compose";
  const needle = listQ.trim().toLowerCase();
  const visibleThreads = threads.filter((t) => {
    if (!needle) return true;
    return `${t.subject || ""} ${t.messages?.[0]?.body || ""}`.toLowerCase().includes(needle);
  });
  const visibleCalcs = calcsWithChat.filter((c) => {
    if (!needle) return true;
    return `${c.number} ${c.title} ${c.status}`.toLowerCase().includes(needle);
  });

  useEffect(() => {
    if (selected) setView("list");
  }, [selected]);

  return (
    <div className={`im-shell${open ? " open" : ""}`}>
      <aside className="im-list">
        <div className="im-list-head">
          <div>
            <h3>Диалоги</h3>
            <p>Поддержка платформы и брокер по заявке</p>
          </div>
        </div>
        <label className="im-search">
          <Icon name="search" />
          <input
            value={listQ}
            onChange={(e) => setListQ(e.target.value)}
            placeholder="Заявка, тема или брокер"
          />
        </label>
        <div className="filter-chips" style={{ padding: "0 14px 8px" }}>
          {(
            [
              ["active", "Активные"],
              ["archive", "Архив"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={box === key && view !== "compose" && !selected ? "on" : ""}
              onClick={() => {
                setView("list");
                onBox(key);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="im-scroll">
          <button
            type="button"
            className={`im-row pin${view === "compose" && !selected ? " on" : ""}`}
            onClick={() => {
              onBackToList();
              setView("compose");
            }}
          >
            <span className="im-ava support">
              <Icon name="message" />
            </span>
            <span className="im-row-body">
              <span className="im-row-top">
                <strong>Поддержка</strong>
                <em>новое</em>
              </span>
              <span className="im-row-sub">Кабинет, оплата, сроки</span>
            </span>
          </button>

          {visibleThreads.map((t) => {
            const preview = t.messages?.[0]?.body ?? "";
            return (
              <button
                key={t.id}
                type="button"
                className={`im-row${selected?.id === t.id ? " on" : ""}`}
                onClick={() => void onOpenThread(t.id)}
              >
                <span className="im-ava support">
                  <Icon name="message" />
                </span>
                <span className="im-row-body">
                  <span className="im-row-top">
                    <strong>{t.subject || "Без темы"}</strong>
                    <SupportTicketChip status={t.ticketStatus} audience="client" />
                  </span>
                  <span className="im-row-sub">{preview || "Обращение"}</span>
                </span>
              </button>
            );
          })}

          <div className="im-label">Брокеры по заявкам</div>
          {visibleCalcs.length ? (
            visibleCalcs.map((c) => (
              <Link key={c.id} href={orderHrefFor(c.id)} className="im-row">
                <span className="im-ava">
                  <Icon name="user" />
                </span>
                <span className="im-row-body">
                  <span className="im-row-top">
                    <strong>{c.number}</strong>
                    <span className="pill">{c.status}</span>
                  </span>
                  <span className="im-row-sub">{c.title}</span>
                  <span className="im-row-meta">Чат в карточке заявки после оплаты</span>
                </span>
              </Link>
            ))
          ) : (
            <p className="im-empty-hint">
              {calcsWithChat.length ? "Ничего не найдено" : "Чат с брокером появится после оплаты и взятия в работу"}
            </p>
          )}
        </div>
      </aside>

      <section className="im-thread">
        {selected ? (
          <>
            <header className="im-head">
              <button
                type="button"
                className="im-back"
                onClick={() => {
                  setView("list");
                  onBackToList();
                }}
                aria-label="К списку"
              >
                ‹
              </button>
              <span className="im-ava support">
                <Icon name="message" />
              </span>
              <div className="im-head-txt">
                <strong>{selected.subject || "Без темы"}</strong>
                <span>
                  <i className="im-dot" /> Поддержка LBM
                </span>
              </div>
            </header>
            <div className="im-thread-body" style={{ padding: 16, overflow: "auto" }}>
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
              <DesignerStub
                title="Голосовые сообщения"
                intent="В макете чата есть запись голоса (mic) в тред поддержки и брокера."
                gap="Live чат — текст. Голос не пишется в /api/v1."
                compact
              />
            </div>
          </>
        ) : view === "compose" ? (
          <>
            <header className="im-head">
              <button
                type="button"
                className="im-back"
                onClick={() => setView("list")}
                aria-label="К списку"
              >
                ‹
              </button>
              <span className="im-ava support">
                <Icon name="message" />
              </span>
              <div className="im-head-txt">
                <strong>Поддержка LBM</strong>
                <span>
                  <i className="im-dot" /> Платформа
                </span>
              </div>
            </header>
            <div className="im-thread-body" style={{ padding: 16, overflow: "auto" }}>
              <div className="field">
                <label>Тема</label>
                <input
                  value={subject}
                  onChange={(e) => onSubject(e.target.value)}
                  placeholder="Тема"
                  maxLength={200}
                />
              </div>
              <div className="field">
                <label>Сообщение</label>
                <textarea
                  rows={6}
                  value={body}
                  onChange={(e) => onBody(e.target.value)}
                  placeholder="Опишите вопрос"
                  maxLength={4000}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !subject.trim() || !body.trim()}
                onClick={onSubmit}
              >
                Отправить
              </button>
              {sentHint ? <p className="meta" style={{ color: "var(--ok, #059669)" }}>{sentHint}</p> : null}
              <p className="meta" style={{ marginTop: 12 }}>
                По конкретной заявке лучше писать брокеру в карточке.{" "}
                <Link href={faqHref} style={{ color: "var(--blue)", fontWeight: 700 }}>
                  FAQ
                </Link>
              </p>
              <DesignerStub
                title="Голосовые сообщения"
                intent="Кнопка mic в макете чата."
                gap="Live — только текст тикета."
                compact
              />
            </div>
          </>
        ) : (
          <div className="im-blank">
            <span className="im-ava lg support">
              <Icon name="message" lg />
            </span>
            <h3>Кому написать?</h3>
            <p>Поддержка — по кабинету и оплате. Брокер — только по своей заявке после оплаты.</p>
            <div className="im-blank-acts">
              <button type="button" className="btn btn-primary" onClick={() => setView("compose")}>
                <Icon name="message" /> Открыть поддержку
              </button>
              <Link href={faqHref} className="btn btn-ghost">
                <Icon name="file" /> FAQ
              </Link>
            </div>
            {threads.length === 0 ? (
              <VedEmptyState
                title={box === "archive" ? "Архив пуст" : "Нет открытых обращений"}
                hint="Общие вопросы по кабинету — сюда."
              />
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
