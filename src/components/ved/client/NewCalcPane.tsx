"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusPill } from "../VedShell";
import { ProductCsvImport } from "./ProductCsvImport";
import type { Broker, Calc, CalcForm, CatalogSku, CreatePhase, FormItem, TariffOption } from "./types";
import { maxPositionsForTariffCode } from "./types";
import { SkuCatalogSelect } from "./SkuCatalogSelect";
import { ManufacturerSuggest } from "./ManufacturerSuggest";
import { AttrSuggestChips } from "./AttrSuggestChips";
import { HsHintCandidates } from "./HsHintCandidates";
import { FieldLabel, StageTip, newCalcStageTip } from "./NewCalcHints";
import { FieldSuggest } from "./FieldSuggest";
import { HsCodeAutocomplete } from "../HsCodeAutocomplete";
import { TnvedCardDrawer } from "../TnvedCardDrawer";
import { rankHeuristicCandidates } from "@/lib/ved/ai-draft-engine";
import { factoryUiEnabled } from "@/lib/ved/cabinet-features";
import { isAiDrainPending } from "@/lib/ved/ai-drain-client";
import { hasRequiredCreateAttrs } from "@/lib/ved/product-description";
import { resolveOriginCountryCode } from "@/lib/ved/field-suggest";
import { useVedToast } from "../feedback/VedToast";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import {
  newCalcWizardProgress,
  tariffMiniBlurb,
  wizardStepClass,
} from "../lbm-pane-visual";

const inputClass = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm";
const inputErrorClass = "w-full rounded-xl border border-amber-400 bg-amber-50/50 px-3 py-2 text-sm";

function fieldClass(error: boolean): string {
  return error ? inputErrorClass : inputClass;
}

function itemHasIdentity(it: FormItem): boolean {
  return Boolean(it.name.trim() || it.manufacturerSkuId);
}

function itemRequiredAttrsOk(it: FormItem): boolean {
  return hasRequiredCreateAttrs({
    originCountry: it.attrs?.originCountry?.trim().toUpperCase(),
    manufacturerName: it.attrs?.manufacturerName?.trim(),
    composition: it.attrs?.composition?.trim(),
  });
}

