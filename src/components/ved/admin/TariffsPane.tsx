"use client";

import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import { tariffMiniBlurb } from "../lbm-pane-visual";
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
      <p style={{ marginBottom: 14, color: "var(--muted)", fontSize: 14 }}>
        Тарифы D10: EXPRESS · STANDARD · PRO. Цена — `TariffPlan.priceRub`, не макет «Код / Таможня / Под ключ».
      </p>
      <div className="three">
        {tariffs.map((t, i) => (
          <div key={t.id} className={`tariff-mini${t.code === "STANDARD" ? " featured" : ""}`}>
            {t.code === "STANDARD" ? (
              <span className="pill blue" style={{ marginBottom: 8 }}>
                Популярный
              </span>
            ) : null}
            <h4>{t.name}</h4>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{tariffMiniBlurb(t.code)}</div>
            <div className="price">
              {t.priceRub.toLocaleString("ru-RU")} ₽ <small>/ просчёт</small>
            </div>
            <div className="field">
              <label>
                Цена, ₽
                <input
                  type="number"
                  value={t.priceRub}
                  onChange={(e) => {
                    const next = [...tariffs];
                    next[i] = { ...t, priceRub: Number(e.target.value) };
                    onChange(next);
                  }}
                />
              </label>
            </div>
            <div className="field">
              <label>
                Доля брокера, %
                <input
                  type="number"
                  value={t.brokerSharePct}
                  onChange={(e) => {
                    const next = [...tariffs];
                    next[i] = { ...t, brokerSharePct: Number(e.target.value) };
                    onChange(next);
                  }}
                />
              </label>
            </div>
            <div className="field">
              <label>
                SLA, ч
                <input
                  type="number"
                  value={t.slaHours}
                  onChange={(e) => {
                    const next = [...tariffs];
                    next[i] = { ...t, slaHours: Number(e.target.value) || 1 };
                    onChange(next);
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSave(tariffs[i])}
              className={`btn btn-sm${t.code === "STANDARD" ? " btn-primary" : " btn-ghost"}`}
              style={{ marginTop: 12 }}
            >
              Сохранить
            </button>
          </div>
        ))}
      </div>
      <DesignerStub
        title="Код / Таможня / Под ключ + пакеты 20/100"
        intent="Макет рисовал три продукта (990 / 2990 / 5990) и пачки позиций из файла."
        gap="Без ADR не переименовываем D10. Лимиты позиций 1 / 3 / 10."
      />
    </section>
  );
}
