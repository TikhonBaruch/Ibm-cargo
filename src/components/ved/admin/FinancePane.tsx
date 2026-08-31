"use client";

import { VedEmptyState } from "../VedShell";
import { formatRub, payoutStatusPill } from "../lbm-pane-visual";
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
  const readySum = payoutReady.reduce((s, x) => s + x.amountRub, 0);

  return (
    <section>
      <div className="stats">
        <div className="stat">
          <div className="v">{clients.length}</div>
          <div className="k">Компаний</div>
        </div>
        <div className="stat">
          <div className="v">{payoutReady.length}</div>
          <div className="k">К выплате</div>
        </div>
        <div className="stat">
          <div className="v">{formatRub(readySum)}</div>
          <div className="k">Сумма ACCRUED+</div>
        </div>
      </div>
      <div className="two">
        <div className="card">
          <h3>Балансы компаний</h3>
          {clients.length === 0 ? (
            <VedEmptyState
              title="Нет компаний"
              hint="Клиентские компании появятся после регистрации на /register."
            />
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Компания</th>
                  <th>Баланс</th>
                </tr>
              </thead>
              <tbody>
                {clients.slice(0, 8).map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{formatRub(c.balanceRub)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Очередь выплат</h3>
              <p>Доля брокера · статусы меняет admin</p>
            </div>
          </div>
          <div className="search-row">
            <select
              value={payoutStatusFilter}
              onChange={(e) => onFilter(e.target.value as PayoutStatusFilter)}
            >
              <option value="ALL">Все статусы</option>
              <option value="ACCRUED">Начисление</option>
              <option value="DOCS_REQUESTED">Документы</option>
              <option value="PAID">Выплачено</option>
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onExportCsv}>
              Экспорт CSV
            </button>
          </div>
          {payoutsEmpty ? (
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
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Брокер</th>
                  <th>Период</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.map((pay) => {
                  const pill = payoutStatusPill(pay.status);
                  return (
                    <tr key={pay.id}>
                      <td>{pay.brokerProfile?.user?.name || "—"}</td>
                      <td>{pay.periodLabel}</td>
                      <td>{formatRub(pay.amountRub)}</td>
                      <td>
                        <span className={`pill ${pill.cls}`}>{pill.label}</span>
                      </td>
                      <td>
                        {pay.status !== "PAID" && (
                          <button
                            type="button"
                            disabled={busy}
                            className="btn btn-primary btn-sm"
                            onClick={() => onMarkPaid(pay.id)}
                          >
                            Отметить PAID
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
