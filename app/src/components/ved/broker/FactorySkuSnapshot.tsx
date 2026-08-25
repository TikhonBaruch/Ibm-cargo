"use client";

import { factorySkuSnapshotLine } from "./types";

/** D32: read-only callout. Broker does not edit the factory catalog (D15/D31). */
export function FactorySkuSnapshot({
  manufacturerSkuId,
  attrs,
}: {
  manufacturerSkuId?: string | null;
  attrs?: Parameters<typeof factorySkuSnapshotLine>[0]["attrs"];
}) {
  const line = factorySkuSnapshotLine({ manufacturerSkuId, attrs });
  if (!line) return null;
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-[#7a7f89]">
      <p className="font-medium text-[#0f172a]">Эталон производителя (снимок)</p>
      <p className="mt-0.5">{line}. Каталог производителя брокер не правит — только HS/пошлина/НДС позиции.</p>
    </div>
  );
}
