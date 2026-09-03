"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DocUploader } from "@/lbm-bro/components/doc-uploader";
import { HsLinesTable } from "@/lbm-bro/components/hs-lines";
import { Icon } from "@/lbm-bro/components/icon";
import { PaymentsForm } from "@/lbm-bro/components/payments-form";
import { PayMath } from "@/lbm-bro/components/pay-math";
import { UpgradeTile } from "@/lbm-bro/components/upgrade-tile";
import { ClarifyField } from "@/lbm-bro/components/clarify-field";
import { VoiceTextarea } from "@/lbm-bro/components/voice-textarea";
import {
  MIN_PACK, buildPackLines, clampPack, classifyName, packInvoiceSum, packStats, recognizeRows,
} from "@/lbm-bro/lib/batch-hs";
import { classifyProduct, type TnvedData } from "@/lbm-bro/lib/tnved-lookup";
import { type HsLine } from "@/lbm-bro/lib/types";
import { fmt } from "@/lbm-bro/lib/format";
import { downloadDemoPdf, shareDemoPdf, type PdfOrder } from "@/lbm-bro/lib/order-pdf";
import { CUSTOMS_CALC_MSGS, paymentsSummary, resolvePayments } from "@/lbm-bro/lib/payments";
import { clarifySummary, productTitle, buildClassificationQuery, mergeClarifyAnswers } from "@/lbm-bro/lib/product-copy";
import {
  CODE_PACKS, codePackForCount, codePackInfo, codePackPrice,
  tariffHasCustoms, upgradeCost,
  type CodePackId,
} from "@/lbm-bro/lib/tariffs";
import type { TariffName } from "@/lbm-bro/lib/types";
import { useDemo } from "@/lbm-bro/lib/store";
import { getClarificationQuestions, type ClarificationQuestion } from "@/lbm-bro/lib/clarify-ai";
import { revokeDoc } from "@/lbm-bro/lib/docs";

const AI_MSGS = [
  "Читаем документы OCR…",
  "Сверяем описание со справочником ТН ВЭД…",
  "Подбираем код…",
];

function guess(text: string, data: TnvedData | null) {
  if (!data) return { hs: "— — —", title: "Загружаем справочник ТН ВЭД…", conf: 0 };
  const c = classifyProduct(data, text);
  if (c.hs === "—") return { hs: "— — —", title: "Код появится после описания", conf: 0 };
  return { hs: c.hs, title: c.why.split(".")[0], conf: c.conf };
}

function codedWhyFallback(preview: { title: string; conf: number }) {
  if (preview.title !== "Код появится после описания") {
    return `${preview.title}. Код открыт после оплаты.`;
  }
  return "Не хватило описания для однозначного кода. Уточните состав, материал и назначение.";
}

function FreeCalcBanner() {
  return (
    <div className="free-calc-banner">
      <span className="free-calc-stamp">1 бесплатно</span>
      <div>
        <strong>Первый просчёт — 0 ₽</strong>
        <p>Один расчёт одной позиции бесплатный. Все следующие заявки уже по тарифам «Код», «Таможня» или «Под ключ».</p>
      </div>
    </div>
  );
}

