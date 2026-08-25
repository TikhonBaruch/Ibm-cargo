"use client";

import { useRef } from "react";
import { VedEmptyState } from "../VedShell";
import type { Me } from "./types";

export function BalancePane({
  me,
  topup,
  topupMethod,
  busy,
  pendingHint,
  onTopupAmount,
  onTopupMethod,
  onTopup,
  onRefresh,
}: {
  me: Me | null;
  topup: number;
  topupMethod: "stub" | "card" | "sbp";
  busy: boolean;
  pendingHint?: string;
  onTopupAmount: (n: number) => void;
  onTopupMethod: (m: "stub" | "card" | "sbp") => void;
  onTopup: () => void;
  onRefresh?: () => void;
}) {
  const topupRef = useRef<HTMLInputElement>(null);

  return (
    <section className="space-y-5">
      {pendingHint && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {pendingHint}{" "}
          {onRefresh && (
            <button type="button" className="ml-2 font-semibold underline" onClick={onRefresh}>
              Обновить баланс
            </button>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="text-sm text-[var(--kb-muted)]">Доступно</div>
          <div className="mt-1 text-3xl font-extrabold" style={{ fontFamily: "var(--kb-font-display)" }}>
            {(me?.company?.balanceRub ?? 0).toLocaleString("ru-RU")} ₽
          </div>
        </div>
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="text-sm text-[var(--kb-muted)]">Пополнить</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["stub", "card", "sbp"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onTopupMethod(m)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  topupMethod === m
                    ? "bg-[#2b72f4] text-white"
                    : "border border-slate-200 text-[var(--kb-muted)]"
                }`}
              >
                {m === "stub" ? "Демо (stub)" : m === "card" ? "Карта" : "СБП"}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              ref={topupRef}
              type="number"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={topup}
              onChange={(e) => onTopupAmount(Number(e.target.value))}
            />
            <button
              type="button"
              disabled={busy || topup <= 0}
              onClick={onTopup}
              className="rounded-full bg-[#2b72f4] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Пополнить
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--kb-muted)]">
            «Демо» — mock-пополнение (только если разрешено). Карта/СБП — ЮKassa → webhook TOPUP.
            Списание тарифа отдельно при оплате просчёта (D13).
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
        <div className="border-b border-black/[0.04] px-5 py-4">
          <h2 className="font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
            История ledger
          </h2>
        </div>
        <ul className="divide-y divide-slate-100 text-sm">
          {(me?.company?.ledger || []).map((l) => (
            <li key={l.id} className="flex justify-between gap-3 px-5 py-3">
              <span className="text-[var(--kb-muted)]">
                {l.description || "Операция"}
                <span className="ml-2 text-xs">
                  {new Date(l.createdAt).toLocaleString("ru-RU")}
                </span>
              </span>
              <span className={`font-semibold ${l.amountRub >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {l.amountRub >= 0 ? "+" : ""}
                {l.amountRub.toLocaleString("ru-RU")} ₽
              </span>
            </li>
          ))}
          {(me?.company?.ledger || []).length === 0 && (
            <li>
              <VedEmptyState
                title="Пока нет операций"
                hint="Пополните баланс, затем оплатите просчёт в заявке."
                actionLabel="Пополнить"
                onAction={() => topupRef.current?.focus()}
              />
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
