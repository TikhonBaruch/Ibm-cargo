"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import type { Calc } from "./types";
import { clientOrderHsLabel, formatRub } from "../lbm-pane-visual";

export function ClearancePane({
  calcs,
  newCalcHref,
  ordersHref,
}: {
  calcs: Calc[];
  newCalcHref: string;
  ordersHref: string;
}) {
  const candidates = useMemo(
    () => calcs.filter((c) => c.status !== "CANCELLED"),
    [calcs],
  );
  const [id, setId] = useState(candidates[0]?.id || "");
  const order = candidates.find((c) => c.id === id) || candidates[0] || null;
  const hs = order ? clientOrderHsLabel(order) : "—";
  const checks = [
    {
      t: "Код ТН ВЭД",
      d: "Сверяем AI-черновик и подтверждаем код для декларации.",
      on: Boolean(order && hs !== "—"),
    },
    {
      t: "Платежи",
      d: "Пошлина, НДС 22% и сбор ПП 1637 — в составе заявки.",
      on: Boolean(order && (order.dutyRub != null || order.vatRub != null)),
    },
    {
      t: "Выпуск",
      d: "Пакет документов и сопровождение до выпуска.",
      on: order?.status === "DONE",
    },
  ];

  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Таможенное оформление</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Декларация, платежи и выпуск — после кода ТН ВЭД
          </p>
        </div>
        <Link href={newCalcHref} className="btn btn-primary btn-sm">
          Начать с кода
        </Link>
      </div>

      <DesignerStub
        title="Таможенное оформление (ТО)"
        intent="Дизайнер заложил отдельный модуль декларации / выпуска после кода: чек-лист, документы, запрос оформления."
        gap="В domain MVP модуля ТО нет (D27). Ниже — визуал на живых заявках; кнопка «Запросить оформление» не создаёт декларацию."
        compact
      />

      <div className="two" style={{ marginBottom: 14 }}>
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: 10 }}>Активная заявка</h3>
          {order ? (
            <>
              <div className="field">
                <label>Просчёт</label>
                <select value={order.id} onChange={(e) => setId(e.target.value)}>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.number} · {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pay-row">
                <span>№ заявки</span>
                <strong>{order.number}</strong>
              </div>
              <div className="pay-row">
                <span>ТН ВЭД</span>
                <strong>{hs}</strong>
              </div>
              <div className="pay-row">
                <span>НДС</span>
                <strong>{formatRub(order.vatRub)}</strong>
              </div>
              <div className="pay-row">
                <span>Пошлина</span>
                <strong>{formatRub(order.dutyRub)}</strong>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <Link
                  href={`${ordersHref}?id=${encodeURIComponent(order.id)}`}
                  className="btn btn-ghost btn-sm"
                >
                  Открыть
                </Link>
                <button type="button" className="btn btn-ghost btn-sm" disabled>
                  Запросить оформление
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="meta" style={{ marginBottom: 12 }}>
                Пока нет заявки для оформления. Откройте нужный просчёт в «Мои заявки».
              </p>
              <Link href={ordersHref} className="btn btn-primary btn-sm">
                К заявкам
              </Link>
            </>
          )}
        </div>

        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: 10 }}>План оформления</h3>
          {checks.map((c) => (
            <div key={c.t} className="set-row" style={{ opacity: order ? 1 : 0.7 }}>
              <div>
                <strong>{c.t}</strong>
                <div className="meta">{c.d}</div>
              </div>
              <span className={`pill ${c.on ? "ok" : ""}`}>{c.on ? "есть" : "нет"}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
