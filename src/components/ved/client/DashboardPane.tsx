"use client";

import { useState } from "react";
import { StageTip } from "./NewCalcHints";
import { FieldSuggest } from "./FieldSuggest";
import { useVedToast } from "../feedback/VedToast";
import Link from "next/link";
import { StatusPill, VedEmptyState } from "../VedShell";
import type { Calc, Me, ShipRow } from "./types";
import { calcThumb } from "./types";
import { resolveOriginCountryCode } from "@/lib/ved/field-suggest";
import { commercialInvoiceUiEnabled } from "@/lib/ved/cabinet-features";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import { OrderCover } from "@/lbm-bro/components/order-cover";
import {
  clientOrderHsLabel,
  clientOrderNextStep,
  formatRub,
  LIVE_FEED_FILTERS,
  liveFeedMatch,
  type LiveFeedFilter,
} from "../lbm-pane-visual";
import { shouldRevealClientDraftHs } from "@/lib/ved/ai-classification-copy";

type OrderFilter = LiveFeedFilter;

function matchesFilter(c: Calc, f: OrderFilter): boolean {
  return liveFeedMatch(c, f);
}

export function DashboardPane({
  pane,
  me,
  calcs,
  shipping,
  showShipping = false,
  busy,
  unreadCount = 0,
  factoryActiveCount = 0,
  factoryHref,
  selectedId,
  onOpen,
  onPay,
  onTopupThenPay,
  onQuickCreate,
  onUploadQuick,
  createHref = "/cabinet/new",
}: {
  pane: "dashboard" | "orders";
  me: Me | null;
  calcs: Calc[];
  shipping: ShipRow[];
  showShipping?: boolean;
  busy: boolean;
  unreadCount?: number;
  factoryActiveCount?: number;
  factoryHref?: string;
  selectedId?: string | null;
  onOpen: (c: Calc) => void;
  onPay: (c: Calc) => void;
  onTopupThenPay?: (c: Calc) => void;
  onQuickCreate: (payload: {
    title: string;
    description: string;
    country: string;
    shipmentValue: string;
    shipmentCurrency?: string;
    mediaUrl?: string;
    attrs?: {
      originCountry: string;
      manufacturerName?: string;
      composition: string;
    };
  }) => void;
  onUploadQuick?: (file: File) => Promise<string>;
  /** CTA when orders list is empty */
  createHref?: string;
}) {
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [listQ, setListQ] = useState("");
  const [qDesc, setQDesc] = useState("");
  const [qCountry, setQCountry] = useState("Китай");
  const [qOrigin, setQOrigin] = useState("CN");
  const [qManufacturer, setQManufacturer] = useState("");
  const [qComposition, setQComposition] = useState("");
  const [qValue, setQValue] = useState("");
  const [qCurrency, setQCurrency] = useState<"USD" | "CNY" | "EUR">("USD");
  const [qMedia, setQMedia] = useState<string | undefined>();
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);
  const { toast } = useVedToast();

  const active = calcs.filter((c) => !["DONE", "CANCELLED"].includes(c.status)).length;
  const atBroker = calcs.filter((c) => ["QUEUED", "IN_REVIEW", "SLA_RISK"].includes(c.status)).length;
  const inTransit = shipping.filter((s) => ["IN_TRANSIT", "QUOTED", "NEW"].includes(s.status)).length;
  const activeShip =
    shipping.find((s) => s.status === "IN_TRANSIT") ||
    shipping.find((s) => s.status === "QUOTED") ||
    shipping.find((s) => s.status === "NEW") ||
    null;

  const recent = [...calcs].slice(0, 6);
  const nq = listQ.trim().toLowerCase();
  const filtered = calcs.filter((c) => {
    if (!matchesFilter(c, filter)) return false;
    if (!nq) return true;
    return [c.number, c.title, c.country, c.hsCode, c.hsCodeFinal, c.tariff?.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(nq);
  });

  const runQuick = () => {
    const desc = qDesc.trim();
    const origin = qOrigin.trim().toUpperCase();
    const manufacturer = qManufacturer.trim();
    const composition = qComposition.trim();
    if (!desc) return;
    if (origin.length !== 2 || !composition) {
      setShowRequiredErrors(true);
      toast(
        "Заполните страну происхождения (ISO-2) и состав — без этого заявка не создаётся.",
        { variant: "error" },
      );
      return;
    }
    setShowRequiredErrors(false);
    const title = desc.length > 48 ? `${desc.slice(0, 45)}…` : desc;
    onQuickCreate({
      title,
      description: desc,
      country: qCountry.trim() || "Китай",
      shipmentValue: commercialInvoiceUiEnabled() ? qValue.trim() || "0" : "",
      shipmentCurrency: qCurrency,
      mediaUrl: qMedia,
      attrs: {
        originCountry: origin,
        manufacturerName: manufacturer || undefined,
        composition,
      },
    });
  };

  // Soft UI: only description required to enable CTA; attrs validated on click.
  const quickReady = Boolean(qDesc.trim());
  const highlightRequired = showRequiredErrors;
  const quickStageTip = !qDesc.trim()
    ? "Опишите товар — затем страну происхождения (ISO-2) и состав."
    : qOrigin.trim().length !== 2 || !qComposition.trim()
      ? "Осталось: страна (CN…) и состав — без них заявка не создастся."
      : "Можно запускать AI-расчёт. Детали и фото — в полном форме «Новый просчёт».";


  if (pane === "orders") {
    return (
      <section>
        <div className="card-head">
          <div>
            <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Заявки на просчёт</h3>
            <p>Карточки вместо таблицы — откройте любую, чтобы увидеть код, платежи и чат</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <label style={{ flex: 1, minWidth: 260 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
              Поиск по №, товару, брокеру, HS и документам
            </span>
            <input
              type="search"
              value={listQ}
              onChange={(e) => setListQ(e.target.value)}
              placeholder="Например: ноутбуки, Invoice, 8471…"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1.5px solid var(--line)",
                background: "#fff",
                outline: "none",
              }}
            />
          </label>
          {listQ ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setListQ("")}>
              Сбросить
            </button>
          ) : null}
        </div>
        <div className="filter-chips">
          {LIVE_FEED_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={filter === f.id ? "on" : ""}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <OrdersTable
          calcs={filtered}
          listTotal={calcs.length}
          filter={filter}
          onResetFilter={() => setFilter("all")}
          busy={busy}
          me={me}
          selectedId={selectedId}
          onOpen={onOpen}
          onPay={onPay}
          onTopupThenPay={onTopupThenPay}
          showTariff
          createHref={createHref}
        />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {calcs.length === 0 ? (
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--kb-muted)]">
            С чего начать
          </p>
          <ol className="mt-3 space-y-2 text-sm">
            <li className="font-medium">1. Опишите партию и запустите AI-черновик ТН ВЭД</li>
            <li className="text-[var(--kb-muted)]">2. Оплатите тариф — заявка уйдёт брокеру (если нужно)</li>
            <li className="text-[var(--kb-muted)]">3. Получите PDF после проверки</li>
          </ol>
          <Link
            href={createHref}
            className="mt-4 inline-flex rounded-full bg-[#2b72f4] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Новый просчёт
          </Link>
          {factoryHref ? (
            <p className="mt-3 text-xs text-[var(--kb-muted)]">
              Нужен сборный заказ у производителя?{" "}
              <Link href={factoryHref} className="text-[#2b72f4]">
                Раздел «Производитель»
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {unreadCount > 0 ? (
        <div className="alert-box">
          <p className="font-semibold text-[#0f172a]">Ждут вашего ответа: {unreadCount}</p>
          <p className="mt-1 text-[var(--kb-muted)]">
            Брокер или поддержка написали — откройте заявку или «Поддержку» в меню.
          </p>
        </div>
      ) : null}

      <div className="stats">
        {[
          { v: active, k: "Активные заявки" },
          { v: atBroker, k: "На проверке у брокера" },
          ...(showShipping ? [{ v: inTransit, k: "Перевозки в пути" }] : []),
          ...(factoryHref
            ? [{ v: factoryActiveCount, k: "Запросы производителю", href: factoryHref }]
            : []),
          { v: unreadCount, k: "Непрочитанных" },
        ].map((s) => (
          <div key={s.k} className="stat">
            <div className="v">{s.v}</div>
            {"href" in s && s.href ? (
              <Link href={s.href} className="k">
                {s.k}
              </Link>
            ) : (
              <div className="k">{s.k}</div>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div className="border-b border-black/[0.04] px-5 py-4">
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
              Последние просчёты
            </h2>
          </div>
          <OrdersTable
            calcs={recent}
            busy={busy}
            me={me}
            selectedId={selectedId}
            onOpen={onOpen}
            onPay={onPay}
            onTopupThenPay={onTopupThenPay}
            compact
            createHref={createHref}
          />
        </div>

        <div className="card">
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
            Быстрый просчёт
          </h2>
          <p className="mt-1 mb-3 text-[13px] text-[var(--kb-muted)]">
            Опишите товар и обязательные поля (страна / состав) — AI подготовит
            черновик кода ТН ВЭД.
          </p>
          {quickStageTip ? <div className="mb-3"><StageTip text={quickStageTip} /></div> : null}
          <div className="mb-3 block text-xs font-semibold text-slate-500">
            Наименование и описание
            <FieldSuggest
              kind="partyDescription"
              multiline
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-[var(--kb-ink)]"
              placeholder="Например: ноутбуки Lenovo ThinkPad, 14'', для офиса"
              value={qDesc}
              onChange={setQDesc}
            />
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <div className="block text-xs font-semibold text-slate-500">
              Страна происхождения *
              <FieldSuggest
                kind="originCountry"
                className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-normal text-[var(--kb-ink)] ${highlightRequired && qOrigin.trim().length !== 2 ? "border-amber-400 bg-amber-50/50" : "border-slate-200"}`}
                placeholder="CN или Китай"
                value={qOrigin}
                resolveBlur={(raw) => resolveOriginCountryCode(raw) || raw}
                onChange={setQOrigin}
              />
            </div>
            <label className="block text-xs font-semibold text-slate-500 sm:col-span-2">
              Производитель
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-[var(--kb-ink)]"
                placeholder="Lenovo PC HK Limited"
                value={qManufacturer}
                onChange={(e) => setQManufacturer(e.target.value)}
              />
            </label>
            <div className="block text-xs font-semibold text-slate-500 sm:col-span-3">
              Состав *
              <FieldSuggest
                kind="composition"
                className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-normal text-[var(--kb-ink)] ${highlightRequired && !qComposition.trim() ? "border-amber-400 bg-amber-50/50" : "border-slate-200"}`}
                placeholder="aluminium chassis, plastics, Li-ion battery…"
                value={qComposition}
                onChange={setQComposition}
              />
            </div>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <div className="block text-xs font-semibold text-slate-500">
              Страна отправления
              <FieldSuggest
                kind="shipCountry"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-[var(--kb-ink)]"
                placeholder="Китай, Турция…"
                value={qCountry}
                onChange={setQCountry}
              />
            </div>
            {commercialInvoiceUiEnabled() ? (
            <label className="block text-xs font-semibold text-slate-500">
              Стоимость партии (инвойс)
              <div className="mt-1 flex gap-2">
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-[var(--kb-ink)]"
                  value={qValue}
                  onChange={(e) => setQValue(e.target.value)}
                  inputMode="decimal"
                />
                <select
                  className="w-[7.5rem] shrink-0 rounded-xl border border-slate-200 px-2 py-2 text-sm font-normal text-[var(--kb-ink)]"
                  value={qCurrency}
                  onChange={(e) => setQCurrency(e.target.value as "USD" | "CNY" | "EUR")}
                  aria-label="Валюта инвойса"
                >
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </label>
            ) : (
              <DesignerStub
                compact
                title="Инвойс партии"
                intent="В макете quick-calc тоже просит стоимость груза."
                gap="Временно скрыто в UI (C8)."
              />
            )}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {qMedia ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qMedia}
                  alt=""
                  className="h-14 w-14 rounded-xl object-cover ring-1 ring-black/5"
                />
              </>
            ) : null}
            <label className="grid h-14 w-14 cursor-pointer place-items-center rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:bg-slate-50">
              + фото
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !onUploadQuick) return;
                  try {
                    const url = await onUploadQuick(file);
                    setQMedia(url);
                  } catch {
                    /* parent sets error */
                  }
                }}
              />
            </label>
          </div>
          {highlightRequired && (
            <p className="mb-2 text-xs text-amber-800">
              Укажите страну происхождения (ISO-2) и состав — затем нажмите ещё раз.
            </p>
          )}
          <button
            type="button"
            disabled={busy || !quickReady}
            onClick={runQuick}
            className="w-full rounded-full bg-[#2b72f4] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Запустить AI-расчёт
          </button>
        </div>
      </div>

      {showShipping && (
      <div className="card">
        {activeShip ? (
          <>
            <h2 className="mb-4 text-lg font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
              Активная перевозка {activeShip.trackingCode || activeShip.id.slice(0, 8)}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cabinets/assets/ob-1-truck.jpg"
                  alt=""
                  className="h-44 w-full object-cover"
                />
                <div className="bg-slate-900/90 px-3 py-2 text-sm text-white">
                  {activeShip.origin} → {activeShip.destination} · {activeShip.mode}
                </div>
              </div>
              <div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2 border-b border-slate-100 py-2">
                    <dt className="text-[var(--kb-muted)]">Статус</dt>
                    <dd className="font-semibold">{activeShip.status}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 py-2">
                    <dt className="text-[var(--kb-muted)]">ETA</dt>
                    <dd className="font-semibold">
                      {activeShip.eta
                        ? new Date(activeShip.eta).toLocaleDateString("ru-RU")
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 py-2">
                    <dt className="text-[var(--kb-muted)]">Перевозчик</dt>
                    <dd className="font-semibold">
                      {activeShip.selectedQuote?.carrierLabel || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 py-2">
                    <dt className="text-[var(--kb-muted)]">Трекинг</dt>
                    <dd className="font-semibold">{activeShip.trackingCode || "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
              Активная перевозка
            </h2>
            <p className="mt-2 text-sm text-[var(--kb-muted)]">
              Нет активной перевозки. После статуса DONE можно оформить доставку в разделе
              «Перевозка».
            </p>
          </>
        )}
      </div>
      )}
    </section>
  );
}

function filterEmptyCopy(filter: OrderFilter): { title: string; hint: string } {
  if (filter === "done") {
    return {
      title: "Нет готовых PDF",
      hint: "В этом фильтре нет заявок. Откройте все заявки или создайте просчёт ТН ВЭД.",
    };
  }
  if (filter === "work") {
    return {
      title: "Нет заявок в работе",
      hint: "Сейчас нет просчётов на проверке. Откройте все заявки.",
    };
  }
  if (filter === "hs") {
    return {
      title: "Нет заявок с кодом ТН ВЭД",
      hint: "В этом фильтре нет просчётов с кодом. Откройте все заявки.",
    };
  }
  if (filter === "pay") {
    return {
      title: "Нет заявок к оплате",
      hint: "Нет просчётов, ждущих оплату тарифа.",
    };
  }
  return {
    title: "Пока нет заявок",
    hint: "Создайте первый просчёт ТН ВЭД — брокер проверит код и вы получите PDF.",
  };
}

function OrdersTable({
  calcs,
  listTotal,
  filter = "all",
  onResetFilter,
  busy,
  me,
  selectedId,
  onOpen,
  onPay,
  onTopupThenPay,
  compact,
  showTariff,
  createHref = "/cabinet/new",
}: {
  calcs: Calc[];
  listTotal?: number;
  filter?: OrderFilter;
  onResetFilter?: () => void;
  busy: boolean;
  me: Me | null;
  selectedId?: string | null;
  onOpen: (c: Calc) => void;
  onPay: (c: Calc) => void;
  onTopupThenPay?: (c: Calc) => void;
  compact?: boolean;
  showTariff?: boolean;
  createHref?: string;
}) {
  const total = listTotal ?? calcs.length;
  const filterEmpty = calcs.length === 0 && total > 0 && filter !== "all";
  const searchEmpty = calcs.length === 0 && total > 0 && filter === "all";
  const copy = filterEmptyCopy(filterEmpty || searchEmpty ? (filterEmpty ? filter : "all") : "all");
  const empty = calcs.length === 0 ? (
    searchEmpty ? (
      <p style={{ color: "var(--muted)" }}>Нет заявок в этом фильтре. Создайте первый просчёт.</p>
    ) : (
    <VedEmptyState
      title={copy.title}
      hint={copy.hint}
      actionLabel={filterEmpty ? "Все заявки" : "Создать просчёт"}
      actionHref={filterEmpty ? undefined : createHref}
      onAction={filterEmpty ? onResetFilter : undefined}
    />
    )
  ) : null;

  const rowActions = (c: Calc, payable: boolean, canPay: boolean) => (
    <div className="cl-order-actions" onClick={(e) => e.stopPropagation()}>
      {payable && (
        <>
          <button
            type="button"
            disabled={busy || !canPay}
            className="btn btn-primary btn-sm"
            onClick={() => onPay(c)}
          >
            Оплатить
          </button>
          {!canPay && onTopupThenPay && (
            <button
              type="button"
              disabled={busy}
              className="btn btn-ghost btn-sm"
              onClick={() => onTopupThenPay(c)}
            >
              Пополнить и оплатить
            </button>
          )}
        </>
      )}
      {!compact && c.status === "DONE" && (
        <a
          className="btn btn-ghost btn-sm"
          href={`/api/v1/calculations/${c.id}/pdf`}
          target="_blank"
          rel="noreferrer"
        >
          PDF
        </a>
      )}
    </div>
  );

  if (empty) return empty;

  return (
    <div className="cl-order-grid">
      {calcs.map((c, i) => {
        const price = c.tariff?.priceRub ?? 0;
        const bal = me?.company?.balanceRub ?? 0;
        const canPay = bal >= price;
        const payable = ["AI_READY", "AWAITING_PAYMENT"].includes(c.status) && !c.paidAt;
        const active = selectedId === c.id;
        const sum =
          c.totalPaymentsRub != null
            ? formatRub(c.totalPaymentsRub)
            : payable && price
              ? formatRub(price)
              : "—";
        const hs = shouldRevealClientDraftHs(c)
          ? clientOrderHsLabel({ hsCode: c.hsCode, hsCodeFinal: c.hsCodeFinal })
          : "—";
        return (
          <div
            key={c.id}
            className={`cl-order${active ? " is-open" : ""}`}
            role="button"
            tabIndex={0}
            aria-selected={active}
            onClick={() => onOpen(c)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(c);
              }
            }}
          >
            <div className="ph">
              <OrderCover src={calcThumb(c, i)} />
            </div>
            <div>
              <h4>{c.title}</h4>
              <div className="meta">
                {c.number}
                {c.country ? ` · ${c.country}` : ""}
                {showTariff && c.tariff?.name ? ` · ${c.tariff.name}` : ""}
                {c.preferredBrokerUser?.name ? ` · брокер ${c.preferredBrokerUser.name}` : ""}
              </div>
              <div className="meta">
                HS: {hs} · документы: {c.items?.length || 0}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="meta" style={{ marginTop: 0 }}>
                  <b>{clientOrderNextStep({ status: c.status, paidAt: c.paidAt })}</b>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(c);
                  }}
                >
                  Подробнее
                </button>
              </div>
              {rowActions(c, payable, canPay)}
            </div>
            <div className="right">
              <StatusPill status={c.status} />
              <div className="sum">{sum}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
