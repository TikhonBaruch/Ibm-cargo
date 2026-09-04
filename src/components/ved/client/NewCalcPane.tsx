"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClarifyField } from "@/lbm-bro/components/clarify-field";
import { Icon } from "@/lbm-bro/components/icon";
import { PayMath } from "@/lbm-bro/components/pay-math";
import {
  getClarificationQuestions,
  type ClarificationQuestion,
} from "@/lbm-bro/lib/clarify-ai";
import type { Broker, Calc, CalcForm, CatalogSku, CreatePhase, FormItem, Me, TariffOption } from "./types";
import { clientOrderHref } from "./types";
import { isAiDrainPending } from "@/lib/ved/ai-drain-client";
import {
  aiRunTitle,
  calcConfidencePct,
  classificationHeroKicker,
  classificationWhyBody,
  classificationWhyTitle,
  needsClassificationClarify,
  shouldRevealClientDraftHs,
} from "@/lib/ved/ai-classification-copy";
import { clientOrderHsLabel, wizardStepClass } from "../lbm-pane-visual";
import { AiRunCard } from "./AiRunCard";
import type { HeuristicHsCandidate } from "@/lib/ved/ai-draft-engine";
import { api } from "../VedShell";
import { originCountrySelectOptions, resolveOriginCountryCode } from "@/lib/ved/field-suggest";
import {
  appendClarifyBlock,
  compositionFromClarify,
  hsHintFromClarify,
  progressiveClarifyQuestions,
  unansweredClarifyParts,
  wizardDraftForClarify,
} from "./new-calc-clarify";
import { hintTreeQuestions } from "@/lib/ved/tnved-hint-trees";
import {
  MIN_PACK,
  allPackChrome,
  fmtRub,
  isPackImageFile,
  liveCodeForPack,
  liveWizardStepLabels,
  namedItemCount,
  packIdForLiveCode,
  previewPackFile,
  resolvePackChrome,
  type PackId,
  type PackMode,
} from "./new-calc-pack";
import { NewCalcDirectoryHints } from "./NewCalcDirectoryHints";
import { directoryHintHsHint } from "./new-calc-directory-hints";

const COUNTRY_OPTIONS = originCountrySelectOptions();

