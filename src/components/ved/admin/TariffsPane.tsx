"use client";

import type { AdminTariffRow } from "./types";

export function TariffsPane({
  tariffs,
  busy,
  onChange,
  onSave,
}: {
  tariffs: AdminTariffRow[];
  busy: boolean;
  onChange: (next: AdminTariffRow[]) => void;
  onSave: (t: AdminTariffRow) => void;
}) {
  return (
    <section>
      <div className="grid gap-4 md:grid-cols-3">
        {tariffs.map((t, i) => (
          <div key={t.id} className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
            <h3 className="font-semibold">{t.name}</h3>
            <label className="mt-3 block text-sm">
              Цена, ₽
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={t.priceRub}
                onChange={(e) => {
                  const next = [...tariffs];
                  next[i] = { ...t, priceRub: Number(e.target.value) };
                  onChange(next);
                }}
              />
            </label>
            <label className="mt-2 block text-sm">
              Доля брокера, %
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={t.brokerSharePct}
                onChange={(e) => {
                  const next = [...tariffs];
                  next[i] = { ...t, brokerSharePct: Number(e.target.value) };
                  onChange(next);
                }}
              />
            </label>
            <label className="mt-2 block text-sm">
              SLA, ч
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={t.slaHours}
                onChange={(e) => {
                  const next = [...tariffs];
                  next[i] = { ...t, slaHours: Number(e.target.value) || 1 };
                  onChange(next);
                }}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSave(tariffs[i])}
              className="mt-3 rounded-full bg-[#2b72f4] px-4 py-2 text-xs font-semibold text-white"
            >
              Сохранить
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
