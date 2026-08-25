"use client";

import type { ReactNode } from "react";
import type { CalcForm, FormItem } from "./types";

/** D32: field label + optional hint (Dashboard quick-calc style). */
export function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  /** Combobox / nested buttons: kept for callers; label never wraps the control. */
  as?: "label" | "div";
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {hint ? <span className="meta">{hint}</span> : null}
      {children}
    </div>
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
    <div role="status" className="alert-box" style={{ background: "var(--blue-soft)", borderColor: "rgba(43,114,244,.2)", color: "var(--blue-2)" }}>
      <strong>Подсказка</strong>
      {text}
    </div>
  );
}
