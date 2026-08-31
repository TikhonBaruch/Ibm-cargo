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
    <div className="card">
      <div className="card-head">
        <div>
          <h3>Все заявки на просчёт</h3>
          <p>Фильтр по статусу и брокеру · live D8</p>
        </div>
        <button type="button" onClick={onReload} className="btn btn-ghost btn-sm">
          Обновить
        </button>
      </div>
      <div className="search-row">
        <input
          type="search"
          placeholder="Поиск по №, клиенту, товару…"
          value={q}
          onChange={(e) => onQ(e.target.value)}
        />
        <select value={status} onChange={(e) => onStatus(e.target.value)}>
          <option value="all">Все статусы</option>
          {["QUEUED", "IN_REVIEW", "DONE", "SLA_RISK", "AI_READY", "AWAITING_PAYMENT"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={assignBrokerId} onChange={(e) => onAssignBrokerId(e.target.value)}>
          <option value="">Брокер для назначения</option>
          {assignOptions.map((b) => (
            <option key={b.id} value={b.user.id}>
              {b.user.name || b.user.id}
              {b.moderationStatus !== "APPROVED" ? ` (${b.moderationStatus})` : ""}
            </option>
          ))}
        </select>
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>№</th>
            <th>Клиент</th>
            <th>Товар</th>
            <th>AI</th>
            <th>Брокер</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {calcs.map((c) => {
            const active = selectedCalcId === c.id;
            return (
              <tr
                key={c.id}
                aria-selected={active}
                className={`clickable${active ? " is-open" : ""}`}
                onClick={() => onOpenCalc(c.id)}
              >
                <td>{c.number}</td>
                <td>{c.company?.name || c.clientUser?.name}</td>
                <td>{c.title}</td>
                <td>{c.confidence != null ? `${Math.round(c.confidence * 100)}%` : "—"}</td>
                <td>{c.brokerUser?.name || "—"}</td>
                <td>
                  <StatusPill status={c.status} />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenCalc(c.id)}>
                      Открыть
                    </button>
                    {assignBrokerId && ["QUEUED", "SLA_RISK", "IN_REVIEW"].includes(c.status) && (
                      <button
                        type="button"
                        disabled={busy}
                        className="btn btn-primary btn-sm"
                        onClick={() => onAssign(c.id, assignBrokerId)}
                      >
                        Назначить
                      </button>
                    )}
                    {["QUEUED", "IN_REVIEW"].includes(c.status) && (
                      <button
                        type="button"
                        disabled={busy}
                        className="btn btn-danger btn-sm"
                        onClick={() => onEscalate(c.id)}
                      >
                        Эскалировать
                      </button>
                    )}
                  </div>
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
  );
}
