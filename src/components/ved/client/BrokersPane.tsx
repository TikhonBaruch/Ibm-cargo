"use client";

import { VedEmptyState } from "../VedShell";
import type { Broker } from "./types";

export function BrokersPane({
  brokers,
  selectedId,
  onSelect,
}: {
  brokers: Broker[];
  selectedId: string;
  onSelect: (userId: string) => void;
}) {
  return (
    <section>
      <p className="mb-4 text-sm text-[var(--kb-muted)]">
        Выбор сохраняется для следующего просчёта — preferred-брокер получит приоритет в очереди после
        оплаты.
      </p>
      {brokers.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-200 bg-white sm:col-span-2 xl:col-span-3">
          <VedEmptyState
            title="Нет доступных брокеров"
            hint="Маркетплейс может быть выключен или брокеры временно не принимают заявки. Можно оформить просчёт без preferred — после оплаты заявка попадёт в общую очередь."
            actionLabel="Создать просчёт"
            actionHref="/cabinet/new"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {brokers.map((b) => {
            const selected = selectedId === b.user.id;
            return (
              <div
                key={b.id}
                className={`rounded-[28px] border bg-white p-5 shadow-sm transition ${
                  selected ? "border-[#2b72f4] ring-2 ring-[#2b72f4]/20" : "border-black/[0.04]"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/cabinets/assets/avatar-broker.jpg"
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{b.user.name}</div>
                    <div className="text-sm text-[var(--kb-muted)]">{b.specialization || "Брокер ВЭД"}</div>
                    <div className="mt-1 text-sm font-medium text-amber-600">★ {b.rating.toFixed(1)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className={`mt-4 w-full rounded-full py-2 text-sm font-semibold ${
                    selected
                      ? "bg-[#2b72f4] text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  onClick={() => onSelect(b.user.id)}
                >
                  {selected ? "Выбран ✓" : "Выбрать"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
