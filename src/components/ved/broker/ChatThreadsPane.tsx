"use client";

import { VedEmptyState } from "../VedShell";
import type { Calc, ChatMsg } from "./types";

export type ChatThreadRow = {
  id: string;
  waitingOn?: "CLIENT" | "BROKER" | null;
  calculation?: {
    id: string;
    number: string;
    title: string;
    status: string;
    clientUser?: { name?: string | null } | null;
  } | null;
  messages?: ChatMsg[];
};

export function ChatThreadsPane({
  threads,
  selectedId,
  onSelect,
  queueHref = "/broker/queue",
}: {
  threads: ChatThreadRow[];
  selectedId?: string;
  onSelect: (calc: Calc) => void;
  queueHref?: string;
}) {
  if (threads.length === 0) {
    return (
      <div className="card">
        <VedEmptyState
          title="Нет активных диалогов"
          hint="Чат появляется после claim — когда заявка перейдёт в «В работе»."
          actionLabel="Открыть очередь"
          actionHref={queueHref}
        />
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Чаты по заявкам</h3>
      <div className="activity-list">
        {threads.map((t) => {
          const calc = t.calculation;
          if (!calc) return null;
          const last = t.messages?.[0];
          const active = selectedId === calc.id;
          const waitingBroker = t.waitingOn === "BROKER";
          return (
            <button
              key={t.id}
              type="button"
              className={`activity-item${active ? " on" : ""}`}
              onClick={() =>
                onSelect({
                  id: calc.id,
                  number: calc.number,
                  title: calc.title,
                  status: calc.status,
                  clientUser: calc.clientUser ?? undefined,
                })
              }
            >
              <div className={`dot${waitingBroker ? " warn" : ""}`} />
              <div>
                <strong>
                  {calc.number} · {calc.title}
                </strong>
                <span>
                  {calc.clientUser?.name || "Клиент"}
                  {last?.body ? ` · ${last.body}` : ""}
                </span>
              </div>
              {waitingBroker && <span className="pill blue">ответ</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
