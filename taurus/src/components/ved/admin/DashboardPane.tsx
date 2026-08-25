"use client";

import Link from "next/link";
import { VedEmptyState } from "../VedShell";
import type { AdminBrokerRow, AdminCalc, AdminClientRow, AdminPayoutRow, PlatformSettings } from "./types";

export function DashboardPane({
  calcs,
  clients,
  brokers,
  payouts,
  settings,
  pendingBrokers,
  payoutReady,
  bookingsHref,
  supportHref,
  onOpenCalc,
}: {
  calcs: AdminCalc[];
  clients: AdminClientRow[];
  brokers: AdminBrokerRow[];
  payouts: AdminPayoutRow[];
  settings: PlatformSettings;
  pendingBrokers: AdminBrokerRow[];
  payoutReady: AdminPayoutRow[];
  bookingsHref: string;
  supportHref: string;
  onOpenCalc: (id: string) => void;
}) {
  const attentionCalcs = calcs
    .filter((c) => c.status === "SLA_RISK" || (c.confidence != null && c.confidence < settings.confidenceThreshold))
    .slice(0, 6);

  return (
    <section className="mb-6 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { v: calcs.length, k: "Просчётов (live)" },
          { v: calcs.filter((c) => c.status === "QUEUED").length, k: "В очереди" },
          { v: clients.length, k: "Клиентов" },
          { v: brokers.length, k: "Брокеров" },
        ].map((s) => (
          <div
            key={s.k}
            className="rounded-[28px] border border-black/[0.04] bg-white px-5 py-4 shadow-sm"
          >
            <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--kb-font-display)" }}>
              {s.v}
            </div>
            <div className="mt-1 text-sm text-[var(--kb-muted)]">{s.k}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
                Статусы сейчас
              </h2>
              <p className="text-sm text-[var(--kb-muted)]">Без фейкового GMV — только live counts</p>
            </div>
            <span className="rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-xs font-bold text-[#16a34a]">
              Живой
            </span>
          </div>
          <div className="flex h-40 items-end gap-2">
            {(() => {
              const bars = [
                ["DONE", calcs.filter((c) => c.status === "DONE").length],
                ["IN_REVIEW", calcs.filter((c) => c.status === "IN_REVIEW").length],
                ["QUEUED", calcs.filter((c) => c.status === "QUEUED").length],
                ["SLA_RISK", calcs.filter((c) => c.status === "SLA_RISK").length],
                ["AI_READY", calcs.filter((c) => c.status === "AI_READY").length],
              ] as const;
              const max = Math.max(1, ...bars.map(([, n]) => n));
              return bars.map(([label, count]) => (
                <div key={label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t-lg bg-[#2b72f4]/85"
                    style={{ height: `${Math.max(12, Math.round((count / max) * 120))}px` }}
                    title={`${label}: ${count}`}
                  />
                  <span className="truncate text-[10px] text-[var(--kb-muted)]">
                    {label.replace("_", " ")}
                  </span>
                  <span className="text-xs font-bold">{count}</span>
                </div>
              ));
            })()}
          </div>
        </div>
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
            Требуют внимания
          </h2>
          <ul className="space-y-3 text-sm">
            {attentionCalcs.map((c) => (
              <li key={c.id} className="flex gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    c.status === "SLA_RISK" ? "bg-red-500" : "bg-amber-500"
                  }`}
                />
                <button type="button" className="text-left" onClick={() => onOpenCalc(c.id)}>
                  <strong>
                    {c.status === "SLA_RISK" ? "SLA risk" : "Низкий AI confidence"} · {c.number}
                  </strong>
                  <div className="text-[var(--kb-muted)]">
                    {c.title}
                    {c.confidence != null ? ` · ${Math.round(c.confidence * 100)}%` : ""}
                  </div>
                </button>
              </li>
            ))}
            {pendingBrokers.slice(0, 2).map((b) => (
              <li key={b.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2b72f4]" />
                <div>
                  <strong>Брокер на модерации</strong>
                  <div className="text-[var(--kb-muted)]">{b.user.name}</div>
                </div>
              </li>
            ))}
            {payoutReady.slice(0, 1).map((pay) => (
              <li key={pay.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <div>
                  <strong>Выплата брокерам</strong>
                  <div className="text-[var(--kb-muted)]">
                    {pay.periodLabel} · {pay.amountRub.toLocaleString("ru-RU")} ₽ · {pay.status}
                  </div>
                </div>
              </li>
            ))}
            {attentionCalcs.length === 0 && pendingBrokers.length === 0 && payoutReady.length === 0 && (
              <li>
                <VedEmptyState
                  title="Сейчас всё спокойно"
                  hint="Нет SLA risk, модерации брокеров и выплат в очереди. Проверьте заявки или поддержку."
                  actionLabel="Заявки"
                  actionHref={bookingsHref}
                />
                {supportHref && (
                  <p className="mt-2 text-center text-xs text-[var(--kb-muted)]">
                    или{" "}
                    <Link href={supportHref} className="font-semibold text-[#2b72f4] hover:underline">
                      Поддержка
                    </Link>
                  </p>
                )}
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
