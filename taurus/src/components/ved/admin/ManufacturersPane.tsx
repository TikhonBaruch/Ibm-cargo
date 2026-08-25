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
    <section className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Статус предложений</span>
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => onStatusFilter(e.target.value)}
          >
            <option value="PENDING">Ожидают</option>
            <option value="APPROVED">Утверждённые</option>
            <option value="REJECTED">Отклонённые</option>
            <option value="all">Все</option>
          </select>
        </label>
        <label className="block min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Поиск</span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Название…"
            value={q}
            onChange={(e) => onQ(e.target.value)}
          />
        </label>
      </div>

      <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0f172a]">Очередь на утверждение</h3>
        <p className="mt-1 text-xs text-[var(--kb-muted)]">
          Клиент или брокер могут добавить имя сразу. В постоянный каталог — только после вашего
          подтверждения (создаётся компания MANUFACTURER без логина
          {usersHref ? (
            <>
              ; инвайт — в{" "}
              <a href={usersHref} className="text-[#2b72f4]">
                Пользователях
              </a>
            </>
          ) : (
            "; инвайт — в Пользователях"
          )}
          ).
        </p>
        {!pending.length && statusFilter === "PENDING" ? (
          <div className="mt-4">
            <VedEmptyState
              title="Нет ожидающих предложений"
              hint="Когда клиент или брокер добавят производителя, он появится здесь."
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {proposals.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 px-3 py-3"
              >
                <div>
                  <p className="font-medium text-[#0f172a]">{p.name}</p>
                  <p className="text-xs text-[var(--kb-muted)]">
                    {p.sourceRole}
                    {p.proposedByUser?.email ? ` · ${p.proposedByUser.email}` : ""}
                    {p.country ? ` · ${p.country}` : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                  {p.rejectReason ? (
                    <p className="mt-1 text-xs text-red-700">{p.rejectReason}</p>
                  ) : null}
                  {p.approvedCompany ? (
                    <button
                      type="button"
                      className="mt-1 text-xs text-[#2b72f4]"
                      onClick={() => onOpenCompany(p.approvedCompany!.id)}
                    >
                      Компания {p.approvedCompany.name}
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={p.status} />
                  {p.status === "PENDING" ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-full bg-[#2b72f4] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        onClick={() => onApprove(p.id)}
                      >
                        Утвердить
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-50"
                        onClick={() => onReject(p.id)}
                      >
                        Отклонить
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0f172a]">Постоянный каталог</h3>
        <p className="mt-1 text-xs text-[var(--kb-muted)]">
          Компании kind=MANUFACTURER — видны всем в подсказках. Дополнить реквизиты — в карточке.
        </p>
        {!companies.length ? (
          <p className="mt-3 text-sm text-[var(--kb-muted)]">Пока пусто.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {companies.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-100 px-3 py-3 text-left hover:bg-slate-50"
                  onClick={() => onOpenCompany(c.id)}
                >
                  <span>
                    <span className="font-medium">{c.name}</span>
                    <span className="mt-0.5 block text-xs text-[var(--kb-muted)]">
                      ИНН {c.inn || "—"} · SKU {c._count?.manufacturerSkus ?? 0} · users{" "}
                      {c._count?.users ?? 0}
                    </span>
                  </span>
                  <span className="text-xs text-[#2b72f4]">Открыть</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
