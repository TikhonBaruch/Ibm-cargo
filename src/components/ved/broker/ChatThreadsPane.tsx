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
      <VedEmptyState
        title="Нет активных диалогов"
        hint="Чат появляется после claim — когда заявка перейдёт в «В работе»."
        actionLabel="Открыть очередь"
        actionHref={queueHref}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {threads.map((t) => {
        const calc = t.calculation;
        if (!calc) return null;
        const last = t.messages?.[0];
        const active = selectedId === calc.id;
        const waitingBroker = t.waitingOn === "BROKER";
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() =>
                onSelect({
                  id: calc.id,
                  number: calc.number,
                  title: calc.title,
                  status: calc.status,
                  clientUser: calc.clientUser ?? undefined,
                })
              }
              className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                active
                  ? "border-[#2b72f4] bg-[#e8f0ff] shadow-sm"
                  : "border-black/[0.04] bg-white hover:border-[#2b72f4]/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-[var(--kb-ink)]">
                    {calc.number} · {calc.title}
                  </div>
                  <div className="truncate text-xs text-[var(--kb-muted)]">
                    {calc.clientUser?.name || "Клиент"}
                    {last?.body ? ` · ${last.body}` : ""}
                  </div>
                </div>
                {waitingBroker && (
                  <span className="shrink-0 rounded-full bg-[#2b72f4] px-2 py-0.5 text-[10px] font-bold text-white">
                    ответ
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
