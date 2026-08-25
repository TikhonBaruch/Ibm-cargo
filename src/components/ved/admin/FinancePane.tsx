"use client";

import { VedEmptyState } from "../VedShell";
import type { AdminClientRow, AdminPayoutRow, PayoutStatusFilter } from "./types";

export function FinancePane({
  clients,
  payoutsTotal,
  payoutReady,
  filteredPayouts,
  payoutStatusFilter,
  busy,
  onFilter,
  onExportCsv,
  onMarkPaid,
}: {
  clients: AdminClientRow[];
  payoutsTotal: number;
  payoutReady: AdminPayoutRow[];
  filteredPayouts: AdminPayoutRow[];
  payoutStatusFilter: PayoutStatusFilter;
  busy: boolean;
  onFilter: (f: PayoutStatusFilter) => void;
  onExportCsv: () => void;
  onMarkPaid: (id: string) => void;
}) {
  const filterActive = payoutStatusFilter !== "ALL";
  const payoutsEmpty = filteredPayouts.length === 0;
  const payoutsFilterEmpty = filterActive && payoutsEmpty && payoutsTotal > 0;

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-4 shadow-sm">
          <div className="text-xs text-[var(--kb-muted)]">Компаний</div>
          <div className="text-2xl font-bold">{clients.length}</div>
        </div>
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-4 shadow-sm">
          <div className="text-xs text-[var(--kb-muted)]">К выплате</div>
          <div className="text-2xl font-bold">{payoutReady.length}</div>
        </div>
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-4 shadow-sm">
          <div className="text-xs text-[var(--kb-muted)]">Сумма ACCRUED+</div>
          <div className="text-2xl font-bold">
            {payoutReady.reduce((s, x) => s + x.amountRub, 0).toLocaleString("ru-RU")} ₽
          </div>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Балансы компаний</h3>
        {clients.length === 0 ? (
          <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
            <VedEmptyState
              title="Нет компаний"
              hint="Клиентские компании появятся после регистрации на /register."
            />
          </div>
        ) : (
          <ul className="mb-4 space-y-1 text-sm">
            {clients.slice(0, 8).map((c) => (
              <li key={c.id} className="flex justify-between rounded-xl bg-white px-3 py-2 shadow-sm">
                <span>{c.name}</span>
                <span className="font-semibold">{c.balanceRub.toLocaleString("ru-RU")} ₽</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-[var(--kb-muted)]">
          Статус{" "}
          <select
            className="ml-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm"
            value={payoutStatusFilter}
            onChange={(e) => onFilter(e.target.value as PayoutStatusFilter)}
          >
            <option value="ALL">Все</option>
            <option value="ACCRUED">ACCRUED</option>
            <option value="DOCS_REQUESTED">DOCS_REQUESTED</option>
            <option value="PAID">PAID</option>
          </select>
        </label>
        <button
          type="button"
          className="rounded-full border px-3 py-1.5 text-xs font-semibold"
          onClick={onExportCsv}
        >
          Экспорт CSV
        </button>
      </div>
      {payoutsEmpty ? (
        <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
          <VedEmptyState
            title={payoutsFilterEmpty ? "Нет выплат в фильтре" : "Очередь выплат пуста"}
            hint={
              payoutsFilterEmpty
                ? "Выберите «Все» или другой статус — выплаты появятся после начисления брокерам."
                : "Выплаты появятся после завершённых просчётов и начисления доли брокеру."
            }
            actionLabel={payoutsFilterEmpty ? "Все статусы" : undefined}
            onAction={payoutsFilterEmpty ? () => onFilter("ALL") : undefined}
          />
        </div>
      ) : (
        <ul className="space-y-2 text-sm">
          {filteredPayouts.map((pay) => (
            <li
              key={pay.id}
              className="flex items-center justify-between rounded-[28px] border border-black/[0.04] bg-white px-4 py-3 shadow-sm"
            >
              <span>
                {pay.brokerProfile?.user?.name} · {pay.periodLabel} · {pay.amountRub.toLocaleString("ru-RU")} ₽ ·{" "}
                {pay.status}
              </span>
              {pay.status !== "PAID" && (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-full bg-[#2b72f4] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  onClick={() => onMarkPaid(pay.id)}
                >
                  Отметить PAID
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
