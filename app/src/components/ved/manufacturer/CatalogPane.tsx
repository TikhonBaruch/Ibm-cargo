"use client";

import { VedEmptyState } from "../VedShell";
import type { ManufacturerSku } from "./types";
import { statusLabel } from "./types";

export function CatalogPane({
  skus,
  onNew,
  onOpen,
}: {
  skus: ManufacturerSku[];
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  if (skus.length === 0) {
    return (
      <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
        <VedEmptyState
          title="Нет SKU"
          hint="Добавьте изделие: артикул, веса, габариты, упаковка и признаки для ТН ВЭД (спирт, двигатель, батарея)."
          actionLabel="Новый SKU"
          onAction={onNew}
        />
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <ul className="space-y-2">
        {skus.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-[22px] border border-black/[0.04] bg-white px-4 py-3 text-left shadow-sm hover:border-[#2b72f4]/30"
            >
              <span>
                <span className="font-semibold">{s.name}</span>
                <span className="ml-2 text-sm text-[var(--kb-muted)]">{s.sku}</span>
              </span>
              <span className="flex items-center gap-3 text-xs text-[var(--kb-muted)]">
                {s.netWeightKg != null && <span>нетто {s.netWeightKg} кг</span>}
                <span>{statusLabel(s.status)}</span>
                <span>просчётов {s.demandCalcCount ?? 0}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
