"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StatusPill } from "../VedShell";
import { ClarifyField } from "@/lbm-bro/components/clarify-field";
import { Icon } from "@/lbm-bro/components/icon";
import {
  getClarificationQuestions,
  type ClarificationQuestion,
} from "@/lbm-bro/lib/clarify-ai";
import type { Broker, Calc, CalcForm, CatalogSku, CreatePhase, FormItem, TariffOption } from "./types";
import { isAiDrainPending } from "@/lib/ved/ai-drain-client";
import { originCountrySelectOptions, resolveOriginCountryCode } from "@/lib/ved/field-suggest";
import {
  appendClarifyBlock,
  compositionFromClarify,
  hsHintFromClarify,
  unansweredClarifyParts,
  wizardDraftForClarify,
} from "./new-calc-clarify";
import {
  MIN_PACK,
  allPackChrome,
  fmtRub,
  liveCodeForPack,
  namedItemCount,
  packIdForLiveCode,
  previewPackFile,
  resolvePackChrome,
  type PackId,
  type PackMode,
} from "./new-calc-pack";

const COUNTRY_OPTIONS = originCountrySelectOptions();

const WIZ_STEPS = ["Товар", "Бесплатно", "Код"] as const;

function createBusyLabel(phase: CreatePhase, busy: boolean): string {
  if (phase === "uploading") return "Загружаем фото…";
  if (phase === "enriching") return "Уточняем ТН ВЭД…";
  if (phase === "creating" || busy) return "Создаём заявку…";
  return "Далее";
}

function originIso(country: string): string {
  const hit = COUNTRY_OPTIONS.find((c) => c.label === country || c.iso === country);
  if (hit) return hit.iso;
  return resolveOriginCountryCode(country) || "CN";
}

function homeFromOrders(ordersHref: string): string {
  return ordersHref.replace(/\/orders\/?$/, "") || "/cabinet";
}

