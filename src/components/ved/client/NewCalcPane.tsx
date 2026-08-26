"use client";

import { useRef } from "react";
import Link from "next/link";
import { StatusPill } from "../VedShell";
import type { Broker, Calc, CalcForm, CatalogSku, CreatePhase, FormItem, TariffOption } from "./types";
import { isAiDrainPending } from "@/lib/ved/ai-drain-client";
import { resolveOriginCountryCode } from "@/lib/ved/field-suggest";

const COUNTRY_OPTIONS = [
  { label: "Китай", iso: "CN" },
  { label: "Турция", iso: "TR" },
  { label: "ЕС", iso: "DE" },
  { label: "Корея", iso: "KR" },
  { label: "Вьетнам", iso: "VN" },
  { label: "Индия", iso: "IN" },
] as const;

const WIZ_STEPS = ["Товар", "Бесплатно", "Код"] as const;

function createBusyLabel(phase: CreatePhase, busy: boolean): string {
  if (phase === "uploading") return "Загружаем фото…";
  if (phase === "enriching") return "Уточняем ТН ВЭД…";
  if (phase === "creating" || busy) return "Создаём заявку…";
  return "Далее";
}

function originIso(country: string): string {
  const hit = COUNTRY_OPTIONS.find((c) => c.label === country);
  if (hit) return hit.iso;
  return resolveOriginCountryCode(country) || "CN";
}

function homeFromOrders(ordersHref: string): string {
  return ordersHref.replace(/\/orders\/?$/, "") || "/cabinet";
}

/**
 * C10: live `/cabinet/new` chrome = designer step «Что ввозите?» (скрин макета).
 * Extra create UI (tariffs, CSV, qty, country select, attrs grid) is hidden.
 * Domain create unchanged: origin CN + composition from description.
 */
