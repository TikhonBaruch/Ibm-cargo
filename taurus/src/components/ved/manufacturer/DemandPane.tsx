"use client";

import { VedEmptyState } from "../VedShell";
import type { ManufacturerSku } from "./types";

export function DemandPane({
  skus,
  catalogHref = "/manufacturer/catalog",
}: {
  skus: ManufacturerSku[];
  catalogHref?: string;
}) {
  const rows = skus.filter((s) => (s.demandCalcCount ?? 0) > 0 || s.status === "PUBLISHED");
  const anyDemand = skus.some((s) => (s.demandCalcCount ?? 0) > 0);
  const published = skus.filter((s) => s.status === "PUBLISHED");

  if (skus.length === 0) {
    return (
      <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
        <VedEmptyState
          title="Сначала эталон в каталоге"
          hint="Спрос появится, когда импортёры начнут просчёты по вашим опубликованным SKU. Имена заказчиков не показываем."
          actionLabel="Добавить SKU"
          actionHref={catalogHref}
        />
      </div>
    );
  }

  if (!anyDemand && published.length === 0) {
    return (
      <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
        <VedEmptyState
          title="Опубликуйте SKU"
          hint="Черновики не видны импортёрам. После Publish здесь появятся агрегаты просчётов без ПДн."
          actionLabel="К каталогу"
          actionHref={catalogHref}
        />
      </div>
    );
  }

  if (!anyDemand) {
    return (
      <div className="space-y-3">
        <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
          <VedEmptyState
            title="Просчётов по SKU пока нет"
            hint="SKU опубликованы — ждите запросы и просчёты импортёров. Пока можно уточнить attrs в каталоге."
            actionLabel="Уточнить каталог"
            actionHref={catalogHref}
          />
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <p className="text-sm text-[var(--kb-muted)]">
        Только числа просчётов и PDF (`DONE`). Имена заказчиков не показываем — это не CRM.
      </p>
      <ul className="space-y-2">
        {(rows.length ? rows : skus).map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap justify-between gap-2 rounded-[22px] border border-black/[0.04] bg-white px-4 py-3 text-sm shadow-sm"
          >
            <span className="font-medium">
              {s.name} <span className="text-[var(--kb-muted)]">· {s.sku}</span>
            </span>
            <span className="text-[var(--kb-muted)]">
              просчётов {s.demandCalcCount ?? 0} · PDF {s.demandDoneCount ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