/**
 * C10–C12: live `/cabinet/new` chrome = designer «Что ввозите?».
 * Single: lab clarify panel after description + country. Multi: C11 pack, no clarify.
 * Create still hits /api/v1 (D10 caps).
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
  void catalogSkus;
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const packFileRef = useRef<HTMLInputElement>(null);
  const packCamRef = useRef<HTMLInputElement>(null);
  const homeHref = homeFromOrders(ordersHref);
  const [packMode, setPackMode] = useState<PackMode>("single");
  const [packModal, setPackModal] = useState(false);
  const [packReading, setPackReading] = useState(false);
  const [packFail, setPackFail] = useState(false);
  const [packDocName, setPackDocName] = useState("");
  const [clarifyQs, setClarifyQs] = useState<ClarificationQuestion[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>({});
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [clarifyAppliedIds, setClarifyAppliedIds] = useState<string[]>([]);
  const isPack = packMode === "multi";
  const packId = packIdForLiveCode(form.tariffCode || "STANDARD");
  const picked = resolvePackChrome(isPack && packId === "one" ? "m20" : packId, tariffs);
  const packs = allPackChrome(tariffs);
  const desc = form.description.trim() || form.title.trim();
  const photoUrl = items[0]?.mediaUrl;
  const packN = namedItemCount(items);
  const docCount = isPack ? (packDocName ? 1 : 0) : photoUrl ? 1 : 0;
  const countryLabel =
    COUNTRY_OPTIONS.find((c) => c.label === form.country)?.label ||
    COUNTRY_OPTIONS.find((c) => c.iso === form.country)?.label ||
    form.country ||
    "Китай";
  const validSingle = desc.length >= 5;
  const validPack = packN >= MIN_PACK;
  const valid = isPack ? validPack : validSingle;
  const uploading = createPhase === "uploading" || packReading;
  const goodsText = form.description || form.title;
  const clarifyEnabled = !isPack;
  const visibleClarifyQs = clarifyEnabled ? clarifyQs : [];

  useEffect(() => {
    if (!packModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPackModal(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [packModal]);

  useEffect(() => {
    if (!clarifyEnabled) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async clarify fetch kickoff
    setClarifyLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const qs = await getClarificationQuestions({
          wizard: wizardDraftForClarify(goodsText, countryLabel),
          step: 1,
        });
        if (!alive) return;
        setClarifyQs(qs);
        setClarifyLoading(false);
        setClarifyAppliedIds([]);
        setClarifyAnswers((prev) => {
          const next: Record<string, string> = {};
          qs.forEach((q) => {
            next[q.id] = prev[q.id] ?? "";
          });
          return next;
        });
      } catch {
        if (!alive) return;
        setClarifyQs([]);
        setClarifyLoading(false);
      }
    }, 350);

    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [clarifyEnabled, goodsText, countryLabel]);

  const setGoodsText = (raw: string) => {
    const title = raw.trim().split("\n")[0]?.slice(0, 120) || raw.trim().slice(0, 80);
    onForm({ title, description: raw });
    if (isPack) return;
    const next = [...items];
    if (!next[0]) next[0] = { name: "", qty: 1, unitPrice: 0 };
    next[0] = { ...next[0], name: title || next[0].name };
    onItems(next);
  };

  const setCountry = (label: string) => {
    onForm({ country: label });
  };

  const applyClarifications = () => {
    const parts = unansweredClarifyParts(visibleClarifyQs, clarifyAnswers, clarifyAppliedIds);
    if (!parts.length) return;
    const nextDesc = appendClarifyBlock(goodsText, parts);
    const title = nextDesc.trim().split("\n")[0]?.slice(0, 120) || nextDesc.trim().slice(0, 80);
    const composition = compositionFromClarify(
      clarifyAnswers,
      items[0]?.attrs?.composition || nextDesc,
    );
    const hsHint = hsHintFromClarify(visibleClarifyQs, clarifyAnswers);
    onForm({ title, description: nextDesc });
    const next = [...items];
    if (!next[0]) next[0] = { name: "", qty: 1, unitPrice: 0 };
    next[0] = {
      ...next[0],
      name: title || next[0].name,
      attrs: {
        ...next[0].attrs,
        composition,
        ...(hsHint && !next[0].attrs?.hsHint ? { hsHint } : {}),
      },
    };
    onItems(next);
    setClarifyAppliedIds((ids) => [...ids, ...parts.map((p) => p.id)]);
  };

  const skipClarifications = () => {
    if (!visibleClarifyQs.length) return;
    setClarifyAppliedIds(visibleClarifyQs.map((q) => q.id));
    setClarifyQs([]);
  };

  const pickPack = (id: PackId) => {
    if (id === "one") {
      setPackMode("single");
      setPackModal(false);
      setPackFail(false);
      onForm({ tariffCode: "STANDARD" });
      const first = items[0] ? { ...items[0] } : { name: "", qty: 1, unitPrice: 0 };
      onItems([first]);
      return;
    }
    setPackMode("multi");
    onForm({ tariffCode: liveCodeForPack(id) });
    if (namedItemCount(items) >= MIN_PACK) {
      setPackModal(false);
      return;
    }
    setPackModal(true);
  };

  const applyPackItems = (next: FormItem[], filename: string) => {
    const iso = originIso(countryLabel);
    const capped = next.slice(0, picked.max).map((it) => ({
      ...it,
      qty: it.qty || 1,
      unitPrice: it.unitPrice || 0,
      attrs: {
        ...it.attrs,
        originCountry: it.attrs?.originCountry || iso,
        composition: it.attrs?.composition?.trim() || it.name,
      },
    }));
    onItems(capped);
    const title = capped[0]?.name.slice(0, 120) || filename;
    if (!form.description.trim()) {
      onForm({ title, description: `Пакет ${capped.length} позиций` });
    } else {
      onForm({ title });
    }
  };

  const addPhoto = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    void onUpload(file, 0);
  };

  const addPackFile = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || packReading) return;
    setPackReading(true);
    setPackFail(false);
    setPackDocName(file.name);
    try {
      const { items: parsed } = await previewPackFile(file, {
        tariffCode: picked.liveCode,
        country: countryLabel,
      });
      if (parsed.length < MIN_PACK) {
        setPackFail(true);
        onItems([{ name: "", qty: 1, unitPrice: 0 }]);
        return;
      }
      applyPackItems(parsed, file.name);
      setPackFail(false);
    } catch {
      setPackFail(true);
      onItems([{ name: "", qty: 1, unitPrice: 0 }]);
    } finally {
      setPackReading(false);
    }
  };

  const resetMulti = () => {
    setPackFail(false);
    setPackDocName("");
    onItems([{ name: "", qty: 1, unitPrice: 0 }]);
    onForm({ title: "", description: "" });
    setPackModal(false);
  };

  const tryCreate = () => {
    if (!valid) return;
    const iso = originIso(countryLabel);
    if (isPack) {
      const nextItems = items
        .filter((it) => it.name.trim())
        .slice(0, picked.max)
        .map((it) => ({
          ...it,
          name: it.name.trim(),
          attrs: {
            ...it.attrs,
            originCountry: it.attrs?.originCountry || iso,
            composition: it.attrs?.composition?.trim() || it.name.trim() || desc,
          },
        }));
      const title = form.title.trim() || `Пакет ${nextItems.length} позиций`;
      void onCreate({
        items: nextItems,
        form: {
          title,
          description: desc || title,
          country: countryLabel,
          tariffCode: picked.liveCode,
        },
      });
      return;
    }
    const title = form.title.trim() || desc.slice(0, 80);
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

  const dropzone = (
    kind: "photo" | "pack",
    inputFile: typeof fileRef,
    inputCam: typeof camRef,
  ) => (
    <>
      <input
        ref={inputFile}
        type="file"
        accept={
          kind === "photo"
            ? "image/jpeg,image/png,image/webp,image/*"
            : ".csv,.xlsx,.xls,.pdf,image/jpeg,image/png,image/webp,text/csv,application/pdf"
        }
        hidden
        onChange={(e) => {
          if (kind === "photo") addPhoto(e.target.files);
          else void addPackFile(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={inputCam}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          if (kind === "photo") addPhoto(e.target.files);
          else void addPackFile(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        className={`dropzone${uploading ? " reading" : ""}`}
        onClick={() => inputFile.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (kind === "photo") addPhoto(e.dataTransfer.files);
          else void addPackFile(e.dataTransfer.files);
        }}
      >
        <strong>
          {packReading
            ? "Читаем файл…"
            : kind === "photo"
              ? uploading
                ? "Загружаем фото…"
                : "Перетащите фото товара или сделайте снимок"
              : "Перетащите invoice, packing list или таблицу"}
        </strong>
        <span className="meta">
          {kind === "photo"
            ? "JPG, PNG, WEBP · ИИ опишет товар · до 12 МБ"
            : "CSV, PDF, JPG · читаем реальные позиции · до 12 МБ"}
        </span>
        <div className="dropzone-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => inputFile.current?.click()}
            disabled={uploading}
          >
            Выбрать файлы
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => inputCam.current?.click()}
            disabled={uploading}
          >
            Снять фото
          </button>
        </div>
      </div>
    </>
  );

  return (
    <section className="wiz-full">
      <div className="wiz-head">
        <div>
          <Link href={homeHref} className="btn btn-ghost btn-sm">
            ← На главную
          </Link>
          <span className="go-kicker" style={{ display: "block", marginTop: 14 }}>
            {isPack
              ? "Просчёт кода ТН ВЭД ЕАЭС"
              : "Первый код бесплатный · этот просчёт только ТН ВЭД"}
          </span>
          <h2>Что ввозите?</h2>
        </div>
      </div>

      <div className="wiz-steps labeled steps-3">
        {WIZ_STEPS.map((lab, i) => (
          <button key={lab} type="button" className={i === 0 ? "on" : ""}>
            <b>{i + 1}</b>
            <span className="wiz-step-lab">{lab}</span>
          </button>
        ))}
      </div>

      <div className="wiz-grid">
        <div className="wiz-main card" style={{ margin: 0 }}>
          <p className="wiz-lead">
            {isPack
              ? "Прикрепите инвойс, таблицу или фото — читаем реальные позиции и считаем стоимость."
              : "Одна позиция: описание товара и документы для кода ТН ВЭД."}
          </p>

          {isPack ? null : (
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
          )}

          <div className="field">
            <label>Режим</label>
            <div className="amt-chips">
              <button type="button" className={!isPack ? "on" : ""} onClick={() => pickPack("one")}>
                Одна позиция{isPack ? "" : " · 1 бесплатно"}
              </button>
              <button type="button" className={isPack ? "on" : ""} onClick={() => pickPack("m20")}>
                Мультипозиция
              </button>
              {isPack ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPackModal(true)}>
                  Прикрепить файл
                </button>
              ) : null}
            </div>
            {isPack && packN >= MIN_PACK ? (
              <div className="pack-quote">
                <strong>В файле {packN} позиций</strong>
                <span>
                  Пакет «{picked.name}»: {fmtRub(picked.priceRub)} ₽
                  <small> · до {picked.max} строк</small>
                </span>
              </div>
            ) : isPack ? (
              packDocName || packFail ? (
                <span className="meta pack-read-fail">
                  Не удалось вычитать позиции. Нужен CSV/Excel или более чёткое фото таблицы
                  инвойса.
                </span>
              ) : (
                <span className="meta">
                  Прикрепите invoice, CSV или фото — читаем реальные строки и считаем стоимость.
                </span>
              )
            ) : null}
          </div>

          {isPack ? (
            <>
              <div className="field">
                <label>Комментарий к партии (необязательно)</label>
                <textarea
                  rows={3}
                  placeholder="Например: поставка электроники, инвойс на 15 SKU"
                  value={form.description}
                  onChange={(e) => setGoodsText(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Страна происхождения</label>
                <select value={countryLabel} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={`${c.iso}-${c.label}`} value={c.label}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Документы и фото</label>
                {packModal ? null : dropzone("pack", packFileRef, packCamRef)}
                {packDocName ? (
                  <div className="doc-list">
                    <div className="doc-chip">
                      <div className="doc-info">
                        <b>{packDocName}</b>
                        <span className="meta">{packN >= MIN_PACK ? `${packN} позиций` : "прикреплён"}</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              {packN >= MIN_PACK ? (
                <div className="field">
                  <label>Позиции и характеристики</label>
                  <div className="doc-list">
                    {items
                      .filter((it) => it.name.trim())
                      .map((it, i) => (
                        <div key={`${it.name}-${i}`} className="doc-chip">
                          <div className="doc-info">
                            <b>
                              {i + 1}. {it.name}
                            </b>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
              <div className="field" style={{ marginTop: 22 }}>
                <label>Тариф просчёта кода ТН ВЭД</label>
                <p className="meta" style={{ margin: "0 0 10px" }}>
                  Сначала считаем только код. Таможню — пошлину и НДС — после кода, отдельным шагом.
                </p>
                <div className="tariff-pick">
                  {packs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`${picked.id === t.id ? "on" : ""}${t.featured ? " featured" : ""}`}
                      onClick={() => pickPack(t.id)}
                    >
                      <span className="tariff-tag">{t.tag}</span>
                      <strong>{t.name}</strong>
                      <div className="tariff-price">
                        {fmtRub(t.priceRub)} ₽
                        <small>{t.id === "one" ? "/ 1 позиция" : `/ до ${t.max} поз.`}</small>
                      </div>
                      <p>{t.summary}</p>
                      <ul>
                        {t.includes.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
                <div className="tariff-note">
                  <strong>{picked.name}:</strong> {fmtRub(picked.priceRub)} ₽ за просчёт кодов, без
                  таможни.
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label>Наименование и описание</label>
                <textarea
                  rows={5}
                  style={{ minHeight: 132, resize: "vertical" }}
                  placeholder="Ноутбуки Lenovo ThinkPad, 14'', для офиса — или загрузите фото ниже"
                  value={form.description || form.title}
                  onChange={(e) => setGoodsText(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Страна происхождения</label>
                <select value={countryLabel} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={`${c.iso}-${c.label}`} value={c.label}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              {visibleClarifyQs.length ? (
                <div
                  style={{
                    marginTop: 14,
                    border: "1.5px solid var(--line)",
                    borderRadius: 18,
                    padding: 16,
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "baseline",
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--display)",
                          fontWeight: 800,
                          letterSpacing: "-.02em",
                        }}
                      >
                        Уточняем для точности кода
                      </div>
                      <div className="meta" style={{ marginTop: 4 }}>
                        {clarifyLoading
                          ? "ИИ формирует вопросы…"
                          : "Ответьте, если хотите точнее подобрать ТН ВЭД"}
                      </div>
                    </div>
                  </div>
                  {visibleClarifyQs.map((q) => (
                    <div key={q.id} className="field">
                      <label>{q.text}</label>
                      <ClarifyField
                        question={q}
                        value={clarifyAnswers[q.id] || ""}
                        onChange={(v) => setClarifyAnswers((a) => ({ ...a, [q.id]: v }))}
                      />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={applyClarifications}
                      disabled={clarifyLoading}
                    >
                      <Icon name="check" /> Применить
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={skipClarifications}
                      disabled={clarifyLoading}
                    >
                      Пока пропустить
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="field">
                <label>Документы и фото</label>
                <p className="meta" style={{ margin: "0 0 10px" }}>
                  Перетащите фото товара или сделайте снимок — ИИ поможет уточнить код.
                </p>
                {dropzone("photo", fileRef, camRef)}
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
            </>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !valid}
              onClick={tryCreate}
            >
              {createBusyLabel(createPhase, busy)}
            </button>
            {isPack ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetMulti}
                disabled={!packDocName && !packN && !form.description.trim()}
              >
                Очистить
              </button>
            ) : null}
          </div>
          {isPack && packN < MIN_PACK ? (
            <p className="meta" style={{ marginTop: 8 }}>
              Прикрепите файл — минимум {MIN_PACK} позиции, в этом пакете до {picked.max}.
            </p>
          ) : null}
        </div>

        <aside className="wiz-side">
          <div className="order-hs" style={{ minHeight: 220, gridTemplateColumns: "1fr" }}>
            <div className="order-hs-copy">
              <span className="gt-kicker">
                {isPack
                  ? packN
                    ? `Пакет ${packN} позиций · после оплаты`
                    : "Код после оплаты"
                  : "Первый просчёт · 0 ₽"}
              </span>
              <div className="wiz-hs-dashes" aria-hidden>
                <i />
                <i />
                <i />
                <i />
              </div>
              <p>
                {isPack
                  ? "Приложите файл — после оплаты AI проставит код каждой строке"
                  : "Один расчёт бесплатный. Следующие заявки — по тарифам."}
              </p>
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
            {isPack ? (
              <div className="pay-row">
                <span>Позиций</span>
                <strong>{packN}</strong>
              </div>
            ) : null}
            <div className="pay-row">
              <span>Тариф</span>
              <strong>
                {isPack ? `${picked.name} · ${fmtRub(picked.priceRub)} ₽` : "первый · 0 ₽"}
              </strong>
            </div>
            <p className="meta" style={{ marginTop: 10 }}>
              Этот просчёт — только код ТН ВЭД. Таможню считаем отдельно.
            </p>
            <p className="meta" style={{ marginTop: 10 }}>
              {isPack
                ? picked.summary
                : "Первый просчёт бесплатно. Дальше 990 ₽ за один код."}
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

      {packModal ? (
        <div className="pack-modal-back" onClick={() => setPackModal(false)}>
          <div
            className="pack-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pack-modal-title"
          >
            <div className="pack-modal-head">
              <span className="go-kicker">Мультипозиция</span>
              <button
                type="button"
                className="pack-modal-x"
                aria-label="Закрыть"
                onClick={() => setPackModal(false)}
              >
                ×
              </button>
            </div>
            <h3 id="pack-modal-title">Файл с позициями</h3>
            <p className="meta" style={{ margin: "0 0 14px" }}>
              CSV, Excel, PDF или фото инвойса. Читаем строки с документа и считаем стоимость
              просчёта.
            </p>
            {dropzone("pack", packFileRef, packCamRef)}
            {packN >= MIN_PACK ? (
              <div className="pack-quote" style={{ marginTop: 14 }}>
                <strong>В файле {packN} позиций</strong>
                <span>
                  Пакет «{picked.name}»: {fmtRub(picked.priceRub)} ₽
                  <small> · до {picked.max} строк</small>
                </span>
              </div>
            ) : packDocName || packFail ? (
              <p className="meta pack-read-fail">
                Не удалось вычитать позиции. Попробуйте CSV/Excel или более чёткое фото таблицы.
              </p>
            ) : null}
            <div className="pack-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={resetMulti}>
                Очистить
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPackModal(false)}>
                Позже
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={packN < MIN_PACK}
                onClick={() => setPackModal(false)}
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
