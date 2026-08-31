"use client";

import Link from "next/link";
import { useState } from "react";

export function GuidePane({
  homeHref,
  newCalcHref,
  tnvedHref,
  ordersHref,
  supportHref,
}: {
  homeHref: string;
  newCalcHref: string;
  tnvedHref: string;
  ordersHref: string;
  supportHref: string;
}) {
  const [active, setActive] = useState(0);
  const steps = [
    {
      t: "Найдите код или опишите товар",
      d: "Справочник ТН ВЭД или новый просчёт — heuristic готовит черновик.",
      detail:
        "Поиск идёт в живой справочник /api/v1/tnved/search, не в браузерный tnved.json. Бесплатного «одного пика» нет — это замысел макета.",
      href: tnvedHref,
      btn: "Открыть справочник",
    },
    {
      t: "Оплатите тариф",
      d: "EXPRESS 1 / STANDARD до 3 / PRO до 10 позиций. Списание с баланса компании.",
      detail:
        "Брокер видит заявку только после оплаты (D11). EXPRESS при высокой уверенности может закрыться без очереди.",
      href: newCalcHref,
      btn: "Новый просчёт",
    },
    {
      t: "Брокер подтверждает код",
      d: "STANDARD и PRO — очередь QC. EXPRESS — AI при high conf.",
      detail:
        "Брокер правит HS / пошлину / НДС / сбор. НДС в смете 22%, таможенный сбор — ПП 1637.",
      href: ordersHref,
      btn: "К моим заявкам",
    },
    {
      t: "Скачайте PDF",
      d: "Deliverable MVP — файл с кодами и платежами.",
      detail:
        "Перевозка и таможенное оформление «под ключ» в макете есть, в domain MVP — hold / stub.",
      href: ordersHref,
      btn: "Открыть заявки",
    },
  ] as const;

  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Как пользоваться</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            ТН ВЭД → оплата → брокер-QC → PDF
          </p>
        </div>
        <Link href={newCalcHref} className="btn btn-primary btn-sm">
          Начать
        </Link>
      </div>

      <div className="two" style={{ alignItems: "start" }}>
        <div>
          {steps.map((s, i) => (
            <div
              key={s.t}
              className="guide-step"
              role="button"
              tabIndex={0}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setActive(i);
              }}
              style={{
                cursor: "pointer",
                borderColor: active === i ? "rgba(43,114,244,.55)" : undefined,
                boxShadow: active === i ? "0 12px 28px rgba(43,114,244,.14)" : undefined,
              }}
            >
              <div className="n">{i + 1}</div>
              <div>
                <strong>{s.t}</strong>
                <p className="meta">{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: 10 }}>{steps[active].t}</h3>
          <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14, lineHeight: 1.55 }}>
            {steps[active].detail}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <Link href={steps[active].href} className="btn btn-primary btn-sm">
              {steps[active].btn}
            </Link>
            <Link href={supportHref} className="btn btn-ghost btn-sm">
              Если вопросы — в чат
            </Link>
            <Link href={homeHref} className="btn btn-ghost btn-sm">
              На главную
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
