"use client";

import { HsLinesTable } from "@/lbm-bro/components/hs-lines";
import { fmt } from "@/lbm-bro/lib/format";
import { resolvePayments, type PackPayLine, type PaymentDraft } from "@/lbm-bro/lib/payments";
import type { HsLine } from "@/lbm-bro/lib/types";

export function PaymentsForm({
  value,
  onChange,
  hs,
  tariffPaid,
  locked = false,
  lines,
}: {
  value: PaymentDraft;
  onChange: (patch: Partial<PaymentDraft>) => void;
  hs: string;
  tariffPaid: number;
  /** Скрывает пошлину/НДС до оплаты расчёта */
  locked?: boolean;
  /** Позиции пакета — каждая со своим кодом ТН ВЭД */
  lines?: HsLine[] | PackPayLine[];
}) {
  const codedLines = (lines ?? []).filter((l) => l.hs && l.hs !== "—");
  const isPack = codedLines.length >= 2;
  const p = resolvePayments({
    price: value.price,
    currency: value.currency,
    hs,
    lines: codedLines,
  });
  const ratePct = Math.round(p.rate * 1000) / 10;

  return (
    <>
      <div className="two">
        <div className="field">
          <label>Куда в РФ</label>
          <select value={value.city} onChange={(e) => onChange({ city: e.target.value })}>
            <option>Москва</option>
            <option>Санкт-Петербург</option>
            <option>Владивосток</option>
            <option>Новороссийск</option>
            <option>Екатерибург</option>
          </select>
        </div>
        <div className="field">
          <label>Условия поставки</label>
          <select value={value.incoterm} onChange={(e) => onChange({ incoterm: e.target.value })}>
            <option>EXW</option>
            <option>FOB</option>
            <option>CIF</option>
            <option>CFR</option>
            <option>DAP</option>
            <option>DDP</option>
          </select>
          <span className="meta">Как в контракте / инвойсе</span>
        </div>
      </div>

      <div className="field">
        <label>Таможенная стоимость партии</label>
        <div className="wiz-money">
          <input type="number" min={0} value={value.price} onChange={(e) => onChange({ price: e.target.value })} />
          <select value={value.currency} onChange={(e) => onChange({ currency: e.target.value })} aria-label="Валюта">
            <option>USD</option>
            <option>EUR</option>
            <option>CNY</option>
          </select>
        </div>
        <span className="meta">
          {isPack
            ? `По инвойсу на ${codedLines.length} позиций · курс демо ${p.fx} ₽`
            : `По инвойсу, без доставки по РФ · курс демо ${p.fx} ₽`}
        </span>
      </div>

      <div className="three">
        <div className="field">
          <label>Количество, шт</label>
          <input type="number" min={0} placeholder="например 200" value={value.qty} onChange={(e) => onChange({ qty: e.target.value })} />
        </div>
        <div className="field">
          <label>Вес брутто, кг</label>
          <input type="number" min={0} placeholder="например 48" value={value.weightKg} onChange={(e) => onChange({ weightKg: e.target.value })} />
        </div>
        <div className="field">
          <label>Мест / коробок</label>
          <input type="number" min={0} placeholder="например 4" value={value.places} onChange={(e) => onChange({ places: e.target.value })} />
        </div>
      </div>

      {isPack ? (
        <div style={{ marginTop: 8, marginBottom: 4 }}>
          <div className="pay-row" style={{ marginBottom: 8 }}>
            <span>Коды ТН ВЭД</span>
            <strong>{codedLines.length} позиций</strong>
          </div>
          <HsLinesTable lines={codedLines as HsLine[]} compact />
        </div>
      ) : null}

      {locked ? (
        <div className="wiz-pay-box" style={{ marginTop: 8 }}>
          {!isPack ? (
            <div className="pay-row"><span>Код ТН ВЭД</span><strong>{hs || "—"}</strong></div>
          ) : null}
          <p className="meta" style={{ margin: "10px 0 0" }}>
            {isPack
              ? "Заполните партию и оплатите расчёт — пошлина и НДС по каждой позиции появятся после оплаты."
              : "Заполните партию слева и оплатите расчёт — пошлина, НДС и PDF появятся после оплаты."}
          </p>
        </div>
      ) : (
        <div className="wiz-pay-box" style={{ marginTop: 8 }}>
          {!isPack ? (
            <div className="pay-row"><span>Код ТН ВЭД</span><strong>{hs || "—"}</strong></div>
          ) : null}
          <div className="pay-row"><span>Таможенная стоимость</span><strong>{fmt(p.cv)} ₽</strong></div>
          <div className="pay-row">
            <span>{isPack ? `Пошлина (сумма по ${codedLines.length} кодам)` : `Пошлина ${ratePct}%`}</span>
            <strong>{fmt(p.duty)} ₽</strong>
          </div>
          <div className="pay-row"><span>НДС 20%</span><strong>{fmt(p.vat)} ₽</strong></div>
          <div className="pay-row"><span>Таможенный сбор (ориентир)</span><strong>{fmt(p.fee)} ₽</strong></div>
          <div className="pay-row total"><span>К уплате на таможне</span><strong>{fmt(p.total)} ₽</strong></div>
          <p className="meta" style={{ margin: "10px 0 0" }}>
            Тариф проверки {fmt(tariffPaid)} ₽ уже оплачен — в таможенные платежи не входит.
          </p>
        </div>
      )}
    </>
  );
}
