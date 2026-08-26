"use client";

import { landedForCalcDisplay } from "@/lib/ved/landed-cost";
import { commercialInvoiceUiEnabled } from "@/lib/ved/cabinet-features";

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

/** Invoice-style landed cost without international freight (D32). */
export function LandedWithoutFreightCard({
  calc,
  compact,
}: {
  calc: {
    aiDraft?: unknown;
    dutyRub?: number | null;
    vatRub?: number | null;
    feeRub?: number | null;
    extraFeeRub?: number | null;
    extraFeeNote?: string | null;
    items?: Array<{ qty?: number | null }> | null;
  };
  compact?: boolean;
}) {
  const snap = landedForCalcDisplay(calc);
  if (!snap) return null;
  const showInvoice = commercialInvoiceUiEnabled();

  const rows: Array<{ label: string; value: string; strong?: boolean }> = [];
  if (showInvoice) {
    rows.push({
      label: `Инвойс ${snap.invoiceAmount.toLocaleString("ru-RU")} ${snap.currency} → ТС (+${snap.bufferPct}%)`,
      value: rub(snap.goodsRub),
    });
  }
  rows.push(
    { label: "Пошлина", value: rub(snap.dutyRub) },
    { label: "НДС", value: rub(snap.vatRub) },
    { label: "Сбор", value: rub(snap.feeRub) },
  );
  if (snap.extraFeeRub > 0) {
    rows.push({
      label: calc.extraFeeNote ? `Прочие сборы · ${calc.extraFeeNote}` : "Прочие сборы",
      value: rub(snap.extraFeeRub),
    });
  }
  rows.push({
    label: showInvoice ? "Итого без доставки" : "Итого платежи",
    value: rub(showInvoice ? snap.landedRub : snap.totalPaymentsRub),
    strong: true,
  });
  if (showInvoice && snap.perUnitRub != null) {
    rows.push({ label: "На единицу", value: rub(snap.perUnitRub) });
  }

  return (
    <div
      className={
        compact
          ? "rounded-2xl bg-slate-50 px-3 py-2 text-xs"
          : "rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm"
      }
    >
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[#7a7f89]">
        Смета без международной доставки
      </div>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt className="text-[#7a7f89]">{row.label}</dt>
            <dd className={row.strong ? "font-semibold text-[#0f172a]" : "text-[#0f172a]"}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-[#7a7f89]">
        {showInvoice
          ? snap.note
          : "Пошлина, НДС и сбор — живые цифры заявки. Стоимость партии в этой смете скрыта."
      </p>
    </div>
  );
}
