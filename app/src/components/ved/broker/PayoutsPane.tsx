"use client";

import { VedEmptyState } from "../VedShell";
import type { PayoutRow } from "./types";

export function PayoutsPane({ payouts }: { payouts: PayoutRow[] }) {
  const totalAccrued = payouts
    .filter((p) => p.status === "ACCRUED" || p.status === "DOCS_REQUESTED")
    .reduce((s, p) => s + p.amountRub, 0);
  const totalPaid = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amountRub, 0);
  const jobs = payouts.reduce((s, p) => s + p.jobsCount, 0);

  return (
    <section>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-4 shadow-sm">
          <div className="text-sm text-[var(--kb-muted)]">Начислено</div>
          <div className="text-2xl font-bold">{totalAccrued.toLocaleString("ru-RU")} ₽</div>
        </div>
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-4 shadow-sm">
          <div className="text-sm text-[var(--kb-muted)]">Выплачено</div>
          <div className="text-2xl font-bold">{totalPaid.toLocaleString("ru-RU")} ₽</div>
        </div>
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-4 shadow-sm">
          <div className="text-sm text-[var(--kb-muted)]">Заявок в breakdown</div>
          <div className="text-2xl font-bold">{jobs}</div>
        </div>
      </div>
      <p className="mb-3 text-sm text-[var(--kb-muted)]">
        Сумма = jobs × brokerSharePct тарифа. Статусы DOCS_REQUESTED / PAID меняет только admin.
      </p>
      <ul className="space-y-2 text-sm">
        {payouts.map((p) => (
          <li
            key={p.id}
            className="flex justify-between rounded-[28px] border border-black/[0.04] bg-white px-4 py-3 shadow-sm"
          >
            <span>
              {p.periodLabel} · {p.jobsCount} заявок × доля тарифа
            </span>
            <span>
              {p.amountRub.toLocaleString("ru-RU")} ₽ · {p.status}
            </span>
          </li>
        ))}
        {payouts.length === 0 && (
          <li>
            <VedEmptyState
              title="Пока нет начислений"
              hint="Доля тарифа начисляется после approve — когда клиент получит PDF."
            />
          </li>
        )}
      </ul>
    </section>
  );
}
