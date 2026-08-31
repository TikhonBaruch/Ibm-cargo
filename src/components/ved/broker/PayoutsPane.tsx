"use client";

import { VedEmptyState } from "../VedShell";
import { formatRub, payoutStatusPill } from "../lbm-pane-visual";
import type { PayoutRow } from "./types";

export function PayoutsPane({ payouts }: { payouts: PayoutRow[] }) {
  const totalAccrued = payouts
    .filter((p) => p.status === "ACCRUED" || p.status === "DOCS_REQUESTED")
    .reduce((s, p) => s + p.amountRub, 0);
  const totalPaid = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amountRub, 0);
  const jobs = payouts.reduce((s, p) => s + p.jobsCount, 0);

  return (
    <section>
      <div className="stats">
        <div className="stat">
          <div className="v">{formatRub(totalAccrued)}</div>
          <div className="k">Начислено</div>
        </div>
        <div className="stat">
          <div className="v">{formatRub(totalPaid)}</div>
          <div className="k">Выплачено</div>
        </div>
        <div className="stat">
          <div className="v">{jobs}</div>
          <div className="k">Заявок в breakdown</div>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Выплаты</h3>
            <p>Сумма = jobs × brokerSharePct тарифа. Статусы DOCS_REQUESTED / PAID меняет только admin.</p>
          </div>
        </div>
        {payouts.length === 0 ? (
          <VedEmptyState
            title="Пока нет начислений"
            hint="Доля тарифа начисляется после approve — когда клиент получит PDF."
          />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Период</th>
                <th>Заявок</th>
                <th>Сумма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const pill = payoutStatusPill(p.status);
                return (
                  <tr key={p.id}>
                    <td>{p.periodLabel}</td>
                    <td>{p.jobsCount}</td>
                    <td>{formatRub(p.amountRub)}</td>
                    <td>
                      <span className={`pill ${pill.cls}`}>{pill.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