export function NewCalcPane({
  form,
  items,
  brokers,
  tariffs,
  catalogSkus = [],
  busy,
  createPhase = "idle",
  selected,
  ordersHref,
  onForm,
  onItems,
  onCreate,
  onUpload,
}: {
  form: CalcForm;
  items: FormItem[];
  brokers: Broker[];
  tariffs: TariffOption[];
  catalogSkus?: CatalogSku[];
  busy: boolean;
  createPhase?: CreatePhase;
  selected: Calc | null;
  ordersHref: string;
  onForm: (patch: Partial<CalcForm>) => void;
  onItems: (items: FormItem[]) => void;
  onCreate: (override?: {
    items?: FormItem[];
    form?: Partial<CalcForm>;
  }) => void | Promise<void>;
  onUpload: (file: File, index: number) => Promise<void>;
}) {
  void brokers;
  void tariffs;
  void catalogSkus;
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const homeHref = homeFromOrders(ordersHref);
  const desc = form.description.trim() || form.title.trim();
  const photoUrl = items[0]?.mediaUrl;
  const docCount = photoUrl ? 1 : 0;
  const countryLabel =
    COUNTRY_OPTIONS.some((c) => c.label === form.country) ? form.country : form.country || "Китай";
  const valid = desc.length >= 5;
  const uploading = createPhase === "uploading";

  const setGoodsText = (raw: string) => {
    const title = raw.trim().split("\n")[0]?.slice(0, 120) || raw.trim().slice(0, 80);
    onForm({ title, description: raw });
    const next = [...items];
    if (!next[0]) next[0] = { name: "", qty: 1, unitPrice: 0 };
    next[0] = { ...next[0], name: title || next[0].name };
    onItems(next);
  };

  const addFiles = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    void onUpload(file, 0);
  };

  const tryCreate = () => {
    if (!valid) return;
    const title = form.title.trim() || desc.slice(0, 80);
    const iso = originIso(countryLabel);
    const base = items[0] || { name: "", qty: 1, unitPrice: 0 };
    const nextItems: FormItem[] = [
      {
        ...base,
        name: base.name.trim() || title,
        attrs: {
          ...base.attrs,
          originCountry: base.attrs?.originCountry || iso,
          composition: base.attrs?.composition?.trim() || desc,
        },
      },
    ];
    void onCreate({
      items: nextItems,
      form: { title, description: desc, country: countryLabel },
    });
  };

  return (
    <section className="wiz-full">
      <div className="wiz-head">
        <div>
          <Link href={homeHref} className="btn btn-ghost btn-sm">
            ← На главную
          </Link>
          <span className="go-kicker" style={{ display: "block", marginTop: 14 }}>
            Первый код бесплатный · этот просчёт только ТН ВЭД
          </span>
          <h2>Что ввозите?</h2>
        </div>
      </div>

      <div className="wiz-steps labeled steps-3">
        {WIZ_STEPS.map((lab, i) => (
          <button key={lab} type="button" className={i === 0 ? "on" : ""}>
            <b>{i + 1}</b>
            {lab}
          </button>
        ))}
      </div>

      <div className="wiz-grid">
        <div className="wiz-main card" style={{ margin: 0 }}>
          <p className="wiz-lead">Одна позиция: описание товара и документы для кода ТН ВЭД.</p>

          <div className="free-calc-banner">
            <span className="free-calc-stamp">1 бесплатно</span>
            <div>
              <strong>Первый просчёт — 0 ₽</strong>
              <p>
                Один расчёт одной позиции бесплатный. Все следующие заявки уже по тарифам «Код»,
                «Таможня» или «Под ключ».
              </p>
            </div>
          </div>

          <div className="field">
            <label>Режим</label>
            <div className="amt-chips">
              <button type="button" className="on">
                Одна позиция · 1 бесплатно
              </button>
              <button type="button">Мультипозиция</button>
            </div>
          </div>

          <div className="field">
            <label>Фото товара</label>
            <p className="meta" style={{ margin: "0 0 10px" }}>
              Загрузите фото — ИИ распознает товар, заполнит описание и спросит, чего не хватает для
              кода.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={camRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div
              className={`dropzone${uploading ? " reading" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
            >
              <strong>
                {uploading ? "Загружаем фото…" : "Перетащите фото товара или сделайте снимок"}
              </strong>
              <span className="meta">JPG, PNG, WEBP · ИИ опишет товар · до 12 МБ</span>
              <div className="dropzone-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  Выбрать файлы
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => camRef.current?.click()}
                  disabled={uploading}
                >
                  Снять фото
                </button>
              </div>
            </div>
            {photoUrl ? (
              <div className="doc-list">
                <div className="doc-chip">
                  <a href={photoUrl} target="_blank" rel="noreferrer" className="doc-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl} alt="" />
                  </a>
                  <div className="doc-info">
                    <b>Фото товара</b>
                    <span className="meta">прикреплено</span>
                  </div>
                  <span className="pill ok">Фото</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="field">
            <label>Наименование и описание</label>
            <textarea
              rows={5}
              style={{ minHeight: 132, resize: "vertical" }}
              placeholder="Или опишите сами: ноутбуки Lenovo ThinkPad, 14'' — либо загрузите фото выше"
              value={form.description || form.title}
              onChange={(e) => setGoodsText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !valid}
              onClick={tryCreate}
            >
              {createBusyLabel(createPhase, busy)}
            </button>
          </div>
        </div>

        <aside className="wiz-side">
          <div className="order-hs" style={{ minHeight: 220, gridTemplateColumns: "1fr" }}>
            <div className="order-hs-copy">
              <span className="gt-kicker">Первый просчёт · 0 ₽</span>
              <div className="wiz-hs-dashes" aria-hidden>
                <i />
                <i />
                <i />
                <i />
              </div>
              <p>Один расчёт бесплатный. Следующие заявки — по тарифам.</p>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <h3>По заявке</h3>
            <div className="pay-row">
              <span>Происхождение</span>
              <strong>{countryLabel}</strong>
            </div>
            <div className="pay-row">
              <span>Документы</span>
              <strong>{docCount}</strong>
            </div>
            <div className="pay-row">
              <span>Тариф</span>
              <strong>первый · 0 ₽</strong>
            </div>
            <p className="meta" style={{ marginTop: 10 }}>
              Этот просчёт — только код ТН ВЭД. Таможню считаем отдельно.
            </p>
            <p className="meta" style={{ marginTop: 10 }}>
              Первый просчёт бесплатно. Дальше 990 ₽ за один код.
            </p>
          </div>
        </aside>
      </div>

      {selected && (
        <div className="mt-4 card" style={{ marginBottom: 0 }}>
          <div>
            Создано {selected.number} · <StatusPill status={selected.status} />{" "}
            <Link href={ordersHref} className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }}>
              К заявкам · оплатить
            </Link>
          </div>
          {isAiDrainPending(selected) ? (
            <p className="alert-box" style={{ marginTop: 12 }}>
              Уточняем ТН ВЭД… Предварительный код уже есть; точный обновится через 1–2 мин.
            </p>
          ) : selected.aiDraft?.llmEnrich ? (
            <p className="meta" style={{ marginTop: 12, color: "var(--ok)" }}>
              Код уточнён ({selected.aiDraft.llmEnrich}
              {selected.hsCode ? ` · ${selected.hsCode}` : ""}).
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
