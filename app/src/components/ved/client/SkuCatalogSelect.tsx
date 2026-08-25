"use client";

import type { CatalogSku, FormItem } from "./types";
import { formItemFromCatalogSku } from "./types";

/** D32: native select — not a custom dropdown. Published factory SKU → snapshot on create. */
export function SkuCatalogSelect({
  skus,
  item,
  onApply,
}: {
  skus: CatalogSku[];
  item: FormItem;
  onApply: (next: FormItem) => void;
}) {
  if (!skus.length) return null;

  const apply = (id: string) => {
    if (!id) {
      onApply({ ...item, manufacturerSkuId: undefined });
      return;
    }
    const sku = skus.find((s) => s.id === id);
    if (!sku) return;
    onApply(formItemFromCatalogSku(sku, item.qty || 1, item));
  };

  return (
    <div className="mb-2">
      <p className="mb-1 text-[11px] leading-snug text-[var(--kb-muted)]">
        Эталон SKU производителя (если уже в каталоге) — подставит имя и attrs.
      </p>
      <select
        className="w-full rounded-xl border px-3 py-2 text-sm"
        value={item.manufacturerSkuId || ""}
        onChange={(e) => apply(e.target.value)}
      >
        <option value="">SKU производителя: не выбран</option>
        {skus.map((s) => (
          <option key={s.id} value={s.id}>
            {s.company.name ? `${s.company.name} · ` : ""}
            {s.sku} — {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