export function ClientWizard() {
  const router = useRouter();
  const { wizard, setWizard, finishWizard, showToast, balance, orders, applyAiResult, applyPayments, upgradeTariff, freeHsUsed, tnvedData, tnvedReady, initWizardSession, beginNewCalculation } = useDemo();
  const [step, setStep] = useState(1);
  const [aiStatus, setAiStatus] = useState(AI_MSGS[0]);
  const [aiReady, setAiReady] = useState(false);
  const [paidId, setPaidId] = useState("");
  const [packModal, setPackModal] = useState(false);
  const [addon, setAddon] = useState<"none" | "customs" | "turnkey">("none");
  const [addonIntent, setAddonIntent] = useState<"none" | "customs" | "turnkey">("none");
  const [customsCalculating, setCustomsCalculating] = useState(false);
  const [customsCalcStatus, setCustomsCalcStatus] = useState("");
  const [reportUnlocked, setReportUnlocked] = useState(false);
  const clarifyPanelRef = useRef<HTMLDivElement>(null);
  const [clarifyQs, setClarifyQs] = useState<ClarificationQuestion[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>({});
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [clarifyAppliedIds, setClarifyAppliedIds] = useState<string[]>([]);

  useEffect(() => {
    initWizardSession();
  }, [initWizardSession]);

  useEffect(() => {
    if (!packModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPackModal(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [packModal]);

  useEffect(() => {
    if (step >= 4 || addon !== "none") return;
    if (wizard.tariff !== "Код") setWizard({ tariff: "Код" });
  }, [wizard.tariff, setWizard, step, addon]);

  const paidOrderEarly = paidId ? orders.find((x) => x.id === paidId) : undefined;
  const customsReportReady = Boolean(paidOrderEarly?.duty && paidOrderEarly.duty !== "—") || reportUnlocked;
  const classQuery = buildClassificationQuery(mergeClarifyAnswers(wizard.desc, clarifyAnswers), wizard.docs);
  const preview = guess(classQuery, tnvedData);
  const isPack = (wizard.packMode || (wizard.packSize ? "multi" : "single")) === "multi";
  const firstFree = !isPack && !freeHsUsed;
  const codedPack = packStats(wizard.lines);
  const recognized = recognizeRows(wizard.docs);
  const hs = isPack
    ? (codedPack.hs !== "—" ? codedPack.hs : "—")
    : preview.hs.includes("—") ? "—" : preview.hs;
  const packConf = codedPack.conf || 0;
  const showConf = isPack ? packConf : (preview.conf || 0);

  function applyDocs(docs: typeof wizard.docs) {
    if (!isPack) {
      setWizard({ docs });
      return;
    }
    const rec = recognizeRows(docs);
    if (rec.rows.length >= MIN_PACK) {
      setWizard({ docs, packSize: rec.rows.length, lines: buildPackLines(rec.rows.length, wizard.currency, rec.rows) });
      return;
    }
    setWizard({
      docs,
      lines: wizard.packSize ? buildPackLines(wizard.packSize, wizard.currency) : [],
    });
  }

  function fitPack(n: number, chosen?: CodePackId): CodePackId {
    const want = chosen && chosen !== "one" ? chosen : codePackForCount(Math.max(n, 2));
    if (n > codePackInfo(want).max) return codePackForCount(n);
    return want;
  }

  function pickPack(id: CodePackId) {
    if (id === "one") {
      setPackModal(false);
      setWizard({ packMode: "single", packSize: 0, lines: [], codePack: "one", tariff: "Код" });
      return;
    }
    const rec = recognizeRows(wizard.docs);
    if (rec.rows.length >= MIN_PACK) {
      const codePack = fitPack(rec.rows.length, id);
      const cap = codePackInfo(codePack).max;
      const size = Math.min(rec.rows.length, cap);
      setWizard({
        packMode: "multi",
        codePack,
        tariff: "Код",
        packSize: size,
        lines: buildPackLines(size, wizard.currency, rec.rows),
      });
      setPackModal(false);
      return;
    }
    setWizard({ packMode: "multi", codePack: id, tariff: "Код" });
    setPackModal(true);
  }

  function setMode(mode: "single" | "multi") {
    pickPack(mode === "single" ? "one" : (wizard.codePack === "m100" ? "m100" : "m20"));
  }

  function applyPackDocs(docs: typeof wizard.docs) {
    const rec = recognizeRows(docs);
    if (rec.rows.length >= MIN_PACK) {
      const codePack = fitPack(rec.rows.length, wizard.codePack);
      const cap = codePackInfo(codePack).max;
      const size = Math.min(rec.rows.length, cap);
      setWizard({
        packMode: "multi",
        codePack,
        tariff: "Код",
        docs,
        packSize: size,
        lines: buildPackLines(size, wizard.currency, rec.rows),
      });
      return;
    }
    setWizard({ packMode: "multi", docs, lines: [], tariff: "Код" });
  }

  function resetMulti() {
    wizard.docs.forEach(revokeDoc);
    setWizard({ docs: [], packSize: 0, lines: [], desc: "" });
    setPackModal(false);
  }

  function setCount(raw: string) {
    const cap = codePackInfo(wizard.codePack).max;
    const parsed = clampPack(Number(raw));
    const n = parsed ? Math.min(parsed, cap) : 0;
    const rec = recognizeRows(wizard.docs);
    setWizard({
      packSize: n,
      lines: n ? buildPackLines(n, wizard.currency, rec.rows) : [],
    });
  }

  const clarifyEnabled = step === 1 && wizard.packMode !== "multi";
  const visibleClarifyQs = clarifyEnabled ? clarifyQs : [];

  useEffect(() => {
    if (!clarifyEnabled) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async clarify fetch kickoff
    setClarifyLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const qs = await getClarificationQuestions({ wizard, step: 1 });
        if (!alive) return;
        setClarifyQs(qs);
        setClarifyLoading(false);
        setClarifyAppliedIds([]);
        setClarifyAnswers((prev) => {
          const next: Record<string, string> = {};
          qs.forEach((q) => { next[q.id] = prev[q.id] ?? ""; });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clarifyEnabled, wizard.desc, wizard.country, wizard.docs.length, wizard.packMode]);

  const missingRequired = !isPack && visibleClarifyQs.some((q) => q.required && !clarifyAnswers[q.id]?.trim());

  function applyClarifications() {
    const parts = visibleClarifyQs
      .map((q) => {
        const ans = (clarifyAnswers[q.id] || "").trim();
        return { q, ans };
      })
      .filter(({ q, ans }) => ans && !clarifyAppliedIds.includes(q.id));

    if (!parts.length) return;

    const block = parts
      .map(({ q, ans }, i) => `${i + 1}) ${q.text}\nОтвет: ${ans}`)
      .join("\n\n");

    setWizard({ desc: `${wizard.desc.trim()}\n\nУточнения (ИИ):\n${block}` });
    setClarifyAppliedIds((ids) => [...ids, ...parts.map((p) => p.q.id)]);
  }

  function skipClarifications() {
    if (!visibleClarifyQs.length) return;
    setClarifyAppliedIds(visibleClarifyQs.map((q) => q.id));
    setClarifyQs([]);
  }

  const clarifyPanel = visibleClarifyQs.length ? (
    <div
      ref={clarifyPanelRef}
      style={{
        marginTop: 14,
        border: "1.5px solid var(--line)",
        borderRadius: 18,
        padding: 16,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, letterSpacing: "-.02em" }}>
            Уточняем для точности кода
          </div>
          <div className="meta" style={{ marginTop: 4 }}>
            {clarifyLoading ? "ИИ формирует вопросы…" : "Ответьте, если хотите точнее подобрать ТН ВЭД"}
          </div>
        </div>
        {missingRequired ? <span style={{ color: "var(--danger)", fontSize: 12.5, fontWeight: 800 }}>Есть обязательные</span> : null}
      </div>

      {visibleClarifyQs.map((q) => (
        <div key={q.id} className="field">
          <label>
            {q.required ? <span style={{ color: "var(--danger)", marginRight: 6 }}>*</span> : null}
            {q.text}
          </label>
          <ClarifyField
            key={q.id}
            question={q}
            value={clarifyAnswers[q.id] || ""}
            onChange={(v) => setClarifyAnswers((a) => ({ ...a, [q.id]: v }))}
          />
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={applyClarifications} disabled={clarifyLoading}>
          <Icon name="check" /> Применить
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={skipClarifications} disabled={clarifyLoading}>
          Пока пропустить
        </button>
      </div>
    </div>
  ) : null;

  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;
    const customs = tariffHasCustoms(wizard.tariff);

    if (!tnvedReady) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- step 4 status while classifier loads
      setAiStatus("Загружаем справочник ТН ВЭД…");
      return;
    }
    if (!tnvedData) {
      setAiStatus("Справочник ТН ВЭД недоступен");
      setAiReady(true);
      return;
    }

    if (wizard.lines.length >= 2) {
      const rows = wizard.lines.map((l) => ({ ...l, hs: "—", conf: 0, why: "", status: "wait" as const }));
      setWizard({ lines: rows });
      setAiStatus(`Разбираем ${rows.length} позиций инвойса…`);

      (async () => {
        const next: HsLine[] = [...rows];
        for (let i = 0; i < next.length; i += 1) {
          if (cancelled) return;
          setAiStatus(`Позиция ${i + 1} из ${next.length}: ${next[i].name}`);
          next[i] = { ...next[i], status: "run" };
          setWizard({ lines: [...next] });
          await new Promise((r) => window.setTimeout(r, 260));
          if (cancelled) return;
          const c = classifyName(next[i].name, tnvedData);
          next[i] = { ...next[i], ...c, status: "ok" };
          setWizard({ lines: [...next] });
        }
        if (cancelled || !paidId) return;
        const stats = packStats(next);
        applyAiResult(paidId, {
          title: `Пакет ${next.length} позиций`,
          lines: next,
          packSize: wizard.packSize,
          hs: stats.hs,
          conf: stats.conf,
          why: customs
            ? `${stats.why} Дальше — таможенный расчёт.`
            : `${stats.why} Таможенный расчёт в тариф «Код» не входит.`,
          risk: stats.risk,
          pill: "Коды готовы",
          pillClass: customs ? "blue" : "ok",
          status: customs ? "ai" : "done",
          broker: "—",
          duty: "—",
          vat: "—",
        });
        setAiReady(true);
      })();

      return () => { cancelled = true; };
    }

    setAiStatus(AI_MSGS[0]);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      if (AI_MSGS[i]) setAiStatus(AI_MSGS[i]);
      if (i >= 2) {
        window.clearInterval(t);
        const coded = classifyName(mergeClarifyAnswers(wizard.desc, clarifyAnswers), tnvedData, wizard.docs);
        const why = coded.hs !== "—"
          ? `${coded.why} Код открыт после оплаты.`
          : coded.why;
        if (paidId) {
          applyAiResult(paidId, {
            hs: coded.hs,
            conf: coded.conf,
            why: customs
              ? `${why} Дальше — таможенный расчёт по этому коду.`
              : `${why} Таможенный расчёт в тариф «Код» не входит.`,
            risk: coded.risk,
            pill: coded.hs !== "—" ? "Код готов" : "Нужно уточнение",
            pillClass: coded.hs === "—" ? "warn" : customs ? "blue" : "ok",
            status: customs ? "ai" : "done",
            broker: "—",
            duty: "—",
            vat: "—",
          });
        }
        setAiReady(true);
      }
    }, 750);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, paidId, tnvedReady, tnvedData, wizard.desc, wizard.docs, clarifyAnswers]);

  const packN = isPack ? Math.max(wizard.lines.length || wizard.packSize || 0, 0) : 1;
  const pickedPack = codePackInfo(wizard.codePack || (isPack ? codePackForCount(packN || 2) : "one"));
  const payAmount = codePackPrice(pickedPack.id, firstFree);
  const canPay = firstFree || balance >= payAmount;
  const addCustoms = upgradeCost("Код", "Таможня");
  const addTurnkey = upgradeCost("Код", "Под ключ");

  function go(id: string) {
    beginNewCalculation();
    router.push(`/client/orders/${id}`);
  }

  function payAndOpenCode() {
    const id = finishWizard("paid");
    if (!id) {
      router.push("/client/balance");
      return;
    }
    setPaidId(id);
    setAiStatus(AI_MSGS[0]);
    setAiReady(false);
    setStep(4);
  }

  function requestAddon(kind: "customs" | "turnkey") {
    if (!paidId) return;
    setAddonIntent(kind);
    setReportUnlocked(false);
    setStep(5);
  }

  function payAndGetReport() {
    if (!paidId || addonIntent === "none" || customsCalculating) return;
    if (!wizard.price?.trim()) {
      showToast("Укажите таможенную стоимость партии");
      return;
    }
    const next: TariffName = addonIntent === "customs" ? "Таможня" : "Под ключ";
    const amount = addonIntent === "customs" ? addCustoms : addTurnkey;
    if (amount > 0 && balance < amount) {
      router.push("/client/balance");
      return;
    }
    if (!upgradeTariff(paidId, next)) {
      router.push("/client/balance");
      return;
    }
    setWizard({ tariff: next });
    setAddon(addonIntent);
    setCustomsCalculating(true);
    setCustomsCalcStatus(CUSTOMS_CALC_MSGS[0]);
    let msgIdx = 0;
    const tick = window.setInterval(() => {
      msgIdx += 1;
      if (CUSTOMS_CALC_MSGS[msgIdx]) setCustomsCalcStatus(CUSTOMS_CALC_MSGS[msgIdx]);
    }, 850);
    window.setTimeout(() => {
      window.clearInterval(tick);
      persistPayments();
      setAddonIntent("none");
      setCustomsCalculating(false);
      setReportUnlocked(true);
    }, 2600);
  }

  function pdfSnap(extra: Partial<PdfOrder> = {}): PdfOrder {
    const customs = tariffHasCustoms(wizard.tariff);
    const stats = isPack ? packStats(wizard.lines) : null;
    const hasCode = !hs.includes("—") && hs !== "—";
    const why = stats
      ? stats.why
      : hasCode && preview.title !== "Код появится после описания"
        ? `${preview.title}. Код открыт после оплаты.`
        : codedWhyFallback(preview);
    return {
      id: paidId,
      title: isPack ? `Пакет ${wizard.packSize} позиций` : productTitle(wizard.desc),
      desc: wizard.desc,
      hs,
      conf: stats?.conf || preview.conf || 88,
      why: customs
        ? `${why} Дальше — таможенный расчёт по этому коду.`
        : `${why} Таможенный расчёт в тариф «Код» не входит.`,
      risk: stats?.risk || "Низкий",
      route: `${wizard.country} → ${wizard.city}`,
      country: wizard.country,
      city: wizard.city,
      tariff: wizard.tariff,
      incoterm: wizard.incoterm,
      price: wizard.price,
      currency: wizard.currency,
      qty: wizard.qty,
      weightKg: wizard.weightKg,
      places: wizard.places,
      docs: wizard.docs,
      lines: wizard.lines,
      ...extra,
    };
  }

  const packCodedLines = isPack ? wizard.lines.filter((l) => l.hs && l.hs !== "—") : [];

  function persistPayments(opts?: { send?: boolean }) {
    if (!paidId) return;
    const invoice = isPack
      ? String(Math.round(packInvoiceSum(wizard.lines)) || wizard.price)
      : wizard.price;
    const p = resolvePayments({
      price: invoice,
      currency: wizard.currency,
      hs,
      lines: packCodedLines.length >= 2 ? packCodedLines : undefined,
    });
    const s = paymentsSummary(p);
    applyPayments(paidId, {
      city: wizard.city,
      price: invoice,
      currency: wizard.currency,
      qty: isPack ? String(wizard.packSize || wizard.lines.length) : wizard.qty,
      weightKg: wizard.weightKg,
      places: wizard.places,
      incoterm: wizard.incoterm,
      country: wizard.country,
      route: `${wizard.country} → ${wizard.city}`,
      duty: s.duty,
      vat: s.vat,
      fee: s.fee,
      sum: s.sum,
    }, opts);
    return pdfSnap(s);
  }

  const paidOrder = paidId ? orders.find((o) => o.id === paidId) : undefined;
  const customsUpgradePaid = Boolean(paidOrder && tariffHasCustoms(paidOrder.tariff));

  const addonPayAmount = addonIntent === "customs" ? addCustoms : addonIntent === "turnkey" ? addTurnkey : 0;
  const canPayAddon = addonPayAmount <= 0 || balance >= addonPayAmount;
  const customsFlowActive = addonIntent !== "none" || customsUpgradePaid;

  const flow = [
    { n: 1, lab: "Товар" },
    { n: 3, lab: firstFree ? "Бесплатно" : "Оплата" },
    { n: 4, lab: "Код" },
    ...(customsFlowActive ? [{ n: 5, lab: "Платежи" }] : []),
  ];
  const hasCustoms = customsUpgradePaid;
  const hasBroker = addon === "turnkey" && customsUpgradePaid;
  const customsFormLocked = customsCalculating || !customsReportReady;
  const titles = ["", "Что ввозите?", "Тариф", firstFree ? "Бесплатный просчёт" : "Оплата просчёта кода", "Код ТН ВЭД", "Стоимость и налоги", "Оплата доп. тарифа"];

  return (
    <div className="wiz-full">
      <div className="wiz-head">
        <div>
          <Link href="/client" className="btn btn-ghost btn-sm">← На главную</Link>
          <span className="go-kicker" style={{ display: "block", marginTop: 14 }}>
            {firstFree ? "Первый код бесплатный · этот просчёт только ТН ВЭД" : "Просчёт кода ТН ВЭД ЕАЭС"}
          </span>
          <h2>{titles[step]}</h2>
        </div>
      </div>

      <div className="wiz-steps labeled" style={{ gridTemplateColumns: `repeat(${flow.length}, minmax(0, 1fr))` }}>
        {flow.map((item, i) => (
          <button
            key={item.lab}
            type="button"
            className={item.n < step ? "done" : item.n === step ? "on" : ""}
            onClick={() => {
              if (paidId) {
                if (!aiReady || item.n < 4) return;
                if (item.n === 5 && !customsFlowActive) return;
                setStep(item.n);
                return;
              }
              if (item.n < step) setStep(item.n);
            }}
          >
            <b>{i + 1}</b>{item.lab}
          </button>
        ))}
      </div>

      {step === 4 && !aiReady ? (
        <div className="ai-run card" style={{ margin: 0 }}>
          <div className="ring" />
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.6rem" }}>
            {isPack ? "Оплата прошла — AI считает коды по позициям" : firstFree ? "Первый просчёт бесплатный — AI подбирает код" : "Оплата прошла — AI подбирает код"}
          </h3>
          <p style={{ color: "var(--muted)", marginTop: 8 }}>{aiStatus}</p>
          {isPack ? <HsLinesTable lines={wizard.lines} compact /> : null}
        </div>
      ) : (
        <div className="wiz-grid">
          <div className="wiz-main card" style={{ margin: 0 }}>
            {step === 1 ? (
              <>
                <p className="wiz-lead">
                  {isPack
                    ? "Прикрепите инвойс, таблицу или фото — читаем реальные позиции и считаем стоимость."
                    : "Одна позиция: описание товара и документы для кода ТН ВЭД."}
                </p>
                {firstFree ? <FreeCalcBanner /> : !isPack ? (
                  <div className="alert-box warn-box">
                    <strong>Бесплатный просчёт уже использован</strong>
                    Этот и следующие расчёты открываются по тарифам.
                  </div>
                ) : null}
                <div className="field">
                  <label>Режим</label>
                  <div className="amt-chips">
                    <button type="button" className={!isPack ? "on" : ""} onClick={() => setMode("single")}>
                      Одна позиция{firstFree ? " · 1 бесплатно" : ""}
                    </button>
                    <button type="button" className={isPack ? "on" : ""} onClick={() => setMode("multi")}>
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
                        Пакет «{pickedPack.name}»: {fmt(payAmount)} ₽
                        <small> · до {pickedPack.max} строк</small>
                      </span>
                    </div>
                  ) : isPack ? (
                    wizard.docs.length
                      ? <span className="meta pack-read-fail">Не удалось вычитать позиции: скан размытый или плохо читается. Пришлите более чёткое фото таблицы либо файл CSV/Excel.</span>
                      : <span className="meta">Прикрепите invoice, CSV или фото — читаем реальные строки и считаем стоимость.</span>
                  ) : null}
                </div>
                {isPack && packN >= MIN_PACK ? (
                  <div className="field">
                    <label>Сколько позиций нашли</label>
                    <input
                      type="number"
                      min={MIN_PACK}
                      max={pickedPack.max}
                      value={wizard.packSize || packN}
                      onChange={(e) => setCount(e.target.value)}
                    />
                    <span className="meta">
                      {recognized.source === "file"
                        ? "Строки взяты из файла: наименование, количество и цена. Можно поправить."
                        : recognized.source === "ocr"
                          ? "Строки считаны с фото/скана. Проверьте названия и цифры."
                          : "Число можно поправить вручную."}
                    </span>
                  </div>
                ) : null}
                <div className="field">
                  <label>{isPack ? "Комментарий к партии (необязательно)" : "Наименование и описание"}</label>
                  <VoiceTextarea
                    rows={isPack ? 3 : 5}
                    placeholder={isPack ? "Например: поставка электроники, инвойс на 15 SKU" : "Ноутбуки Lenovo ThinkPad, 14'', для офиса — или надиктуйте"}
                    value={wizard.desc}
                    onChange={(desc) => setWizard({ desc })}
                    onToast={showToast}
                  />
                </div>
                <div className="field">
                  <label>Страна происхождения</label>
                  <select value={wizard.country} onChange={(e) => setWizard({ country: e.target.value })}>
                    <option>Китай</option>
                    <option>Турция</option>
                    <option>ЕС</option>
                    <option>Корея</option>
                    <option>Вьетнам</option>
                    <option>Индия</option>
                  </select>
                </div>
                {isPack ? null : clarifyPanel}
                {isPack ? null : (
                  <div className="field">
                    <label>Документы и фото</label>
                    <DocUploader
                      docs={wizard.docs}
                      onChange={applyDocs}
                      onToast={showToast}
                    />
                  </div>
                )}
                {isPack && wizard.lines.length ? (
                  <div className="field">
                    <label>Позиции и характеристики</label>
                    <HsLinesTable
                      lines={wizard.lines}
                      editable
                      onChange={(lines) => setWizard({ lines, packSize: lines.length })}
                    />
                  </div>
                ) : null}

                <div className="field" style={{ marginTop: 22 }}>
                  <label>Тариф просчёта кода ТН ВЭД</label>
                  <p className="meta" style={{ margin: "0 0 10px" }}>
                    Сначала считаем только код. Таможню — пошлину и НДС — после кода, отдельным шагом.
                  </p>
                  <div className="tariff-pick">
                    {CODE_PACKS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`${pickedPack.id === t.id ? "on" : ""}${t.featured ? " featured" : ""}`}
                        onClick={() => pickPack(t.id)}
                      >
                        <span className="tariff-tag">{t.tag}</span>
                        <strong>{t.name}</strong>
                        <div className="tariff-price">
                          {t.id === "one" && firstFree ? "0 ₽" : `${fmt(t.price)} ₽`}
                          <small>{t.id === "one" ? (firstFree ? "1-й бесплатно · далее 990 ₽" : "/ 1 позиция") : `/ до ${t.max} поз.`}</small>
                        </div>
                        <p>{t.summary}</p>
                        <ul>
                          {t.includes.map((line) => <li key={line}>{line}</li>)}
                        </ul>
                      </button>
                    ))}
                  </div>
                  <div className="tariff-note">
                    {firstFree && pickedPack.id === "one"
                      ? <><strong>Сейчас 0 ₽.</strong> Первый просчёт «Старт» бесплатный. Дальше 990 ₽ за 1, «Стандарт» 3 990 ₽ или «Профи» 6 990 ₽.</>
                      : <><strong>{pickedPack.name}:</strong> {fmt(payAmount)} ₽ за просчёт кодов, без таможни.</>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      if (isPack && wizard.lines.length < MIN_PACK) return;
                      if (missingRequired) {
                        clarifyPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        return;
                      }
                      if (!wizard.desc.trim()) {
                        setWizard({ desc: isPack ? `Пакет ${wizard.lines.length || wizard.packSize} позиций` : "Новый товар" });
                      }
                      setStep(3);
                    }}
                    disabled={isPack && wizard.lines.length < MIN_PACK}
                  >
                    Далее
                  </button>
                  {isPack ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={resetMulti}
                      disabled={!wizard.docs.length && !wizard.lines.length && !wizard.desc.trim()}
                    >
                      Очистить
                    </button>
                  ) : null}
                </div>
                {isPack && wizard.lines.length < MIN_PACK ? (
                  <p className="meta" style={{ marginTop: 8 }}>Прикрепите файл — минимум {MIN_PACK} позиции, в этом пакете до {pickedPack.max}.</p>
                ) : null}
              </>
            ) : null}

            {step === 3 ? (
              <>
                {firstFree ? <FreeCalcBanner /> : null}
                <p className="wiz-lead">
                  {firstFree
                    ? "Этот просчёт списывать не будем. Следующая заявка — уже по тарифу кода."
                    : `Оплачивается пакет «${pickedPack.name}»: только коды ТН ВЭД. Пошлина и НДС в этот просчёт не входят.`}
                </p>
                <div className="wiz-pay-box">
                  <div className="pay-row"><span>Товар</span><strong>{isPack ? `Пакет ${wizard.packSize || wizard.lines.length} позиций` : productTitle(wizard.desc)}</strong></div>
                  {clarifySummary(wizard.desc) ? (
                    <p className="meta" style={{ margin: "0 0 8px", textAlign: "right" }}>Уточнения: {clarifySummary(wizard.desc)}</p>
                  ) : null}
                  <div className="pay-row"><span>Происхождение</span><strong>{wizard.country}</strong></div>
                  <div className="pay-row"><span>Документы</span><strong>{wizard.docs.length || "нет"}</strong></div>
                  {isPack ? <div className="pay-row"><span>Позиций</span><strong>{wizard.lines.length || wizard.packSize}</strong></div> : null}
                  <div className="pay-row"><span>Тариф</span><strong>{pickedPack.name} · {pickedPack.max === 1 ? "1 позиция" : `до ${pickedPack.max} поз.`}</strong></div>
                  {firstFree ? <div className="pay-row"><span>К оплате</span><strong>0 ₽</strong></div> : null}
                  <p className="meta" style={{ margin: "10px 0 0" }}>
                    {firstFree
                      ? "Первый просчёт «Старт» бесплатный. Дальше 990 ₽ за 1 позицию."
                      : `${pickedPack.name}: ${fmt(payAmount)} ₽. Таможня в пакет не входит.`}
                  </p>
                  {firstFree ? null : <PayMath balance={balance} amount={payAmount} />}
                  {!canPay ? (
                    <div className="alert-box warn-box" style={{ marginTop: 12 }}>
                      <strong>Недостаточно средств</strong>Пополните баланс, затем вернитесь к оплате.
                    </div>
                  ) : (
                    <div className="alert-box ok-box" style={{ marginTop: 12 }}>
                      <strong>{firstFree ? "Один просчёт бесплатно" : "Что будет после оплаты"}</strong>
                      {firstFree
                        ? "Сейчас код откроется без списания. Дальше «Старт» 990 ₽, «Стандарт» 3 990 ₽ или «Профи» 6 990 ₽."
                        : "После оплаты AI откроет только коды ТН ВЭД. Пошлину и НДС можно посчитать позже."}
                      {isPack ? " Один тариф — на все позиции файла." : ""}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Назад</button>
                  {canPay ? (
                    <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={payAndOpenCode}>
                      {firstFree
                        ? "Получить первый просчёт бесплатно"
                        : `Оплатить ${fmt(payAmount)} ₽ и получить ${isPack ? "коды" : "код"}`}
                    </button>
                  ) : (
                    <Link href="/client/balance" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>Пополнить баланс</Link>
                  )}
                </div>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <p className="wiz-lead">
                  {isPack
                    ? `Коды по ${wizard.lines.length} позициям готовы. Дальше можно посчитать таможню или взять брокера.`
                    : "Код готов. Дальше — таможенный расчёт или брокер под ключ."}
                </p>
                {isPack ? (
                  <>
                    <div className="metric-row">
                      <div className="metric"><div className="k">Позиций</div><div className="v">{wizard.lines.length}</div></div>
                      <div className="metric"><div className="k">Средняя уверенность</div><div className="v">{showConf}%</div></div>
                    </div>
                    <div className="conf"><i style={{ width: `${showConf}%` }} /></div>
                    <HsLinesTable lines={wizard.lines} />
                    <div className="alert-box ok-box" style={{ marginTop: 14 }}>
                      <strong>Пакет обработан</strong>
                      {codedPack.why}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="metric-row">
                      <div className="metric"><div className="k">ТН ВЭД</div><div className="v" style={{ fontSize: "1.15rem" }}>{hs}</div></div>
                      <div className="metric"><div className="k">Уверенность</div><div className="v">{showConf}%</div></div>
                    </div>
                    <div className="conf"><i style={{ width: `${showConf}%` }} /></div>
                    <div className={`alert-box ${hs.includes("—") ? "warn-box" : "ok-box"}`} style={{ marginTop: 14 }}>
                      <strong>{hs.includes("—") ? "Нужно уточнение" : "Почему этот код"}</strong>
                      {hs.includes("—")
                        ? codedWhyFallback(preview)
                        : preview.title !== "Код появится после описания"
                          ? `${preview.title} — по описанию и документам после оплаты.`
                          : "Код подобран по описанию."}
                    </div>
                  </>
                )}
                {wizard.docs.length ? (
                  <div className="doc-list" style={{ marginTop: 14 }}>
                    {wizard.docs.map((d) => (
                      <div key={d.id} className="doc-chip">
                        {d.preview ? <span className="doc-thumb"><img src={d.preview} alt="" /></span> : null}
                        <div className="doc-info"><b>{d.name}</b></div>
                        <span className="pill ok">{d.kind === "photo" ? "Фото" : d.kind === "pdf" ? "PDF" : "Файл"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="meta" style={{ marginTop: 12 }}>Документы не приложены.</p>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      if (paidId) downloadDemoPdf(pdfSnap(), showToast);
                    }}
                  >
                    Скачать PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      if (paidId) void shareDemoPdf(pdfSnap(), showToast);
                    }}
                  >
                    Поделиться
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => go(paidId)}>
                    К заявке
                  </button>
                  <Link href={`/client/tnved?hs=${encodeURIComponent(hs)}`} className="btn btn-ghost">
                    Справочник ТН ВЭД
                  </Link>
                </div>
                <div className="field" style={{ marginTop: 22 }}>
                  <label>Что дальше</label>
                  <p className="meta" style={{ margin: "0 0 10px" }}>
                    Код уже ваш. Можно остановиться или доплатить следующий шаг по этой же заявке.
                  </p>
                  <div className="upgrade-tiles">
                    <UpgradeTile
                      icon="chart"
                      tag="Рекомендуем"
                      title="Таможенный расчёт"
                      desc={isPack
                        ? `Пошлина и НДС по ${wizard.lines.length} кодам партии. Считаем по инвойсу — без новой заявки.`
                        : `Пошлина и НДС по коду ${hs}. Считаем по инвойсу — без новой заявки.`}
                      items={["Таможенная стоимость и курс", "Пошлина и НДС 20%", "PDF с кодом и платежами"]}
                      price={`${fmt(addCustoms)} ₽`}
                      note="доплата к просчёту кода"
                      featured
                      primary
                      payAmount={addCustoms}
                      balance={balance}
                      cta="Рассчитать таможню и налоги"
                      onClick={() => requestAddon("customs")}
                    />
                    <UpgradeTile
                      icon="users"
                      tag="Брокер включён"
                      title="Брокер под ключ"
                      desc="Расчёт платежей и живой эксперт: проверит код, риски и доведёт заявку до PDF."
                      items={["Всё из таможенного расчёта", "Проверка брокером и правки", "Чат с экспертом до выпуска"]}
                      price={`${fmt(addTurnkey)} ₽`}
                      note="доплата сразу до пакета «Под ключ»"
                      payAmount={addTurnkey}
                      balance={balance}
                      cta="Заполнить форму · брокер"
                      onClick={() => requestAddon("turnkey")}
                    />
                  </div>
                </div>
              </>
            ) : null}

            {step === 5 && customsFlowActive ? (
              <>
                <p className="wiz-lead">
                  {customsCalculating
                    ? "Оплата прошла — формируем таможенный расчёт по вашей партии."
                    : customsFormLocked
                    ? (isPack
                      ? `По ${packCodedLines.length || wizard.lines.length} кодам заполните партию — после оплаты ${fmt(addCustoms)} ₽ сформируем отчёт с пошлиной и НДС по каждой позиции.`
                      : addonIntent === "customs"
                        ? `По коду ${hs} заполните партию — после оплаты ${fmt(addCustoms)} ₽ сформируем отчёт с пошлиной и НДС.`
                        : `Заполните партию — после оплаты ${fmt(addTurnkey)} ₽ откроется расчёт и брокер в одной заявке.`)
                    : hasBroker
                      ? `Отчёт готов. Брокер в тарифе — можно передать ему заявку.`
                      : isPack
                        ? `Отчёт по ${packCodedLines.length || wizard.lines.length} кодам: таможенная стоимость, пошлина и НДС по партии.`
                        : `Отчёт по коду ${hs}: таможенная стоимость, пошлина и НДС.`}
                  {isPack && !customsFormLocked && packCodedLines.length >= 2
                    ? " Пошлина считается отдельно по каждому коду позиции."
                    : ""}
                </p>
                {customsCalculating ? (
                  <div className="ai-run card" style={{ margin: "8px 0 0" }}>
                    <div className="ring" />
                    <h3 style={{ fontFamily: "var(--display)", fontSize: "1.35rem" }}>Считаем пошлину и НДС</h3>
                    <p style={{ color: "var(--muted)", marginTop: 8 }}>{customsCalcStatus}</p>
                    {isPack ? <HsLinesTable lines={wizard.lines} compact /> : null}
                  </div>
                ) : (
                  <>
                <PaymentsForm
                  value={{
                    city: wizard.city,
                    price: wizard.price,
                    currency: wizard.currency,
                    qty: wizard.qty,
                    weightKg: wizard.weightKg,
                    places: wizard.places,
                    incoterm: wizard.incoterm,
                  }}
                  onChange={(patch) => setWizard(patch)}
                  hs={hs}
                  tariffPaid={payAmount}
                  locked={customsFormLocked}
                  lines={packCodedLines.length >= 2 ? wizard.lines : undefined}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => { setAddonIntent("none"); setStep(4); }} disabled={customsCalculating}>К коду</button>
                  {customsFormLocked && !customsCalculating ? (
                    canPayAddon ? (
                      <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={payAndGetReport}>
                        Оплатить {fmt(addonPayAmount)} ₽ и получить отчёт
                      </button>
                    ) : (
                      <Link href="/client/balance" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>Пополнить баланс</Link>
                    )
                  ) : !customsFormLocked ? (
                    <>
                      <button
                        type="button"
                        className={hasBroker ? "btn btn-ghost" : "btn btn-primary"}
                        onClick={() => {
                          const row = persistPayments();
                          if (row) downloadDemoPdf(row, showToast);
                        }}
                      >
                        Скачать PDF
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          const row = persistPayments();
                          if (row) void shareDemoPdf(row, showToast);
                        }}
                      >
                        Поделиться
                      </button>
                      {hasBroker ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            persistPayments({ send: true });
                            go(paidId);
                          }}
                        >
                          Передать брокеру
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {customsFormLocked && !customsCalculating ? (
                  <p className="meta" style={{ marginTop: 10 }}>
                    Сначала заполните форму, затем оплатите — цифры и PDF появятся после расчёта.
                  </p>
                ) : !customsFormLocked ? (
                  <p className="meta" style={{ marginTop: 10 }}>
                    {hasBroker
                      ? "Брокер включён в «Под ключ». Кнопка передаёт ему код и расчёт."
                      : "Чтобы подключить брокера, нужен тариф «Под ключ»."}
                  </p>
                ) : null}
                  </>
                )}
              </>
            ) : null}
          </div>

          <aside className="wiz-side">
            <div className="order-hs" style={{ minHeight: 220, gridTemplateColumns: "1fr" }}>
              <div className="order-hs-copy">
                <span className="gt-kicker">
                  {firstFree && step < 4
                    ? "Первый просчёт · 0 ₽"
                    : step < 4
                      ? (isPack ? `Пакет ${wizard.packSize} позиций · после оплаты` : "Код после оплаты")
                      : isPack ? "Коды ТН ВЭД ЕАЭС" : "Код ТН ВЭД ЕАЭС"}
                </span>
                <div className="order-hs-code">{step >= 4 && aiReady ? (isPack ? `${wizard.lines.length} кодов` : hs) : "— — —"}</div>
                <p>
                  {firstFree && step < 4
                    ? "Один расчёт бесплатный. Следующие заявки — по тарифам."
                    : step >= 5
                    ? isPack
                      ? "Коды есть — считаем стоимость, пошлину и НДС по партии"
                      : "Код есть — считаем стоимость, пошлину и НДС"
                    : step >= 4 && aiReady
                      ? hasCustoms
                        ? isPack
                          ? `Средняя уверенность ${showConf}% · дальше таможенный расчёт`
                          : `${preview.title} · дальше таможенный расчёт`
                        : isPack
                          ? `Средняя уверенность ${showConf}% · тариф «Код» на этом заканчивается`
                          : `${preview.title} · тариф «Код» на этом заканчивается`
                      : step === 3
                        ? pickedPack.summary
                        : isPack
                          ? "Приложите файл — после оплаты AI проставит код каждой строке"
                          : "Сначала товар и тариф кода, затем оплата"}
                </p>
                {step >= 4 && aiReady ? <div className="conf" style={{ marginTop: 14 }}><i style={{ width: `${showConf}%` }} /></div> : null}
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <h3>По заявке</h3>
              <div className="pay-row"><span>Происхождение</span><strong>{wizard.country}</strong></div>
              <div className="pay-row"><span>Документы</span><strong>{wizard.docs.length}</strong></div>
              {isPack ? <div className="pay-row"><span>Позиций</span><strong>{wizard.lines.length || wizard.packSize}</strong></div> : null}
              <div className="pay-row"><span>Тариф</span><strong>{firstFree && step < 4 ? "первый · 0 ₽" : `${pickedPack.name} · ${fmt(payAmount)} ₽`}</strong></div>
              {step >= 5 ? (
                <>
                  <div className="pay-row"><span>Куда</span><strong>{wizard.city}</strong></div>
                  <div className="pay-row"><span>Стоимость</span><strong>{wizard.price || "—"} {wizard.currency}</strong></div>
                  <div className="pay-row"><span>Партия</span><strong>{[wizard.qty && `${wizard.qty} шт`, wizard.weightKg && `${wizard.weightKg} кг`].filter(Boolean).join(" · ") || "укажите слева"}</strong></div>
                </>
              ) : (
                <p className="meta" style={{ marginTop: 10 }}>
                  Этот просчёт — только код ТН ВЭД. Таможню считаем отдельно.
                </p>
              )}
              <p className="meta" style={{ marginTop: 10 }}>{pickedPack.summary}</p>
            </div>
          </aside>
        </div>
      )}
      {packModal ? (
        <div className="pack-modal-back" onClick={() => setPackModal(false)}>
          <div className="pack-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pack-modal-title">
            <div className="pack-modal-head">
              <span className="go-kicker">Мультипозиция</span>
              <button type="button" className="pack-modal-x" aria-label="Закрыть" onClick={() => setPackModal(false)}>×</button>
            </div>
            <h3 id="pack-modal-title">Файл с позициями</h3>
            <p className="meta" style={{ margin: "0 0 14px" }}>
              CSV, Excel, PDF или фото инвойса. Читаем строки с документа и считаем стоимость просчёта.
            </p>
            <DocUploader
              docs={wizard.docs}
              onChange={applyPackDocs}
              onToast={showToast}
              title="Перетащите файл или фото сюда"
              hint="CSV, Excel, PDF, JPG · читаем реальные позиции · до 12 МБ"
            />
            {packN >= MIN_PACK ? (
              <div className="pack-quote" style={{ marginTop: 14 }}>
                <strong>В файле {packN} позиций</strong>
                <span>
                  Пакет «{pickedPack.name}»: {fmt(payAmount)} ₽
                  <small> · до {pickedPack.max} строк</small>
                </span>
              </div>
            ) : wizard.docs.length ? (
              <p className="meta pack-read-fail">Не удалось вычитать позиции: скан размытый или плохо читается. Пришлите более чёткое фото таблицы либо файл CSV/Excel.</p>
            ) : null}
            <div className="pack-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={resetMulti}>Очистить</button>
              <button type="button" className="btn btn-ghost" onClick={() => setPackModal(false)}>Позже</button>
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
    </div>
  );
}