function createBusyLabel(phase: CreatePhase, busy: boolean): string {
  if (phase === "uploading") return "Загружаем фото…";
  if (phase === "enriching") return "Уточняем ТН ВЭД…";
  if (phase === "creating" || busy) return "Создаём заявку…";
  return "Запустить AI-расчёт";
}

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
  const [cardCode, setCardCode] = useState<string | null>(null);
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);
  const { toast } = useVedToast();
  const factoryOn = factoryUiEnabled();
  const tariffOptions = tariffs;
  const maxPos = maxPositionsForTariffCode(form.tariffCode);
  const canAdd = items.length < maxPos;
  const namedItems = items.filter(itemHasIdentity);
  const requiredAttrsOk =
    namedItems.length > 0 && namedItems.every(itemRequiredAttrsOk);
  // Soft UI: CTA enabled without required attrs; validate on click (API still hard-rejects).
  const valid =
    Boolean(form.title.trim() && form.description.trim() && namedItems.length > 0);
  const tariffsReady = tariffOptions.length > 0;
  const missingRequiredHint = namedItems.some((i) => !itemRequiredAttrsOk(i));
  const highlightRequired = showRequiredErrors && missingRequiredHint;
  const wiz = newCalcWizardProgress({
    hasGoods: Boolean(form.title.trim() && form.description.trim() && namedItems.length > 0),
    hasTariff: Boolean(form.tariffCode),
  });

  const tryCreate = () => {
    if (!requiredAttrsOk) {
      setShowRequiredErrors(true);
      toast(
        "Заполните по каждой позиции: страну происхождения (ISO-2), производителя и состав — без этого заявка не создаётся.",
        { variant: "error" },
      );
      return;
    }
    setShowRequiredErrors(false);
    void onCreate();
  };
  const needsAttrsHint = false;
  const hsText = `${form.title} ${form.description} ${items.map((i) => i.name).join(" ")}`;
  const hsCandidates =
    hsText.trim().length >= 8
      ? rankHeuristicCandidates(
          { title: form.title, description: `${form.description} ${items.map((i) => i.name).join(" ")}`, country: form.country },
          3
        )
      : [];
  const stageTip = newCalcStageTip({
    form,
    items,
    hsCandidateCount: hsCandidates.length,
    maxPos,
    hasCatalog: catalogSkus.length > 0,
    needsAttrsHint,
  });
  const pickHsHint = (hsCode: string) => {
    const next = [...items];
    const idx = next.findIndex((i) => !i.attrs?.hsHint?.trim());
    const target = idx >= 0 ? idx : 0;
    next[target] = {
      ...next[target],
      attrs: { ...next[target].attrs, hsHint: hsCode },
    };
    onItems(next);
  };

  return (
    <section className="wiz-full">
      <div className="wiz-head">
        <span className="go-kicker" style={{ display: "block" }}>
          Просчёт кода ТН ВЭД ЕАЭС
        </span>
        <h2>Что ввозите?</h2>
        <p className="wiz-lead">
          Опишите товар — heuristic подготовит черновик. STANDARD/PRO после оплаты уходят брокеру.
          Поля не прячутся: шаги слева только показывают прогресс.
        </p>
      </div>
      <div className="wiz-steps labeled steps-3">
        {wiz.labels.map((lab, i) => {
          const n = i + 1;
          return (
            <button
              key={lab}
              type="button"
              className={wizardStepClass(n, wiz.current)}
              onClick={() => {
                const el = document.getElementById(
                  n === 1 ? "wiz-section-goods" : n === 2 ? "wiz-section-tariff" : "wiz-section-launch",
                );
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <b>{n}</b>
              {lab}
            </button>
          );
        })}
      </div>
      {!tariffsReady && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Тарифы не загружены. Обновите страницу или проверьте /api/v1/tariffs.
        </p>
      )}
      <div className="wiz-grid">
      <div id="wiz-section-goods" className="card wiz-main space-y-3 overflow-visible">
        {/* One help surface: hide tip when required-error banner is up (same message). */}
        {stageTip && !highlightRequired && <StageTip text={stageTip} />}

        <FieldLabel
          as="div"
          label="Наименование заявки"
          hint="Как вы узнаете заявку в списке — коротко и по сути партии. Начните вводить — появятся варианты (кроссовки, носки…)."
        >
          <FieldSuggest
            kind="itemName"
            className={inputClass}
            placeholder="Например: кроссовки Nike, партия из Китая"
            value={form.title}
            onChange={(title) => onForm({ title })}
          />
        </FieldLabel>

        <FieldLabel
          as="div"
          label="Описание партии"
          hint="Что за товар, материал, назначение — от этого строится черновик ТН ВЭД. Начните вводить — появятся примеры формулировок."
        >
          <FieldSuggest
            kind="partyDescription"
            multiline
            rows={3}
            className={inputClass}
            placeholder="Состав, назначение, упаковка — чем конкретнее, тем точнее черновик"
            value={form.description}
            onChange={(description) => onForm({ description })}
          />
        </FieldLabel>

        <HsHintCandidates
          candidates={hsCandidates}
          selectedHs={items[0]?.attrs?.hsHint}
          onPick={pickHsHint}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel
            as="div"
            label="Страна отправления"
            hint="Откуда едет партия (не обязательно ISO)."
          >
            <FieldSuggest
              kind="shipCountry"
              className={inputClass}
              placeholder="Китай, Турция…"
              value={form.country}
              onChange={(country) => onForm({ country })}
            />
          </FieldLabel>
          <FieldLabel
            as="div"
            label="Стоимость партии (инвойс)"
            hint="Таможенная стоимость = инвойс × курс с запасом. Без международной доставки."
          >
            <div className="flex min-w-0 gap-2">
              <input
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="0"
                inputMode="decimal"
                value={form.shipmentValue}
                onChange={(e) => onForm({ shipmentValue: e.target.value })}
                aria-label="Сумма инвойса"
              />
              <select
                className="w-[7.5rem] shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.shipmentCurrency}
                onChange={(e) =>
                  onForm({ shipmentCurrency: e.target.value as CalcForm["shipmentCurrency"] })
                }
                aria-label="Валюта инвойса"
              >
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </FieldLabel>
        </div>

        <div id="wiz-section-tariff">
        <FieldLabel
          as="div"
          label="Тариф"
          hint={
            form.tariffCode === "EXPRESS"
              ? "Экспресс: 1 позиция, только AI — без выбора брокера."
              : `Лимит позиций: до ${maxPos}. Стандарт/Профи — очередь брокера после оплаты.`
          }
        >
          <div className="three" style={{ marginTop: 8 }}>
            {tariffOptions.map((t) => {
              const on = form.tariffCode === t.code;
              return (
                <button
                  key={t.id || t.code}
                  type="button"
                  disabled={!tariffsReady}
                  className={`tariff-mini${on ? " featured" : ""}`}
                  style={{ textAlign: "left", width: "100%" }}
                  onClick={() => {
                    onForm({
                      tariffCode: t.code,
                      ...(t.code === "EXPRESS" ? { preferredBrokerUserId: "" } : {}),
                    });
                    const cap = maxPositionsForTariffCode(t.code);
                    if (items.length > cap) onItems(items.slice(0, cap));
                  }}
                >
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
                </button>
              );
            })}
          </div>
          {!tariffsReady ? (
            <p className="mt-2 text-xs text-[var(--kb-muted)]">Загрузка тарифов…</p>
          ) : null}
        </FieldLabel>
        </div>

        {form.tariffCode !== "EXPRESS" ? (
          <FieldLabel
            label="Предпочтительный брокер"
            hint="Необязательно — иначе заявка уйдёт в общую очередь после оплаты."
          >
            <select
              className={inputClass}
              value={form.preferredBrokerUserId}
              onChange={(e) => onForm({ preferredBrokerUserId: e.target.value })}
            >
              <option value="">Авто из очереди</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.user.id}>
                  {b.user.name}
                </option>
              ))}
            </select>
          </FieldLabel>
        ) : null}

        <ProductCsvImport
          tariffCode={form.tariffCode}
          country={form.country}
          shipmentValue={form.shipmentValue}
          busy={busy}
          maxPos={maxPos}
          onApply={({ items: nextItems, titleHint, descriptionHint, create }) => {
            const patch: Partial<CalcForm> = {};
            if (!form.title.trim()) patch.title = titleHint;
            if (!form.description.trim()) patch.description = descriptionHint;
            if (create) {
              void onCreate({
                items: nextItems,
                form: {
                  title: form.title.trim() || titleHint,
                  description: form.description.trim() || descriptionHint,
                },
              });
              return;
            }
            onItems(nextItems);
            if (Object.keys(patch).length) onForm(patch);
          }}
        />

        <div>
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            <span>Позиции (max {maxPos})</span>
            <button
              type="button"
              disabled={!canAdd}
              title={!canAdd ? `Лимит тарифа: ${maxPos}` : undefined}
              className="text-[#2b72f4] disabled:opacity-40"
              onClick={() => onItems([...items, { name: "", qty: 1, unitPrice: 0 }])}
            >
              + позиция
            </button>
          </div>
          {!canAdd && (
            <p className="mb-2 text-[11px] text-[var(--kb-muted)]">
              Достигнут лимит тарифа ({maxPos}). Смените тариф или уберите лишнюю строку.
            </p>
          )}
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="relative overflow-visible rounded-2xl border border-slate-100 p-3">
                {factoryOn ? (
                  <div className="mb-2">
                    <ManufacturerSuggest
                      value={{
                        manufacturerName: it.attrs?.manufacturerName ?? "",
                        companyId: it.attrs?.extra?.manufacturerCompanyId,
                        proposalId: it.attrs?.extra?.manufacturerProposalId,
                        status: it.attrs?.extra?.manufacturerProposalId
                          ? "pending"
                          : it.attrs?.extra?.manufacturerCompanyId
                            ? "approved"
                            : it.attrs?.manufacturerName
                              ? "draft"
                              : undefined,
                      }}
                      disabled={busy}
                      onChange={(next) => {
                        const copy = [...items];
                        const extra = { ...(copy[idx].attrs?.extra || {}) };
                        if (next.proposalId) extra.manufacturerProposalId = next.proposalId;
                        else delete extra.manufacturerProposalId;
                        if (next.companyId) extra.manufacturerCompanyId = next.companyId;
                        else delete extra.manufacturerCompanyId;
                        copy[idx] = {
                          ...copy[idx],
                          attrs: {
                            ...copy[idx].attrs,
                            manufacturerName: next.manufacturerName.trim() || undefined,
                            extra: Object.keys(extra).length ? extra : undefined,
                          },
                        };
                        onItems(copy);
                      }}
                    />
                    <p className="mt-1 text-[11px] text-amber-800">Обязательно · производитель</p>
                  </div>
                ) : (
                  <FieldLabel
                    label="Производитель *"
                    hint="Завод или бренд-изготовитель — нужен для точного кода ТН ВЭД."
                  >
                    <input
                      className={`mb-2 ${fieldClass(highlightRequired && itemHasIdentity(it) && !String(it.attrs?.manufacturerName || "").trim())}`}
                      placeholder="Lenovo PC HK Limited, Nike Vietnam…"
                      value={it.attrs?.manufacturerName ?? ""}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = {
                          ...next[idx],
                          attrs: {
                            ...next[idx].attrs,
                            manufacturerName: e.target.value,
                          },
                        };
                        onItems(next);
                      }}
                    />
                  </FieldLabel>
                )}
                {factoryOn && it.manufacturerSkuId && (
                  <SkuCatalogSelect
                    skus={catalogSkus}
                    item={it}
                    onApply={(next) => {
                      const copy = [...items];
                      copy[idx] = next;
                      onItems(copy);
                    }}
                  />
                )}
                <FieldLabel
                  as="div"
                  label={`Позиция ${idx + 1}`}
                  hint="Краткое имя товара — начните вводить, появятся варианты (носки, ноут…)."
                >
                  <FieldSuggest
                    kind="itemName"
                    className={`mb-2 ${inputClass}`}
                    placeholder="Например: носки, ноутбук, станок…"
                    value={it.name}
                    onChange={(name) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], name };
                      onItems(next);
                    }}
                  />
                </FieldLabel>
                <AttrSuggestChips
                  title={form.title}
                  description={form.description}
                  item={it}
                  itemIndex={idx}
                  items={items}
                  onItems={onItems}
                />
                <div className="mb-2 flex gap-2">
                  <FieldLabel label="Кол-во">
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="1"
                      value={it.qty ?? ""}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], qty: Number(e.target.value) || undefined };
                        onItems(next);
                      }}
                    />
                  </FieldLabel>
                  <FieldLabel label="Цена ед., USD">
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="0"
                      value={it.unitPrice ?? ""}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = {
                          ...next[idx],
                          unitPrice: Number(e.target.value) || undefined,
                        };
                        onItems(next);
                      }}
                    />
                  </FieldLabel>
                </div>

                <div className="mb-2 grid gap-2 sm:grid-cols-2">
                  <FieldLabel
                    as="div"
                    label="Страна происхождения *"
                    hint="ISO-2: начните вводить код или название (CN, Китай…)."
                  >
                    <FieldSuggest
                      kind="originCountry"
                      className={fieldClass(
                        highlightRequired &&
                          itemHasIdentity(it) &&
                          String(it.attrs?.originCountry || "").trim().length !== 2
                      )}
                      placeholder="CN или Китай"
                      value={it.attrs?.originCountry ?? ""}
                      resolveBlur={(raw) => resolveOriginCountryCode(raw) || raw}
                      onChange={(originCountry) => {
                        const next = [...items];
                        next[idx] = {
                          ...next[idx],
                          attrs: { ...next[idx].attrs, originCountry },
                        };
                        onItems(next);
                      }}
                    />
                  </FieldLabel>
                  <FieldLabel as="div" label="Состав *" hint="Материалы / волокна / комплектация.">
                    <FieldSuggest
                      kind="composition"
                      className={fieldClass(
                        highlightRequired &&
                          itemHasIdentity(it) &&
                          !String(it.attrs?.composition || "").trim()
                      )}
                      placeholder="хлопок 100% / aluminium + Li-ion…"
                      value={it.attrs?.composition ?? ""}
                      onChange={(composition) => {
                        const next = [...items];
                        next[idx] = {
                          ...next[idx],
                          attrs: { ...next[idx].attrs, composition },
                        };
                        onItems(next);
                      }}
                    />
                  </FieldLabel>
                  <FieldLabel as="div" label="Бренд">
                    <FieldSuggest
                      kind="brand"
                      className={inputClass}
                      placeholder="Nike, Samsung…"
                      value={it.attrs?.brand ?? ""}
                      onChange={(brand) => {
                        const next = [...items];
                        next[idx] = {
                          ...next[idx],
                          attrs: { ...next[idx].attrs, brand },
                        };
                        onItems(next);
                      }}
                    />
                  </FieldLabel>
                  <FieldLabel as="div" label="Материал">
                    <FieldSuggest
                      kind="material"
                      className={inputClass}
                      placeholder="Кожа, пластик, хлопок…"
                      value={it.attrs?.material ?? ""}
                      onChange={(material) => {
                        const next = [...items];
                        next[idx] = {
                          ...next[idx],
                          attrs: { ...next[idx].attrs, material },
                        };
                        onItems(next);
                      }}
                    />
                  </FieldLabel>
                  <FieldLabel label="Назначение / тип">
                    <input
                      className={inputClass}
                      placeholder="одежда, верх"
                      value={it.attrs?.purpose ?? ""}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = {
                          ...next[idx],
                          attrs: { ...next[idx].attrs, purpose: e.target.value },
                        };
                        onItems(next);
                      }}
                    />
                  </FieldLabel>
                  <FieldLabel label="Цвет">
                    <input
                      className={inputClass}
                      placeholder="белый"
                      value={it.attrs?.extra?.color ?? ""}
                      onChange={(e) => {
                        const next = [...items];
                        const extra = { ...(next[idx].attrs?.extra || {}) };
                        if (e.target.value.trim()) extra.color = e.target.value;
                        else delete extra.color;
                        next[idx] = {
                          ...next[idx],
                          attrs: {
                            ...next[idx].attrs,
                            extra: Object.keys(extra).length ? extra : undefined,
                          },
                        };
                        onItems(next);
                      }}
                    />
                  </FieldLabel>
                  <FieldLabel label="Возраст" hint="Взрослый / детский — влияет на главу одежды.">
                    <input
                      className={inputClass}
                      placeholder="взрослый"
                      value={it.attrs?.extra?.ageGroup ?? ""}
                      onChange={(e) => {
                        const next = [...items];
                        const extra = { ...(next[idx].attrs?.extra || {}) };
                        if (e.target.value.trim()) extra.ageGroup = e.target.value;
                        else delete extra.ageGroup;
                        next[idx] = {
                          ...next[idx],
                          attrs: {
                            ...next[idx].attrs,
                            extra: Object.keys(extra).length ? extra : undefined,
                          },
                        };
                        onItems(next);
                      }}
                    />
                  </FieldLabel>
                  <FieldLabel label="Вес нетто, кг">
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="0"
                      value={it.attrs?.netWeightKg ?? ""}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = {
                          ...next[idx],
                          attrs: { ...next[idx].attrs, netWeightKg: e.target.value },
                        };
                        onItems(next);
                      }}
                    />
                  </FieldLabel>
                  <div className="sm:col-span-2">
                    <FieldLabel
                      as="div"
                      label="Код ТН ВЭД (черновик)"
                      hint="Найдите код по названию или цифрам. Финал подтвердит брокер."
                    >
                      <HsCodeAutocomplete
                        leafOnly
                        className={inputClass}
                        placeholder="смартфон или 8517"
                        value={it.attrs?.hsHint ?? ""}
                        onChange={(hsHint) => {
                          const next = [...items];
                          next[idx] = {
                            ...next[idx],
                            attrs: { ...next[idx].attrs, hsHint },
                          };
                          onItems(next);
                        }}
                        onOpenCard={setCardCode}
                      />
                    </FieldLabel>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="mb-1 text-[11px] text-[var(--kb-muted)]">
                      Фото или скан — брокеру проще сверить товар.
                    </p>
                    <input
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onUpload(f, idx);
                      }}
                    />
                  </div>
                  {it.mediaUrl && <span className="text-emerald-600">файл ✓</span>}
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="text-red-500"
                      onClick={() => onItems(items.filter((_, i) => i !== idx))}
                    >
                      удалить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div id="wiz-section-launch">
        {highlightRequired && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Не хватает обязательных полей по позиции: страна происхождения (ISO-2), производитель и состав.
            Заполните подсвеченные поля и нажмите ещё раз.
          </p>
        )}

        <button
          type="button"
          disabled={busy || !valid || !tariffsReady}
          onClick={tryCreate}
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
        >
          {createBusyLabel(createPhase, busy)}
        </button>
        </div>
      </div>
      <aside className="wiz-side">
        <DesignerStub
          compact
          title="1-й код бесплатно"
          intent="Дизайнер хотел баннер «первый просчёт — 0 ₽» и шаг «Бесплатно» в визарде."
          gap="Нет freemium-гейта (D11): брокер только после оплаты тарифа D10."
        />
        <DesignerStub
          compact
          title="Пакеты 20 / 100 позиций"
          intent="Макет предлагал пачки m20/m100 из файла сверх одного просчёта."
          gap="Лимиты D10: EXPRESS 1 / STANDARD 3 / PRO 10. CSV остаётся в форме ниже."
        />
        <DesignerStub
          compact
          title="Код / Таможня / Под ключ"
          intent="Воронка апгрейда тарифа с карточки заявки (UpgradeTile)."
          gap="Пакет LBM — TariffCode EXPRESS/STANDARD/PRO, не смена линейки на карточке."
        />
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
      <TnvedCardDrawer code={cardCode} onClose={() => setCardCode(null)} />
    </section>
  );
}
