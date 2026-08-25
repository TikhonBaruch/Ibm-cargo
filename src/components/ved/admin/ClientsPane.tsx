"use client";

import { useState } from "react";
import { VedEmptyState } from "../VedShell";
import { formatRub } from "../lbm-pane-visual";
import { CLIENT_SEGMENT_LABELS, type ClientSegment } from "@/lib/ved/sku-order";
import type { AdminClientRow } from "./types";

type KindFilter = "all" | "CLIENT" | "MANUFACTURER";
type SegmentFilter = "all" | ClientSegment;

function matchesKind(c: AdminClientRow, f: KindFilter): boolean {
  if (f === "all") return true;
  if (f === "MANUFACTURER") return c.kind === "MANUFACTURER";
  return c.kind !== "MANUFACTURER";
}

function matchesSegment(c: AdminClientRow, f: SegmentFilter): boolean {
  if (f === "all") return true;
  if (c.kind === "MANUFACTURER") return false;
  return (c.clientSegment || "SINGLE") === f;
}

function segmentLabel(code?: string | null) {
  if (!code) return CLIENT_SEGMENT_LABELS.SINGLE;
  return CLIENT_SEGMENT_LABELS[code as ClientSegment] || code;
}

export function ClientsPane({
  clients,
  selectedCompanyId,
  onOpenCompany,
  usersHref = "/admin/users",
  showManufacturers = true,
}: {
  clients: AdminClientRow[];
  selectedCompanyId: string;
  onOpenCompany: (id: string) => void;
  usersHref?: string;
  showManufacturers?: boolean;
}) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const kindFilter: KindFilter = showManufacturers ? kind : "CLIENT";
  const filtered = clients
    .filter((c) => matchesKind(c, kindFilter))
    .filter((c) => (kindFilter === "MANUFACTURER" ? true : matchesSegment(c, segment)));

  const importers = clients.filter((c) => c.kind !== "MANUFACTURER");
  const makers = clients.filter((c) => c.kind === "MANUFACTURER");
  const avgBalance =
    importers.length > 0
      ? Math.round(importers.reduce((s, c) => s + c.balanceRub, 0) / importers.length)
      : 0;
  const calcCount = importers.reduce((s, c) => s + (c._count?.calculations ?? 0), 0);

  return (
    <section>
      <div className="stats">
        <div className="stat">
          <div className="v">{importers.length}</div>
          <div className="k">Импортёров</div>
        </div>
        {showManufacturers ? (
          <div className="stat">
            <div className="v">{makers.length}</div>
            <div className="k">Производителей</div>
          </div>
        ) : null}
        <div className="stat">
          <div className="v">{formatRub(avgBalance)}</div>
          <div className="k">Средний баланс</div>
        </div>
        <div className="stat">
          <div className="v">{calcCount}</div>
          <div className="k">Заявок всего</div>
        </div>
      </div>
      <div className="card">
        <div className="filter-chips">
          {(
            (
              [
                ["all", "Все"],
                ["CLIENT", "Импортёры"],
                ["MANUFACTURER", "Производители"],
              ] as const
            ).filter(([id]) => showManufacturers || id !== "MANUFACTURER")
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={kind === id ? "on" : ""}
              onClick={() => {
                setKind(id);
                if (id === "MANUFACTURER") setSegment("all");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {kind !== "MANUFACTURER" && (
          <div className="filter-chips">
            {(
              [
                ["all", "Все режимы"],
                ["SINGLE", "Единичные"],
                ["RETAIL_SMALL", "Розница"],
                ["WHOLESALE", "Опт"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={segment === id ? "on" : ""}
                onClick={() => setSegment(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {filtered.length === 0 ? (
          kindFilter === "MANUFACTURER" ? (
            <VedEmptyState
              title="Нет компаний-производителей"
              hint="Производитель: инвайт ADMIN или утверждение предложения из клиента/брокера."
              actionLabel="К пользователям"
              actionHref={usersHref}
            />
          ) : clients.length === 0 ? (
            <VedEmptyState
              title="Нет компаний"
              hint="Клиентские компании появятся после регистрации на /register (D25)."
            />
          ) : (
            <VedEmptyState
              title="Нет компаний в этом фильтре"
              hint="Сбросьте фильтр, чтобы увидеть все компании."
              actionLabel="Все компании"
              onAction={() => {
                setKind("all");
                setSegment("all");
              }}
            />
          )
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Компания</th>
                <th>ИНН</th>
                <th>Режим</th>
                <th>Баланс</th>
                <th>Заявок</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const active = selectedCompanyId === c.id;
                const factory = c.kind === "MANUFACTURER";
                return (
                  <tr
                    key={c.id}
                    className={`clickable${active ? " is-open" : ""}`}
                    onClick={() => onOpenCompany(c.id)}
                  >
                    <td>{c.name}</td>
                    <td>{c.inn || "—"}</td>
                    <td>{factory ? "Производитель" : segmentLabel(c.clientSegment)}</td>
                    <td>{formatRub(c.balanceRub)}</td>
                    <td>{factory ? "—" : c._count?.calculations ?? 0}</td>
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
