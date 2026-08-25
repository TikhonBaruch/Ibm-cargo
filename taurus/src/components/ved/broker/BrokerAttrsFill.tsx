"use client";

import {
  BROKER_FILLABLE_ATTR_KEYS,
  isEmptyAttrValue,
  type BrokerFillableAttrKey,
  type ProductAttrs,
} from "@/lib/ved/product-description";
import { factoryUiEnabled } from "@/lib/ved/cabinet-features";
import { ManufacturerSuggest } from "../client/ManufacturerSuggest";

const LABELS: Record<BrokerFillableAttrKey, string> = {
  brand: "Бренд",
  material: "Материал",
  composition: "Состав",
  purpose: "Назначение",
  originCountry: "Страна (ISO2)",
  netWeightKg: "Нетто, кг",
  grossWeightKg: "Брутто, кг",
  model: "Модель",
  hsHint: "Подсказка HS",
  manufacturerName: "Производитель",
};

const NUMBER_KEYS = new Set<BrokerFillableAttrKey>(["netWeightKg", "grossWeightKg"]);

/** D32: filled chips read-only; empty keys — inline inputs (empty-attrs-only). */
export function BrokerAttrsFill({
  attrs,
  onChange,
}: {
  attrs?: ProductAttrs | null;
  onChange: (next: ProductAttrs) => void;
}) {
  const current = attrs || {};
  const factoryOn = factoryUiEnabled();
  const filled = BROKER_FILLABLE_ATTR_KEYS.filter((k) => !isEmptyAttrValue(current[k]));
  const empty = BROKER_FILLABLE_ATTR_KEYS.filter((k) => isEmptyAttrValue(current[k]));
  const needManufacturer = isEmptyAttrValue(current.manufacturerName);
  const emptyOther = empty.filter((k) => k !== "manufacturerName");

  const setKey = (key: BrokerFillableAttrKey, raw: string) => {
    const next: ProductAttrs = { ...current };
    if (NUMBER_KEYS.has(key)) {
      const n = raw.trim() === "" ? undefined : Number(raw);
      if (n == null || !Number.isFinite(n) || n < 0) {
        delete next[key];
      } else if (key === "netWeightKg") {
        next.netWeightKg = n;
      } else if (key === "grossWeightKg") {
        next.grossWeightKg = n;
      }
    } else {
      const t = raw.trim();
      if (!t) {
        delete next[key];
        onChange(next);
        return;
      }
      if (key === "originCountry") next.originCountry = t.slice(0, 2).toUpperCase();
      else if (key === "brand") next.brand = t;
      else if (key === "material") next.material = t;
      else if (key === "composition") next.composition = t;
      else if (key === "purpose") next.purpose = t;
      else if (key === "model") next.model = t;
      else if (key === "hsHint") next.hsHint = t;
      else if (key === "manufacturerName") next.manufacturerName = t;
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {filled.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-[10px] text-[#7a7f89]">
          {filled.map((k) => (
            <span
              key={k}
              className="rounded-full border border-slate-200 bg-white px-2 py-0.5"
              title="Уже задано клиентом или производителем — брокер не перезаписывает"
            >
              {LABELS[k]}: {String(current[k])}
            </span>
          ))}
        </div>
      )}
      {factoryOn && needManufacturer && (
        <ManufacturerSuggest
          value={{ manufacturerName: current.manufacturerName || "" }}
          onChange={(v) => {
            const next: ProductAttrs = { ...current };
            const name = v.manufacturerName.trim();
            if (!name) delete next.manufacturerName;
            else next.manufacturerName = name;
            const extra = { ...(next.extra || {}) };
            if (v.proposalId) extra.manufacturerProposalId = v.proposalId;
            else delete extra.manufacturerProposalId;
            if (v.companyId) extra.manufacturerCompanyId = v.companyId;
            else delete extra.manufacturerCompanyId;
            if (Object.keys(extra).length) next.extra = extra;
            else delete next.extra;
            onChange(next);
          }}
        />
      )}
      {emptyOther.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {emptyOther.map((k) => (
            <label key={k} className="block text-[10px] text-[#7a7f89]">
              {LABELS[k]}
              <input
                type={NUMBER_KEYS.has(k) ? "number" : "text"}
                step={NUMBER_KEYS.has(k) ? "0.01" : undefined}
                maxLength={k === "originCountry" ? 2 : undefined}
                className="mt-0.5 w-full rounded border px-2 py-1 text-xs text-[#0f172a]"
                value={current[k] == null || current[k] === "" ? "" : String(current[k])}
                onChange={(e) => setKey(k, e.target.value)}
                placeholder="дописать"
              />
            </label>
          ))}
        </div>
      ) : !needManufacturer ? (
        <p className="text-[10px] text-[#7a7f89]">Все основные attrs заполнены</p>
      ) : null}
    </div>
  );
}
