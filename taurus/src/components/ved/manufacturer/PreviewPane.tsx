"use client";

import { VedEmptyState } from "../VedShell";
import type { ManufacturerSku } from "./types";

export function PreviewPane({
  skus,
  selectedId,
  onSelect,
}: {
  skus: ManufacturerSku[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sku = skus.find((s) => s.id === selectedId) || skus[0];
  if (!sku) {
    return (
      <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
        <VedEmptyState
          title="Нечего показать"
          hint="Сначала добавьте SKU — так выглядит карточка товара в просчёте импортёра."
        />
      </div>
    );
  }

  const preview = sku.clientPreview;
  const attrs = (preview?.attrs || {}) as Record<string, unknown>;

  return (
    <section className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <ul className="space-y-1">
        {skus.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                s.id === sku.id ? "bg-[#2b72f4] text-white" : "bg-white hover:bg-slate-50"
              }`}
            >
              {s.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-[var(--kb-muted)]">Карточка в просчёте</p>
        <h2 className="mt-1 text-xl font-bold">{preview?.name || sku.name}</h2>
        {preview?.description && (
          <p className="mt-2 text-sm text-[var(--kb-muted)]">{preview.description}</p>
        )}
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(attrs)
            .filter(([k]) => k !== "extra")
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-[var(--kb-muted)]">{k}</dt>
                <dd className="font-medium">{String(v)}</dd>
              </div>
            ))}
        </dl>
        <p className="mt-4 text-xs text-[var(--kb-muted)]">
          HS и платежи по-прежнему подтверждает брокер. Производитель даёт эталон описания, не финальный код.
        </p>
      </div>
    </section>
  );
}
