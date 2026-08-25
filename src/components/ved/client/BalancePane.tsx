"use client";

import { useRef } from "react";
import { VedEmptyState } from "../VedShell";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
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
  const balance = me?.company?.balanceRub ?? 0;
  const ledger = me?.company?.ledger || [];
  const added = ledger.filter((l) => l.amountRub > 0).reduce((s, l) => s + l.amountRub, 0);
  const spent = ledger.filter((l) => l.amountRub < 0).reduce((s, l) => s + Math.abs(l.amountRub), 0);

  return (
    <section>
      {pendingHint && (
        <div className="card" style={{ marginBottom: 14, borderColor: "rgba(245,158,11,.45)" }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            {pendingHint}{" "}
            {onRefresh ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh}>
                Обновить баланс
              </button>
            ) : null}
          </p>
        </div>
      )}
      <div className="two">
        <div className="cl-wallet">
          <div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Доступно к списанию</div>
            <div className="v">{Math.round(balance).toLocaleString("ru-RU")} ₽</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.85, gap: 12 }}>
            <span>Пополнено {added.toLocaleString("ru-RU")} ₽</span>
            <span>Списано {spent.toLocaleString("ru-RU")} ₽</span>
          </div>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <h3>Пополнить</h3>
          <div className="amt-chips">
            {[5000, 10000, 25000].map((v) => (
              <button
                key={v}
                type="button"
                className={topup === v ? "on" : ""}
                onClick={() => onTopupAmount(v)}
              >
                {v.toLocaleString("ru-RU")}
              </button>
            ))}
          </div>
          <div className="field">
            <label>Сумма, ₽</label>
            <input
              ref={topupRef}
              type="number"
              value={topup}
              onChange={(e) => onTopupAmount(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Способ</label>
            <div className="filter-chips">
              {(["stub", "card", "sbp"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={topupMethod === m ? "on" : ""}
                  onClick={() => onTopupMethod(m)}
                >
                  {m === "stub" ? "Демо (stub)" : m === "card" ? "Карта" : "СБП"}
                </button>
              ))}
            </div>
          </div>
          <p className="meta">
            «Демо» — mock-пополнение (если разрешено). Карта/СБП — ЮKassa → webhook TOPUP. Списание
            тарифа отдельно при оплате просчёта.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || topup <= 0}
            onClick={onTopup}
            style={{ marginTop: 12 }}
          >
            Пополнить
          </button>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>История</h3>
        <div className="activity-list">
          {ledger.map((l) => (
            <div key={l.id} className="activity-item">
              <div className={`dot ${l.amountRub >= 0 ? "ok" : "warn"}`} />
              <div>
                <strong>
                  {l.amountRub >= 0 ? "+" : ""}
                  {l.amountRub.toLocaleString("ru-RU")} ₽
                </strong>
                <span>
                  {l.description || "Операция"} · {new Date(l.createdAt).toLocaleString("ru-RU")}
                </span>
              </div>
            </div>
          ))}
          {ledger.length === 0 ? (
            <VedEmptyState
              title="Пока нет операций"
              hint="Пополните баланс, затем оплатите просчёт в заявке."
              actionLabel="Пополнить"
              onAction={() => topupRef.current?.focus()}
            />
          ) : null}
        </div>
      </div>
      <DesignerStub
        title="Счёт для юрлица"
        intent="В макете третий способ пополнения — счёт / безнал для юрлица."
        gap="Live topup: stub / карта / СБП. Отдельного счета-оферты нет."
        compact
      />
    </section>
  );
}
