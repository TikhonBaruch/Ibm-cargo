"use client";

import Link from "next/link";
import { VedEmptyState } from "../VedShell";
import type { ManufacturerDash } from "./types";

export function DashboardPane({
  dash,
  catalogHref,
  demandHref,
  poolsHref,
  showPools = true,
}: {
  dash: ManufacturerDash | null;
  catalogHref: string;
  demandHref: string;
  poolsHref?: string;
  showPools?: boolean;
}) {
  const skuTotal = dash?.skuTotal ?? 0;
  const published = dash?.skuPublished ?? 0;
  const submitted = dash?.requestSubmitted ?? 0;
  const poolsOpen = dash?.poolsOpen ?? 0;

  const cards = [
    { label: "SKU в каталоге", value: skuTotal },
    { label: "Опубликовано", value: published },
    ...(showPools
      ? [
          { label: "Запросы в сборку", value: submitted },
          { label: "Открытые сборки", value: poolsOpen },
        ]
      : []),
  ];

  const steps = [
    {
      done: skuTotal > 0,
      label: "Создать эталон SKU",
      href: catalogHref,
    },
    {
      done: published > 0,
      label: "Опубликовать хотя бы один SKU",
      href: catalogHref,
    },
    ...(showPools && poolsHref
      ? [
          {
            done: submitted > 0 || poolsOpen > 0,
            label: "Принять запросы в сборный заказ",
            href: poolsHref,
          },
        ]
      : []),
  ];
  const next = steps.find((s) => !s.done);

  return (
    <section className="space-y-5">
      {skuTotal === 0 ? (
        <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
          <VedEmptyState
            title="Начните с эталона SKU"
            hint="Один раз заполните нетто, состав и габариты — импортёры смогут запрашивать qty и просчитывать ТН ВЭД не с нуля."
            actionLabel="Добавить SKU"
            actionHref={catalogHref}
          />
        </div>
      ) : next ? (
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--kb-muted)]">
            Первый запуск
          </p>
          <ol className="mt-3 space-y-2 text-sm">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-2">
                <span className={s.done ? "text-[var(--kb-muted)] line-through" : "font-medium"}>
                  {s.done ? "✓ " : ""}
                  {s.label}
                </span>
                {!s.done ? (
                  <Link href={s.href} className="shrink-0 text-[#2b72f4]">
                    Открыть
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
          <Link
            href={next.href}
            className="mt-4 inline-flex rounded-full bg-[#2b72f4] px-4 py-2 text-sm font-semibold text-white"
          >
            Далее: {next.label}
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-[var(--kb-muted)]">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      {skuTotal > 0 ? (
        <p className="text-sm text-[var(--kb-muted)]">
          Спрос без ПДн —{" "}
          <Link href={demandHref} className="text-[#2b72f4]">
            Спрос
          </Link>
          .
          {showPools && poolsHref ? (
            <>
              {" "}Подтверждение хвоста в партию —{" "}
              <Link href={poolsHref} className="text-[#2b72f4]">
                Сборные заказы
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
