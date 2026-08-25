"use client";

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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {brokers.map((b) => {
          const selected = selectedId === b.user.id;
          return (
            <div
              key={b.id}
              className={`person-card col${selected ? " is-open" : ""}`}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div className="photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/cabinets/assets/avatar-broker.jpg" alt="" />
                </div>
                <div>
                  <strong>{b.user.name}</strong>
                  <div className="stars">★ {b.rating.toFixed(1)}</div>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
                    {b.specialization || "Брокер ВЭД"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={`btn ${selected ? "btn-primary" : "btn-ghost"}`}
                style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
                onClick={() => onSelect(b.user.id)}
              >
                {selected ? "Выбран ✓" : "Выбрать"}
              </button>
            </div>
          );
        })}
        {brokers.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-5 py-8 sm:col-span-2 xl:col-span-3">
            <p className="font-medium text-[#0f172a]">Нет доступных брокеров</p>
            <p className="mt-1 text-sm text-[var(--kb-muted)]">
              Маркетплейс может быть выключен администратором, либо брокеры временно не принимают
              заявки. Можно оформить просчёт без preferred — заявка попадёт в общую очередь после
              оплаты.
            </p>
            <a
              href="/cabinet/new"
              className="mt-4 inline-flex rounded-full bg-[#2b72f4] px-4 py-2 text-xs font-semibold text-white"
            >
              Создать просчёт
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
