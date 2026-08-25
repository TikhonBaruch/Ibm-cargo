"use client";

import type { Calc, Quote, ShipRow } from "./types";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export function ShippingPane({
  calcs,
  shipping,
  quotes,
  shipForm,
  selectedQuoteId,
  busy,
  live,
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
  /** When false, form is visual-only (D27 shipping UI off). */
  live?: boolean;
  onShipForm: (patch: Partial<typeof shipForm>) => void;
  onQuote: (id: string, mode: string) => void;
  onCreate: () => void;
}) {
  const enabled = live !== false;
  const doneCalcs = calcs.filter((c) => c.status === "DONE");

  return (
    <section>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Заказать перевозку</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            {enabled
              ? "Доступно только для заявок DONE. Котировки — logistics provider."
              : "Макет суперприложения · клиентский shipping UI default off (D27)"}
          </p>
        </div>
      </div>

      {!enabled ? (
        <DesignerStub
          title="Грузоперевозки"
          intent="Дизайнер: выбор схемы, маршрут Китай/Турция/ЕС → РФ, ориентир по цене."
          gap="Domain перевозки есть, клиентский UI выключен по умолчанию. Форма ниже не создаёт заявку, пока флаг SHIPPING_UI выключен."
          compact
        />
      ) : null}

      <div className="two">
        <div className="card" style={{ margin: 0 }}>
          <div className="field">
            <label>Связанный просчёт</label>
            <select
              value={shipForm.calculationId}
              disabled={!enabled}
              onChange={(e) => onShipForm({ calculationId: e.target.value })}
            >
              <option value="">Выберите DONE-заявку</option>
              {doneCalcs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.number} · {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Откуда</label>
            <input
              value={shipForm.origin}
              disabled={!enabled}
              onChange={(e) => onShipForm({ origin: e.target.value })}
              placeholder="Откуда"
            />
          </div>
          <div className="field">
            <label>Куда</label>
            <input
              value={shipForm.destination}
              disabled={!enabled}
              onChange={(e) => onShipForm({ destination: e.target.value })}
              placeholder="Куда"
            />
          </div>
          <div className="field">
            <label>Комментарий</label>
            <textarea
              rows={2}
              value={shipForm.comment}
              disabled={!enabled}
              onChange={(e) => onShipForm({ comment: e.target.value })}
              placeholder="Сроки, температурный режим…"
            />
          </div>
          <div className="field">
            <label>Логистические схемы</label>
            {quotes.map((q) => (
              <label
                key={q.id}
                className={`flex cursor-pointer items-center justify-between rounded-2xl border px-3 py-2.5 text-sm ${
                  selectedQuoteId === q.id ? "border-[#2b72f4] bg-[#e8f0fe]" : "border-slate-200"
                }`}
                style={{ marginBottom: 8, opacity: enabled ? 1 : 0.6 }}
              >
                <span>
                  <input
                    type="radio"
                    name="quote"
                    disabled={!enabled}
                    checked={selectedQuoteId === q.id}
                    onChange={() => onQuote(q.id, q.mode)}
                  />{" "}
                  {q.carrierLabel} · {q.mode} · {q.etaDays} дн.
                </span>
                <strong>{q.priceRub.toLocaleString("ru-RU")} ₽</strong>
              </label>
            ))}
            {quotes.length === 0 ? <p className="meta">Котировки загружаются…</p> : null}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!enabled || busy || !shipForm.calculationId || !selectedQuoteId}
            onClick={onCreate}
          >
            {enabled ? "Отправить заявку логистам" : "Недоступно (hold D27)"}
          </button>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <h3>Мои перевозки</h3>
          {shipping.length ? (
            <div className="activity-list">
              {shipping.map((s) => (
                <div key={s.id} className="activity-item">
                  <div className="dot info" />
                  <div>
                    <strong>
                      {s.trackingCode || s.id.slice(0, 8)} · {s.origin} → {s.destination}
                    </strong>
                    <span>
                      {s.mode} · {s.status}
                      {s.selectedQuote
                        ? ` · ${s.selectedQuote.carrierLabel} · ${s.selectedQuote.priceRub?.toLocaleString("ru-RU")} ₽`
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="meta">Пока нет перевозок</p>
          )}
        </div>
      </div>
    </section>
  );
}
