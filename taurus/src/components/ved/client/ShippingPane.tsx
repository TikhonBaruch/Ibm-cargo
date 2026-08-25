"use client";

import type { Calc, Quote, ShipRow } from "./types";

export function ShippingPane({
  calcs,
  shipping,
  quotes,
  shipForm,
  selectedQuoteId,
  busy,
  onShipForm,
  onQuote,
  onCreate,
}: {
  calcs: Calc[];
  shipping: ShipRow[];
  quotes: Quote[];
  shipForm: {
    origin: string;
    destination: string;
    mode: string;
    calculationId: string;
    comment: string;
  };
  selectedQuoteId: string;
  busy: boolean;
  onShipForm: (patch: Partial<typeof shipForm>) => void;
  onQuote: (id: string, mode: string) => void;
  onCreate: () => void;
}) {
  const doneCalcs = calcs.filter((c) => c.status === "DONE");

  return (
    <section className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
            Новая перевозка
          </h2>
          <p className="mb-4 text-sm text-[var(--kb-muted)]">
            Доступно только для заявок DONE. Котировки — logistics provider (demo-3pl / stub).
          </p>
          <div className="space-y-3">
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={shipForm.calculationId}
              onChange={(e) => onShipForm({ calculationId: e.target.value })}
            >
              <option value="">Выберите DONE-заявку</option>
              {doneCalcs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.number} · {c.title}
                </option>
              ))}
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={shipForm.origin}
                onChange={(e) => onShipForm({ origin: e.target.value })}
                placeholder="Откуда"
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={shipForm.destination}
                onChange={(e) => onShipForm({ destination: e.target.value })}
                placeholder="Куда"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Логистические схемы</div>
              {quotes.map((q) => (
                <label
                  key={q.id}
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border px-3 py-2.5 text-sm ${
                    selectedQuoteId === q.id
                      ? "border-[#2b72f4] bg-[#e8f0fe]"
                      : "border-slate-200"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="quote"
                      checked={selectedQuoteId === q.id}
                      onChange={() => onQuote(q.id, q.mode)}
                    />
                    {q.carrierLabel} · {q.mode} · {q.etaDays} дн.
                  </span>
                  <strong>{q.priceRub.toLocaleString("ru-RU")} ₽</strong>
                </label>
              ))}
              {quotes.length === 0 && (
                <p className="text-sm text-[var(--kb-muted)]">Котировки загружаются…</p>
              )}
            </div>
            <button
              type="button"
              disabled={busy || !shipForm.calculationId || !selectedQuoteId}
              onClick={onCreate}
              className="w-full rounded-full bg-[#2b72f4] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Выбрать схему
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
          <div className="border-b border-black/[0.04] px-5 py-4">
            <h2 className="font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
              Мои перевозки
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {shipping.map((s) => (
              <li key={s.id} className="flex gap-3 px-5 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cabinets/assets/ob-1-truck.jpg"
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-semibold">
                    {s.trackingCode || s.id.slice(0, 8)} · {s.origin} → {s.destination}
                  </div>
                  <div className="text-[var(--kb-muted)]">
                    {s.mode} · <strong className="text-[var(--kb-ink)]">{s.status}</strong>
                  </div>
                  {s.selectedQuote && (
                    <div className="mt-0.5 text-xs text-[var(--kb-muted)]">
                      {s.selectedQuote.carrierLabel} ·{" "}
                      {s.selectedQuote.priceRub?.toLocaleString("ru-RU")} ₽
                      {s.eta && ` · ETA ${new Date(s.eta).toLocaleDateString("ru-RU")}`}
                    </div>
                  )}
                  {s.trackingEvents && s.trackingEvents.length > 0 && (
                    <ol className="mt-2 space-y-1 border-l border-slate-200 pl-3 text-xs text-[var(--kb-muted)]">
                      {s.trackingEvents.map((ev, i) => (
                        <li key={`${ev.at}-${i}`}>
                          <span className="font-medium text-[var(--kb-ink)]">{ev.status}</span>
                          {" · "}
                          {ev.label}
                          {" · "}
                          {new Date(ev.at).toLocaleDateString("ru-RU")}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </li>
            ))}
            {shipping.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-[var(--kb-muted)]">
                Пока нет перевозок
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
