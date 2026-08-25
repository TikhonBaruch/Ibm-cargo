"use client";

import { useState } from "react";
import { VedEmptyState } from "../VedShell";
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
}: {
  clients: AdminClientRow[];
  selectedCompanyId: string;
  onOpenCompany: (id: string) => void;
  usersHref?: string;
}) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const filtered = clients
    .filter((c) => matchesKind(c, kind))
    .filter((c) => (kind === "MANUFACTURER" ? true : matchesSegment(c, segment)));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Все"],
            ["CLIENT", "Импортёры"],
            ["MANUFACTURER", "Производители"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setKind(id);
              if (id === "MANUFACTURER") setSegment("all");
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              kind === id ? "bg-[#2b72f4] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {kind !== "MANUFACTURER" && (
        <div className="flex flex-wrap gap-2">
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
              onClick={() => setSegment(id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                segment === id
                  ? "bg-slate-800 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
          {kind === "MANUFACTURER" ? (
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
          )}
        </div>
      ) : (
        <ul className="space-y-2 text-sm">
          {filtered.map((c) => {
            const active = selectedCompanyId === c.id;
            const factory = c.kind === "MANUFACTURER";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-selected={active}
                  className={`flex w-full justify-between rounded-[28px] border px-4 py-3 text-left shadow-sm ${
                    active
                      ? "border-[#2b72f4]/40 bg-[rgba(43,114,244,0.08)] shadow-[inset_3px_0_0_#2b72f4]"
                      : "border-black/[0.04] bg-white hover:border-[#2b72f4]/30"
                  }`}
                  onClick={() => onOpenCompany(c.id)}
                >
                  <span>
                    {c.name}
                    {factory ? " · производитель" : ` · ${segmentLabel(c.clientSegment)}`} · ИНН {c.inn || "—"}
                    {factory
                      ? ""
                      : ` · заявок ${c._count?.calculations ?? 0}`}
                  </span>
                  <span className="font-semibold">{c.balanceRub.toLocaleString("ru-RU")} ₽</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
