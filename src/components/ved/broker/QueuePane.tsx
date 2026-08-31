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
    <div className="card">
      <h3>{title}</h3>
      <div className="overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>№</th>
              <th>Клиент</th>
              <th>Тариф</th>
              <th>AI</th>
              <th>SLA</th>
              <th />
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
                  className={`clickable${active ? " is-open" : ""}`}
                  onClick={() => onOpen(c)}
                >
                  <td>
                    <span className="font-medium">{c.number}</span>
                    {badge === "preferred" && (
                      <span className="ml-2 text-xs text-[#2b72f4]">для вас</span>
                    )}
                    {badge === "reserved" && (
                      <span className="ml-2 text-xs text-amber-600">reserved</span>
                    )}
                  </td>
                  <td>{c.clientUser?.name || "—"}</td>
                  <td>{c.tariff?.name || "—"}</td>
                  <td>
                    {c.confidence != null ? `${Math.round(c.confidence * 100)}%` : "—"}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <StatusPill status={c.status} />
                      <span className="text-xs text-[var(--kb-muted)]">
                        {formatSlaCountdown(c.slaDeadline)}
                      </span>
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {claimable ? (
                      <button
                        type="button"
                        disabled={busy || badge === "reserved"}
                        onClick={() => onClaim(c.id)}
                        className="btn btn-primary btn-sm"
                      >
                        Взять
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
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
