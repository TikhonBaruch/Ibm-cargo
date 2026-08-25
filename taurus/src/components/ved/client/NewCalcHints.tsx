"use client";

import type { ReactNode } from "react";
import type { CalcForm, FormItem } from "./types";

/** D32: field label + optional hint (Dashboard quick-calc style). */
export function FieldLabel({
  label,
  hint,
  children,
  as = "label",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  /** Combobox / nested buttons: use div so the list is not inside a <label>. */
  as?: "label" | "div";
}) {
  const Tag = as;
  return (
    <Tag className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      {hint ? <span className="mb-1.5 block text-[11px] leading-snug text-[var(--kb-muted)]">{hint}</span> : null}
      {children}
    </Tag>
  );
}

/** One progressive tip for the current fill stage (not a wizard). */
export function newCalcStageTip({
  form,
  items,
  hsCandidateCount,
  maxPos,
  hasCatalog,
  needsAttrsHint,
}: {
  form: CalcForm;
  items: FormItem[];
  hsCandidateCount: number;
  maxPos: number;
  hasCatalog: boolean;
  needsAttrsHint: boolean;
}): string | null {
  const titleOk = form.title.trim().length > 0;
  const descOk = form.description.trim().length > 0;
  const hasItem = items.some((i) => i.name.trim() || i.manufacturerSkuId);
  const hasHs = items.some((i) => i.attrs?.hsHint?.trim());

  if (!titleOk || !descOk) {
    return "Сначала наименование и описание партии — по ним появится черновик ТН ВЭД.";
  }
  if (hsCandidateCount > 0 && !hasHs) {
    return "Ниже — черновик кода по правилам. Клик подставит подсказку в позицию (финал — у брокера).";
  }
  if (!hasItem) {
    return hasCatalog
      ? "Укажите название позиции или эталон SKU производителя. Много строк — таблица CSV ниже."
      : "Укажите название позиции. Много строк из таблицы — блок CSV ниже.";
  }
  const missingRequired = items.some((i) => {
    if (!i.name.trim() && !i.manufacturerSkuId) return false;
    const a = i.attrs;
    const origin = String(a?.originCountry || "").trim();
    return (
      origin.length !== 2 ||
      !String(a?.manufacturerName || "").trim() ||
      !String(a?.composition || "").trim()
    );
  });
  if (missingRequired) {
    return "Обязательно по позиции: страна происхождения (CN…), производитель и состав — без этого заявка не уйдёт.";
  }
  if (!hasHs) {
    return "Найдите код в справочнике по названию товара. Финал подтвердит брокер.";
  }
  if (needsAttrsHint) {
    return null;
  }
  if (items.length < maxPos && maxPos > 1) {
    return `Тариф позволяет до ${maxPos} позиций. «+ позиция» — ещё одна строка.`;
  }
  return null;
}

/**
 * D32 contextual help: one visible tip (not wizard).
 * Not sticky — sticky top-0 fights VedShell header + mobile nav and stacks over form controls.
 */
export function StageTip({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-[12px] leading-snug text-sky-950 shadow-sm"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700/80">Подсказка</p>
      <p className="mt-0.5">{text}</p>
    </div>
  );
}
