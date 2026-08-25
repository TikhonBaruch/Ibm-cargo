"use client";

import { StatusPill, VedEmptyState } from "../VedShell";
import type { Calc } from "./types";
import { formatSlaCountdown, queueBadge } from "./types";

function isClaimable(c: Calc): boolean {
  return c.status === "QUEUED" || c.status === "SLA_RISK";
}

export function QueuePane({
  queue,
  meId,
  preferredClaimHours,
  busy,
  selectedId,
  onOpen,
  onClaim,
  title = "Очередь оплаченных заявок",
  paused = false,
  loading = false,
  queueHref,
  profileHref,
  workMode = false,
}: {
  queue: Calc[];
  meId: string;
  preferredClaimHours: number;
  busy: boolean;
  selectedId?: string | null;
  onOpen: (c: Calc) => void;
  onClaim: (id: string) => void;
  title?: string;
  paused?: boolean;
  loading?: boolean;
  queueHref?: string;
  profileHref?: string;
  workMode?: boolean;
}) {
  const empty = loading ? (
    <VedEmptyState title="Загрузка очереди…" hint="Подтягиваем оплаченные заявки." />
  ) : paused ? (
    <VedEmptyState
      title="Приём заявок выключен"
      hint="Очередь скрыта, пока в профиле выключено «принимаю заявки»."
      actionLabel="Открыть профиль"
      actionHref={profileHref}
    />
  ) : workMode ? (
    <VedEmptyState
      title="Нет заявок в работе"
      hint="Возьмите оплаченный просчёт из очереди — после claim появится маппинг ТН ВЭД."
      actionLabel="Открыть очередь"
      actionHref={queueHref}
    />
  ) : (
    <VedEmptyState
      title="Очередь пуста"
      hint="Новые заявки появятся после оплаты клиентом (STANDARD/PRO)."
    />
  );

  return (
    <div className="overflow-hidden rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
      <div className="border-b border-black/[0.04] px-5 py-4">
        <h2 className="font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
          {title}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[var(--kb-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">№</th>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Тариф</th>
              <th className="px-4 py-3 font-medium">AI</th>
              <th className="px-4 py-3 font-medium">SLA</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {queue.map((c) => {
              const badge = queueBadge({
                preferredBrokerUserId: c.preferredBrokerUserId,
                meId,
                queuedAt: c.queuedAt,
                preferredClaimHours,
              });
              const claimable = isClaimable(c);
              const active = selectedId === c.id;
              return (
                <tr
                  key={c.id}
                  aria-selected={active}
                  className={`cursor-pointer border-t border-slate-100 ${
                    active
                      ? "bg-[rgba(43,114,244,0.08)] shadow-[inset_3px_0_0_#2b72f4]"
                      : "hover:bg-slate-50/80"
                  }`}
                  onClick={() => onOpen(c)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">{c.number}</span>
                    {badge === "preferred" && (
                      <span className="ml-2 text-xs text-[#2b72f4]">для вас</span>
                    )}
                    {badge === "reserved" && (
                      <span className="ml-2 text-xs text-amber-600">reserved</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.clientUser?.name || "—"}</td>
                  <td className="px-4 py-3 text-[var(--kb-muted)]">{c.tariff?.name || "—"}</td>
                  <td className="px-4 py-3">
                    {c.confidence != null ? `${Math.round(c.confidence * 100)}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusPill status={c.status} />
                      <span className="text-xs text-[var(--kb-muted)]">
                        {formatSlaCountdown(c.slaDeadline)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {claimable ? (
                      <button
                        type="button"
                        disabled={busy || badge === "reserved"}
                        onClick={() => onClaim(c.id)}
                        className="rounded-full bg-[#2b72f4] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Взять
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                        onClick={() => onOpen(c)}
                      >
                        Открыть
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {queue.length === 0 && (
              <tr>
                <td colSpan={6}>{empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
