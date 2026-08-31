"use client";

import { StatusPill, VedEmptyState } from "../VedShell";

export type AdminManufacturerProposal = {
  id: string;
  name: string;
  country?: string | null;
  note?: string | null;
  status: string;
  sourceRole: string;
  rejectReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  proposedByUser?: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string;
  } | null;
  approvedCompany?: { id: string; name: string; kind: string } | null;
};

export type AdminManufacturerCompany = {
  id: string;
  name: string;
  inn?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  createdAt: string;
  _count?: { manufacturerSkus?: number; users?: number };
};

/** D32: queue + list — moderate client/broker manufacturer proposals. */
export function ManufacturersPane({
  proposals,
  companies,
  statusFilter,
  onStatusFilter,
  q,
  onQ,
  busy,
  usersHref,
  onApprove,
  onReject,
  onOpenCompany,
}: {
  proposals: AdminManufacturerProposal[];
  companies: AdminManufacturerCompany[];
  statusFilter: string;
  onStatusFilter: (v: string) => void;
  q: string;
  onQ: (v: string) => void;
  busy: boolean;
  usersHref?: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onOpenCompany: (id: string) => void;
}) {
  const pending = proposals.filter((p) => p.status === "PENDING");

  return (
    <section>
      <div className="card">
        <div className="search-row">
          <select value={statusFilter} onChange={(e) => onStatusFilter(e.target.value)}>
            <option value="PENDING">Ожидают</option>
            <option value="APPROVED">Утверждённые</option>
            <option value="REJECTED">Отклонённые</option>
            <option value="all">Все</option>
          </select>
          <input
            type="search"
            placeholder="Название…"
            value={q}
            onChange={(e) => onQ(e.target.value)}
          />
        </div>
        <div className="card-head">
          <div>
            <h3>Очередь на утверждение</h3>
            <p>
              Клиент или брокер могут добавить имя сразу. В постоянный каталог — только после вашего
              подтверждения (создаётся компания MANUFACTURER без логина
              {usersHref ? (
                <>
                  ; инвайт — в{" "}
                  <a href={usersHref}>Пользователях</a>
                </>
              ) : (
                "; инвайт — в Пользователях"
              )}
              ).
            </p>
          </div>
        </div>
        {!pending.length && statusFilter === "PENDING" ? (
          <VedEmptyState
            title="Нет ожидающих предложений"
            hint="Когда клиент или брокер добавят производителя, он появится здесь."
          />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Источник</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    {p.country ? <div className="meta">{p.country}</div> : null}
                    {p.note ? <div className="meta">{p.note}</div> : null}
                    {p.rejectReason ? <div className="meta">{p.rejectReason}</div> : null}
                    {p.approvedCompany ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onOpenCompany(p.approvedCompany!.id)}
                      >
                        Компания {p.approvedCompany.name}
                      </button>
                    ) : null}
                  </td>
                  <td>
                    {p.sourceRole}
                    {p.proposedByUser?.email ? ` · ${p.proposedByUser.email}` : ""}
                  </td>
                  <td>
                    <StatusPill status={p.status} />
                  </td>
                  <td>
                    {p.status === "PENDING" ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={busy}
                          className="btn btn-primary btn-sm"
                          onClick={() => onApprove(p.id)}
                        >
                          Утвердить
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="btn btn-danger btn-sm"
                          onClick={() => onReject(p.id)}
                        >
                          Отклонить
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Постоянный каталог</h3>
            <p>Компании kind=MANUFACTURER — видны всем в подсказках. Дополнить реквизиты — в карточке.</p>
          </div>
        </div>
        {!companies.length ? (
          <p className="meta">Пока пусто.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Компания</th>
                <th>ИНН</th>
                <th>SKU</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => onOpenCompany(c.id)}>
                  <td>{c.name}</td>
                  <td>{c.inn || "—"}</td>
                  <td>
                    {c._count?.manufacturerSkus ?? 0} · users {c._count?.users ?? 0}
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm">
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
