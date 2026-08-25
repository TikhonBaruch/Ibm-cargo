"use client";

import { useState } from "react";
import { VedEmptyState } from "../VedShell";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
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
  const [pkg, setPkg] = useState({ code: true, docs: true, release: true });

  return (
    <section>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Брокеры</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Preferred-эксперт получит приоритет в очереди после оплаты
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 10 }}>Брокер под ключ — что вы получаете</h3>
        <p className="meta" style={{ marginTop: 0, marginBottom: 12 }}>
          В domain это не отдельный тариф «Под ключ»: после оплаты STANDARD/PRO заявка попадает в
          очередь QC. Тумблеры пакета — визуал макета.
        </p>
        <DesignerStub
          title="Пакет «под ключ»"
          intent="Макет: проверка ТН ВЭД, документы, сопровождение до выпуска — как состав услуги."
          gap="Переключатели не сохраняются. Назначение preferred — кнопка на карточке брокера."
          compact
        />
        {(
          [
            ["code", "Проверка ТН ВЭД", "Сверяем код и риски по материалам из заявки"],
            ["docs", "Проверка документов", "Инвойсы / пэкинг / фото"],
            ["release", "Сопровождение до выпуска", "В MVP deliverable — PDF, не выпуск груза"],
          ] as const
        ).map(([key, t, d]) => (
          <div key={key} className="set-row">
            <div>
              <strong>{t}</strong>
              <div className="meta">{d}</div>
            </div>
            <button
              type="button"
              className={`switch${pkg[key] ? " on" : ""}`}
              onClick={() => setPkg((p) => ({ ...p, [key]: !p[key] }))}
              aria-label={t}
            >
              <i />
            </button>
          </div>
        ))}
      </div>

      {brokers.length === 0 ? (
        <div className="card" style={{ margin: 0 }}>
          <VedEmptyState
            title="Нет доступных брокеров"
            hint="Можно оформить просчёт без preferred — после оплаты заявка попадёт в общую очередь."
            actionLabel="Создать просчёт"
            actionHref="/cabinet/new"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {brokers.map((b) => {
            const selected = selectedId === b.user.id;
            return (
              <div key={b.id} className={`person-card col${selected ? " is-open" : ""}`}>
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
        </div>
      )}
    </section>
  );
}