function createBusyLabel(phase: CreatePhase, busy: boolean, photoVisionBusy = false): string {
  if (photoVisionBusy) return "ИИ описывает товар…";
  if (phase === "uploading") return "Загружаем фото…";
  if (phase === "enriching") return "Уточняем ТН ВЭД…";
  if (phase === "paying") return "Оплата тарифа…";
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
  me,
  preferredBrokerUserId,
  ordersHref,
  onForm,
  onItems,
  onCreate,
  onPreferred,
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
  me: Me | null;
  preferredBrokerUserId: string;
  /** @deprecated C29c — live always charges TariffPlan; kept for call-site compat */
  hasPaidCalcBefore?: boolean;
  ordersHref: string;
  onForm: (patch: Partial<CalcForm>) => void;
  onItems: (items: FormItem[]) => void;
  onCreate: (
    override?: { items?: FormItem[]; form?: Partial<CalcForm> },
    opts?: { payAfter?: boolean; stayOnNew?: boolean }
  ) => void | Promise<Calc | void>;
  onPreferred: (id: string) => void;
  onUpload: (file: File, index: number) => Promise<string | void>;
}) {
  void catalogSkus;
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const packFileRef = useRef<HTMLInputElement>(null);
  const packCamRef = useRef<HTMLInputElement>(null);
  const homeHref = homeFromOrders(ordersHref);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [packMode, setPackMode] = useState<PackMode>("single");
  const [packModal, setPackModal] = useState(false);
  const [packReading, setPackReading] = useState(false);
  const [photoVisionBusy, setPhotoVisionBusy] = useState(false);
  const [photoVisionNote, setPhotoVisionNote] = useState("");
  const [packFail, setPackFail] = useState(false);
  const [packDocName, setPackDocName] = useState("");
  const [packThumbUrl, setPackThumbUrl] = useState("");
  const [clarifyQs, setClarifyQs] = useState<ClarificationQuestion[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>({});
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [clarifyAppliedIds, setClarifyAppliedIds] = useState<string[]>([]);
  const [postPayAlts, setPostPayAlts] = useState<HeuristicHsCandidate[]>([]);
  const [directoryHintTaken, setDirectoryHintTaken] = useState(false);
  const isPack = packMode === "multi";
  const packId = packIdForLiveCode(
    isPack ? form.tariffCode || "STANDARD" : "EXPRESS"
  );
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
  const packReadFailCopy = packDocName
    ? "Не удалось вычитать таблицу. Файл прикреплён — нужен CSV/Excel или более чёткое фото инвойса с несколькими позициями."
    : "Не удалось вычитать позиции. Нужен CSV/Excel или более чёткое фото таблицы инвойса.";
  const uploading = createPhase === "uploading" || packReading || photoVisionBusy;
  const goodsText = form.description || form.title;
  const clarifyEnabled = !isPack;
  const packStepIds = clarifyEnabled ? hintTreeQuestions(desc).map((q) => q.id) : [];
  const visibleClarifyQs = clarifyEnabled
    ? progressiveClarifyQuestions(clarifyQs, clarifyAnswers, packStepIds)
    : [];
  const aiEnriching =
    createPhase === "enriching" ||
    createPhase === "creating" ||
    createPhase === "paying" ||
    (selected ? isAiDrainPending(selected) : false);
  const codeUnlocked = selected ? shouldRevealClientDraftHs(selected) : false;
  const previewHs =
    codeUnlocked && selected
      ? clientOrderHsLabel({ hsCode: selected.hsCode, hsCodeFinal: selected.hsCodeFinal })
      : null;
  const previewHasHs = Boolean(previewHs && previewHs !== "—");
  const previewConf = codeUnlocked && selected ? calcConfidencePct(selected) : null;
  const payAmount = picked.priceRub;
  const balance = me?.company?.balanceRub ?? 0;
  const canPay = balance >= payAmount;
  const productTitle =
    form.title.trim() ||
    desc.slice(0, 80) ||
    (isPack ? `Пакет ${packN} позиций` : "Новый товар");
  const wizardTitles = ["", "Что ввозите?", "Оплата просчёта кода", "Код ТН ВЭД"] as const;

  useEffect(() => {
    if (!packModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPackModal(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [packModal]);

  /** C29b: cascade top-N only after pay (never pre-pay leak). */
  useEffect(() => {
    if (wizardStep !== 3 || !selected?.paidAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear when leaving post-pay step
      setPostPayAlts([]);
      return;
    }
    const q = (
      selected.description ||
      selected.title ||
      selected.items?.[0]?.name ||
      ""
    ).trim();
    if (q.length < 3) {
      setPostPayAlts([]);
      return;
    }
    let alive = true;
    void api<{ items: Array<{ hsCode: string; confidence: number; why: string }> }>(
      `/api/v1/tnved/classify-preview?q=${encodeURIComponent(q)}&limit=3`,
    )
      .then((res) => {
        if (!alive) return;
        const items = Array.isArray(res?.items) ? res.items : [];
        setPostPayAlts(
          items.map((it, i) => ({
            id: `post-${it.hsCode}-${i}`,
            hsCode: it.hsCode,
            confidence: it.confidence,
            why: it.why,
          })),
        );
      })
      .catch(() => {
        if (alive) setPostPayAlts([]);
      });
    return () => {
      alive = false;
    };
  }, [wizardStep, selected]);

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

  useEffect(() => {
    return () => {
      if (packThumbUrl) URL.revokeObjectURL(packThumbUrl);
    };
  }, [packThumbUrl]);

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
      onForm({ tariffCode: "EXPRESS" });
      const first = items[0] ? { ...items[0] } : { name: "", qty: 1, unitPrice: 0 };
      onItems([first]);
      return;
    }
    setPackMode("multi");
    setDirectoryHintTaken(false);
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

  const addPhoto = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || photoVisionBusy) return;
    setPhotoVisionBusy(true);
    setPhotoVisionNote("");
    try {
      const url = await onUpload(file, 0);
      if (!url) return;
      // Fail-open: do not use api() — 4xx must not wipe the upload.
      const res = await fetch("/api/v1/imports/products/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: url, hint: goodsText.trim().slice(0, 120) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        description?: string;
        name?: string;
        attrs?: FormItem["attrs"];
        skipped?: boolean;
        error?: string;
      };
      const text = typeof data.description === "string" ? data.description.trim() : "";
      if (res.ok && text) {
        const title =
          data.name?.trim() || text.split(/[.!?\n]/)[0]?.trim().slice(0, 120) || text.slice(0, 80);
        onForm({ title, description: text });
        const base = items[0] || { name: "", qty: 1, unitPrice: 0 };
        const next = [...items];
        next[0] = {
          ...base,
          mediaUrl: url,
          name: title || base.name,
          attrs: {
            ...base.attrs,
            ...(data.attrs?.composition ? { composition: data.attrs.composition } : {}),
            ...(data.attrs?.material ? { material: data.attrs.material } : {}),
            ...(data.attrs?.purpose ? { purpose: data.attrs.purpose } : {}),
            ...(data.attrs?.brand ? { brand: data.attrs.brand } : {}),
          },
        };
        onItems(next);
        setPhotoVisionNote("Описание заполнено по фото");
      } else {
        setPhotoVisionNote(
          "Фото прикреплено. Описание ИИ недоступно — заполните наименование вручную."
        );
      }
    } catch {
      setPhotoVisionNote(
        "Фото прикреплено. Не удалось описать товар — заполните наименование вручную."
      );
    } finally {
      setPhotoVisionBusy(false);
    }
  };

  const addPackFile = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || packReading) return;
    setPackReading(true);
    setPackFail(false);
    setPackDocName(file.name);
    if (isPackImageFile(file)) {
      setPackThumbUrl(URL.createObjectURL(file));
    } else {
      setPackThumbUrl("");
    }
    try {
      const { items: parsed, notes } = await previewPackFile(file, {
        tariffCode: picked.liveCode,
        country: countryLabel,
      });
      if (parsed.length >= MIN_PACK) {
        applyPackItems(parsed, file.name);
        setPackFail(false);
        return;
      }
      setPackFail(true);
      onItems(
        parsed.length ? parsed.slice(0, picked.max) : [{ name: "", qty: 1, unitPrice: 0 }],
      );
      const extra = [parsed.map((p) => p.name).filter(Boolean).join("; "), notes]
        .filter(Boolean)
        .join("\n");
      if (extra && !form.description.trim()) {
        onForm({ description: extra });
      }
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
    setPackThumbUrl("");
    onItems([{ name: "", qty: 1, unitPrice: 0 }]);
    onForm({ title: "", description: "" });
    setPackModal(false);
    setDirectoryHintTaken(false);
  };

  const buildCreatePayload = () => {
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
      return {
        items: nextItems,
        form: {
          title,
          description: desc || title,
          country: countryLabel,
          tariffCode: picked.liveCode,
          preferredBrokerUserId,
        },
      };
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
    return {
      items: nextItems,
      form: {
        title,
        description: desc,
        country: countryLabel,
        tariffCode: "EXPRESS",
        preferredBrokerUserId,
      },
    };
  };

  const goToPayStep = () => {
    if (!valid) return;
    setWizardStep(2);
  };

  const payAndCreate = () => {
    if (!valid || busy) return;
    void Promise.resolve(onCreate(buildCreatePayload(), { payAfter: true, stayOnNew: true }))
      .then(() => setWizardStep(3))
      .catch(() => undefined);
  };

  const tryCreate = () => {
    goToPayStep();
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
            Просчёт кода ТН ВЭД ЕАЭС · код после оплаты
          </span>
          <h2>{wizardTitles[wizardStep]}</h2>
        </div>
      </div>

      <div className="wiz-steps labeled steps-3">
        {liveWizardStepLabels().map((lab, i) => (
          <button
            key={lab}
            type="button"
            className={wizardStepClass(i + 1, wizardStep)}
            onClick={() => {
              if (wizardStep === 3 && selected?.paidAt) return;
              if (i + 1 < wizardStep) setWizardStep((i + 1) as 1 | 2 | 3);
            }}
          >
            <b>{i + 1}</b>
            <span className="wiz-step-lab">{lab}</span>
          </button>
        ))}
      </div>

      {wizardStep === 3 && aiEnriching && !previewHasHs ? (
        <div className="ai-run card" style={{ margin: 0 }}>
          <AiRunCard
            title={
              createPhase === "paying"
                ? "Оплата прошла — AI подбирает код"
                : aiRunTitle(true, isPack && packN >= MIN_PACK)
            }
          />
        </div>
      ) : (
      <div className="wiz-grid">
        <div className="wiz-main card" style={{ margin: 0 }}>
          {wizardStep === 2 ? (
            <>
              <p className="wiz-lead">
                Оплачивается пакет «{picked.name}»: только коды ТН ВЭД. Пошлина и НДС не входят.
                После оплаты AI подберёт черновик кода.
              </p>
              <div className="wiz-pay-box">
                <div className="pay-row">
                  <span>Товар</span>
                  <strong>{productTitle}</strong>
                </div>
                <div className="pay-row">
                  <span>Происхождение</span>
                  <strong>{countryLabel}</strong>
                </div>
                <div className="pay-row">
                  <span>Тариф</span>
                  <strong>
                    {picked.name} · {fmtRub(payAmount)} ₽
                  </strong>
                </div>
                <PayMath balance={balance} amount={payAmount} />
              </div>
              <div className="field" style={{ marginTop: 16 }}>
                <label>Предпочтительный брокер</label>
                <select
                  value={preferredBrokerUserId}
                  onChange={(e) => onPreferred(e.target.value)}
                >
                  <option value="">Авто из очереди</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.user.id}>
                      {b.user.name} · ★ {b.rating.toFixed(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setWizardStep(1)}>
                  Назад
                </button>
                {canPay ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={payAndCreate}
                  >
                    {busy
                      ? createBusyLabel(createPhase, busy, photoVisionBusy)
                      : `Оплатить ${fmtRub(payAmount)} ₽ и получить код`}
                  </button>
                ) : (
                  <Link href={`${homeHref}/balance`} className="btn btn-primary">
                    Пополнить баланс
                  </Link>
                )}
              </div>
            </>
          ) : wizardStep === 3 && selected?.paidAt ? (
            <>
              <p className="wiz-lead">
                {previewHasHs && aiEnriching
                  ? "Черновик кода — AI ещё уточняет. Финал подтверждает брокер (D15)."
                  : previewHasHs
                    ? "Черновик кода готов. Финал подтверждает брокер (D15)."
                    : "AI уточняет код — обновится через минуту."}
              </p>
              {previewHasHs && selected ? (
                <>
                  {aiEnriching ? (
                    <span className="pill warn" style={{ marginBottom: 10 }}>
                      Уточняется
                    </span>
                  ) : null}
                  <div className="metric-row">
                    <div className="metric">
                      <div className="k">ТН ВЭД</div>
                      <div className="v" style={{ fontSize: "1.15rem" }}>
                        {previewHs}
                      </div>
                    </div>
                    {previewConf != null ? (
                      <div className="metric">
                        <div className="k">Уверенность</div>
                        <div className="v">{previewConf}%</div>
                      </div>
                    ) : null}
                  </div>
                  {aiEnriching ? (
                    <p className="meta" style={{ marginTop: 10 }}>
                      Предварительный черновик. Точный код обновится через 1–2 минуты.
                    </p>
                  ) : null}
                  {previewConf != null ? (
                    <div className="conf">
                      <i style={{ width: `${previewConf}%` }} />
                    </div>
                  ) : null}
                  <div
                    className={`alert-box ${needsClassificationClarify(selected) ? "warn-box" : "ok-box"}`}
                    style={{ marginTop: 14 }}
                  >
                    <strong>{classificationWhyTitle(selected)}</strong>
                    {classificationWhyBody(selected)}
                  </div>
                  {postPayAlts.length > 0 ? (
                    <div style={{ marginTop: 16 }}>
                      <p className="meta" style={{ marginBottom: 8 }}>
                        Альтернативы каскада (справочно, не финал):
                      </p>
                      <ul className="doc-list" style={{ gap: 8 }}>
                        {postPayAlts.map((c) => (
                          <li key={c.id} className="doc-chip" style={{ display: "block" }}>
                            <div className="doc-info">
                              <b>{c.hsCode}</b>
                              <span className="meta">
                                {Math.round(c.confidence * 100)}% · {c.why}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : aiEnriching ? (
                <AiRunCard title={aiRunTitle(true, isPack && packN >= MIN_PACK)} />
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                <Link href={clientOrderHref(ordersHref, selected.id)} className="btn btn-primary">
                  К заявке
                </Link>
                <Link href={ordersHref} className="btn btn-ghost">
                  Все заявки
                </Link>
              </div>
            </>
          ) : (
            <>
          <p className="wiz-lead">
            {isPack
              ? "Прикрепите инвойс, таблицу или фото — читаем реальные позиции и считаем стоимость."
              : "Одна позиция: описание товара и документы. Код ТН ВЭД откроется после оплаты."}
          </p>

          <div className="field">
            <label>Режим</label>
            <div className="amt-chips">
              <button type="button" className={!isPack ? "on" : ""} onClick={() => pickPack("one")}>
                Одна позиция · {fmtRub(payAmount)} ₽
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
                  {packReadFailCopy}
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
                      {packThumbUrl ? (
                        <a href={packThumbUrl} target="_blank" rel="noreferrer" className="doc-thumb">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={packThumbUrl} alt="" />
                        </a>
                      ) : null}
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
                <label>Фото товара</label>
                <p className="meta" style={{ margin: "0 0 10px" }}>
                  Загрузите фото — ИИ распознает товар, заполнит описание и спросит, чего не хватает
                  для кода.
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
                        <span className="meta">
                          {photoVisionBusy ? "ИИ описывает…" : "прикреплено"}
                        </span>
                      </div>
                      <span className="pill ok">Фото</span>
                    </div>
                  </div>
                ) : null}
                {photoVisionNote ? (
                  <p className="meta" style={{ margin: "8px 0 0" }}>
                    {photoVisionNote}
                  </p>
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
                          : packStepIds.length > 1
                            ? "Сначала назначение / форма, затем состав"
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
            </>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !valid}
              onClick={tryCreate}
            >
              {createBusyLabel(createPhase, busy, photoVisionBusy)}
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
            </>
          )}
        </div>

        <aside className="wiz-side">
          {wizardStep === 3 && aiEnriching && !previewHasHs ? (
            <AiRunCard title={aiRunTitle(true, isPack && packN >= MIN_PACK)} />
          ) : (
            <div className="order-hs" style={{ minHeight: 220, gridTemplateColumns: "1fr" }}>
              <div className="order-hs-copy">
                <span className="gt-kicker">
                  {wizardStep >= 3 && previewHasHs && selected
                    ? classificationHeroKicker(selected, aiEnriching)
                    : wizardStep < 3
                      ? isPack
                        ? packN
                          ? `Пакет ${packN} позиций · после оплаты`
                          : "Код после оплаты"
                        : "Код после оплаты"
                      : "Код ТН ВЭД ЕАЭС"}
                </span>
                <div className="order-hs-code" style={{ fontSize: "1.35rem", marginTop: 8 }}>
                  {wizardStep >= 3 && previewHasHs && previewHs ? previewHs : "— — —"}
                </div>
                {wizardStep >= 3 && previewConf != null ? (
                  <>
                    <div className="order-hs-conf">
                      <span>Уверенность AI {previewConf}%</span>
                    </div>
                    <div className="conf">
                      <i style={{ width: `${previewConf}%` }} />
                    </div>
                  </>
                ) : null}
                <p>
                  {wizardStep >= 3 && previewHasHs && selected
                    ? aiEnriching
                      ? "Предварительный черновик. Точный код обновится через 1–2 минуты."
                      : classificationWhyBody(selected).slice(0, 160) +
                        (classificationWhyBody(selected).length > 160 ? "…" : "")
                    : wizardStep === 2
                      ? picked.summary
                      : isPack
                        ? "Приложите файл — после оплаты AI проставит код каждой строке"
                        : "Сначала товар и тариф, затем оплата — код откроется после неё."}
                </p>
              </div>
            </div>
          )}
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
            {!isPack && directoryHintTaken ? (
              <div className="pay-row">
                <span>Черновик ТН ВЭД</span>
                <strong>из справочника</strong>
              </div>
            ) : null}
            <div className="pay-row">
              <span>Тариф</span>
              <strong>
                {picked.name} · {fmtRub(payAmount)} ₽
              </strong>
            </div>
            <p className="meta" style={{ marginTop: 10 }}>
              Этот просчёт — только код ТН ВЭД. Таможню считаем отдельно.
            </p>
            <p className="meta" style={{ marginTop: 10 }}>
              {picked.summary}
            </p>
          </div>
          {wizardStep === 1 && !isPack ? (
            <NewCalcDirectoryHints
              query={goodsText}
              enabled
              appliedHsHint={items[0]?.attrs?.hsHint}
              onApply={({ code, titleRu }) => {
                const next = [...items];
                if (!next[0]) next[0] = { name: "", qty: 1, unitPrice: 0 };
                const name =
                  next[0].name.trim() || titleRu.trim().slice(0, 120) || next[0].name;
                next[0] = {
                  ...next[0],
                  name,
                  attrs: {
                    ...next[0].attrs,
                    hsHint: directoryHintHsHint(code),
                  },
                };
                onItems(next);
                setDirectoryHintTaken(true);
              }}
            />
          ) : null}
        </aside>
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
            {packDocName ? (
              <div className="doc-list" style={{ marginTop: 12 }}>
                <div className="doc-chip">
                  {packThumbUrl ? (
                    <a href={packThumbUrl} target="_blank" rel="noreferrer" className="doc-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={packThumbUrl} alt="" />
                    </a>
                  ) : null}
                  <div className="doc-info">
                    <b>{packDocName}</b>
                    <span className="meta">{packN >= MIN_PACK ? `${packN} позиций` : "прикреплён"}</span>
                  </div>
                </div>
              </div>
            ) : null}
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
                {packReadFailCopy}
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
