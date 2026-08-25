"use client";

import { StatusPill, VedEmptyState } from "../VedShell";
import type { AdminBrokerRow, AdminCalc } from "./types";
import { assignBrokerOptions } from "./AdminCalcDetailDrawer";

export function BookingsPane({
  calcs,
  brokers,
  q,
  status,
  assignBrokerId,
  selectedCalcId,
  busy,
  onQ,
  onStatus,
  onAssignBrokerId,
  onReload,
  onResetFilters,
  onOpenCalc,
  onAssign,
  onEscalate,
}: {
  calcs: AdminCalc[];
  brokers: AdminBrokerRow[];
  q: string;
  status: string;
  assignBrokerId: string;
  selectedCalcId: string;
  busy: boolean;
  onQ: (v: string) => void;
  onStatus: (v: string) => void;
  onAssignBrokerId: (v: string) => void;
  onReload: () => void;
  onResetFilters: () => void;
  onOpenCalc: (id: string) => void;
  onAssign: (calcId: string, brokerUserId: string) => void;
  onEscalate: (calcId: string) => void;
}) {
  const assignOptions = assignBrokerOptions(brokers);
  const filterActive = Boolean(q.trim()) || status !== "all";
  const empty = (
    <VedEmptyState
      title={filterActive ? "Нет заявок в фильтре" : "Заявок пока нет"}
      hint={
        filterActive
          ? "Снимите поиск или статус — список обновится."
          : "Просчёты появятся после регистрации клиента и создания просчёта."
      }
      actionLabel={filterActive ? "Сбросить фильтр" : undefined}
      onAction={filterActive ? onResetFilters : undefined}
    />
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Поиск"
          value={q}
          onChange={(e) => onQ(e.target.value)}
        />
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={status}
          onChange={(e) => onStatus(e.target.value)}
        >
          <option value="all">Все статусы</option>
          {["QUEUED", "IN_REVIEW", "DONE", "SLA_RISK", "AI_READY", "AWAITING_PAYMENT"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={assignBrokerId}
          onChange={(e) => onAssignBrokerId(e.target.value)}
        >
          <option value="">Брокер для назначения</option>
          {assignOptions.map((b) => (
            <option key={b.id} value={b.user.id}>
              {b.user.name || b.user.id}
              {b.moderationStatus !== "APPROVED" ? ` (${b.moderationStatus})` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onReload}
          className="rounded-full bg-[#2b72f4] px-4 py-2 text-sm font-semibold text-white"
        >
          Обновить
        </button>
      </div>
      <div className="overflow-hidden rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[var(--kb-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">№</th>
              <th className="px-3 py-2 font-medium">Клиент</th>
              <th className="px-3 py-2 font-medium">Товар</th>
              <th className="px-3 py-2 font-medium">AI</th>
              <th className="px-3 py-2 font-medium">Брокер</th>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {calcs.map((c) => {
              const active = selectedCalcId === c.id;
              return (
                <tr
                  key={c.id}
                  aria-selected={active}
                  className={`cursor-pointer border-t border-slate-100 ${
                    active
                      ? "bg-[rgba(43,114,244,0.08)] shadow-[inset_3px_0_0_#2b72f4]"
                      : "hover:bg-slate-50/80"
                  }`}
                  onClick={() => onOpenCalc(c.id)}
                >
                  <td className="px-3 py-2 font-medium">{c.number}</td>
                  <td className="px-3 py-2">{c.company?.name || c.clientUser?.name}</td>
                  <td className="px-3 py-2">{c.title}</td>
                  <td className="px-3 py-2">
                    {c.confidence != null ? `${Math.round(c.confidence * 100)}%` : "—"}
                  </td>
                  <td className="px-3 py-2">{c.brokerUser?.name || "—"}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="space-x-1 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="text-slate-700 underline-offset-2 hover:underline"
                      onClick={() => onOpenCalc(c.id)}
                    >
                      Открыть
                    </button>
                    {assignBrokerId && ["QUEUED", "SLA_RISK", "IN_REVIEW"].includes(c.status) && (
                      <button
                        type="button"
                        disabled={busy}
                        className="text-[#2b72f4]"
                        onClick={() => onAssign(c.id, assignBrokerId)}
                      >
                        Назначить
                      </button>
                    )}
                    {["QUEUED", "IN_REVIEW"].includes(c.status) && (
                      <button
                        type="button"
                        disabled={busy}
                        className="text-red-600"
                        onClick={() => onEscalate(c.id)}
                      >
                        Эскалировать
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {calcs.length === 0 && (
              <tr>
                <td colSpan={7}>{empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
