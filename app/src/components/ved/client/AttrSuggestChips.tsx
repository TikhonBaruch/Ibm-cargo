"use client";

import { useEffect, useState } from "react";
import { api } from "../VedShell";
import type { FormItem, FormItemAttrs } from "./types";
import type { AttrSuggestResult } from "@/lib/ved/attr-suggest";
import { attrSuggestHasChips } from "@/lib/ved/attr-suggest";
import { fillEmptyProductAttrs, type ProductAttrs } from "@/lib/ved/product-description";

const LABELS: Record<string, string> = {
  material: "Материал",
  composition: "Состав",
  purpose: "Назначение / тип",
  hsHint: "ТН ВЭД (черновик)",
  "extra.color": "Цвет",
  "extra.ageGroup": "Возраст",
  "extra.garmentType": "Тип изделия",
  "extra.deviceType": "Тип устройства",
};

/** ProductAttrs → form attrs (netWeightKg is string in the form). */
function toFormAttrs(
  merged: ProductAttrs | undefined,
  prev?: FormItemAttrs
): FormItemAttrs | undefined {
  if (!merged) return prev;
  const out: FormItemAttrs = { ...(prev || {}) };
  if (merged.brand !== undefined) out.brand = merged.brand;
  if (merged.material !== undefined) out.material = merged.material;
  if (merged.composition !== undefined) out.composition = merged.composition;
  if (merged.purpose !== undefined) out.purpose = merged.purpose;
  if (merged.originCountry !== undefined) out.originCountry = merged.originCountry;
  if (merged.hsHint !== undefined) out.hsHint = merged.hsHint;
  if (merged.netWeightKg !== undefined) out.netWeightKg = String(merged.netWeightKg);
  if (merged.extra) out.extra = { ...(out.extra || {}), ...merged.extra };
  return out;
}

function chipEntries(attrs: ProductAttrs): Array<{ key: string; label: string; value: string }> {
  const rows: Array<{ key: string; label: string; value: string }> = [];
  for (const key of ["material", "composition", "purpose", "hsHint"] as const) {
    const v = attrs[key];
    if (typeof v === "string" && v.trim()) {
      rows.push({ key, label: LABELS[key] || key, value: v });
    }
  }
  for (const [k, v] of Object.entries(attrs.extra || {})) {
    if (v?.trim()) {
      rows.push({
        key: `extra.${k}`,
        label: LABELS[`extra.${k}`] || k,
        value: v,
      });
    }
  }
  return rows;
}

/** D32: suggestion chips — click fills only empty attrs. */
export function AttrSuggestChips({
  title,
  description,
  item,
  itemIndex,
  items,
  onItems,
}: {
  title: string;
  description: string;
  item: FormItem;
  itemIndex: number;
  items: FormItem[];
  onItems: (next: FormItem[]) => void;
}) {
  const [result, setResult] = useState<AttrSuggestResult | null>(null);
  const [failed, setFailed] = useState(false);
  // Gate on name + title + description so tips appear as soon as the party is described.
  const hint = `${item.name || ""} ${title} ${description} ${item.attrs?.composition || ""} ${item.attrs?.material || ""}`.trim();

  useEffect(() => {
    if (hint.length < 3) {
      setResult(null);
      setFailed(false);
      return;
    }
    const t = window.setTimeout(() => {
      void api<AttrSuggestResult>("/api/v1/calculations/attr-suggest", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          name: item.name,
          existing: item.attrs || {},
        }),
      })
        .then((row) => {
          setResult(row);
          setFailed(false);
        })
        .catch(() => {
          setResult(null);
          setFailed(true);
        });
    }, 450);
    return () => window.clearTimeout(t);
  }, [hint, title, description, item.name]);

  if (hint.length < 3) {
    return (
      <p className="mb-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] leading-snug text-slate-500">
        Введите название позиции или описание партии — появятся подсказки по составу и материалу.
      </p>
    );
  }

  if (failed) {
    return (
      <p className="mb-2 text-[11px] text-slate-500">
        Подсказки временно недоступны — заполните поля вручную.
      </p>
    );
  }

  if (!result || !attrSuggestHasChips(result)) return null;
  const filled = item.attrs || {};
  const chips = chipEntries(result.attrs).filter((c) => {
    if (c.key.startsWith("extra.")) {
      const ek = c.key.slice(6);
      return !filled.extra?.[ek];
    }
    return !filled[c.key as keyof typeof filled];
  });
  if (!chips.length) return null;

  const acceptOne = (key: string, value: string) => {
    const next = [...items];
    const current = (next[itemIndex].attrs || {}) as ProductAttrs;
    const patch: ProductAttrs = {};
    if (key.startsWith("extra.")) {
      const ek = key.slice(6);
      patch.extra = { [ek]: value };
    } else if (key === "material") patch.material = value;
    else if (key === "composition") patch.composition = value;
    else if (key === "purpose") patch.purpose = value;
    else if (key === "hsHint") patch.hsHint = value;
    const merged = fillEmptyProductAttrs(current, patch);
    next[itemIndex] = {
      ...next[itemIndex],
      attrs: toFormAttrs(merged, next[itemIndex].attrs),
    };
    onItems(next);
  };

  const acceptAll = () => {
    const next = [...items];
    const merged = fillEmptyProductAttrs(
      next[itemIndex].attrs as ProductAttrs,
      result.attrs
    );
    next[itemIndex] = {
      ...next[itemIndex],
      attrs: toFormAttrs(merged, next[itemIndex].attrs),
    };
    onItems(next);
  };

  return (
    <div className="mb-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--kb-muted)]">
          Подсказки по названию. Клик подставит только пустые поля. Финал ТН ВЭД — у брокера.
        </p>
        <button
          type="button"
          className="rounded-full bg-[#2b72f4] px-3 py-1 text-[11px] font-semibold text-white"
          onClick={acceptAll}
        >
          Принять все
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-[#0f172a] hover:border-[#2b72f4]"
            onClick={() => acceptOne(c.key, c.value)}
          >
            {c.label}: {c.value}
          </button>
        ))}
      </div>
    </div>
  );
}
