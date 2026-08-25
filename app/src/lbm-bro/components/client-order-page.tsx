"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UpgradeTile } from "@/lbm-bro/components/upgrade-tile";
import { PayMath } from "@/lbm-bro/components/pay-math";
import { DocUploader } from "@/lbm-bro/components/doc-uploader";
import { HsLinesTable } from "@/lbm-bro/components/hs-lines";
import { Icon } from "@/lbm-bro/components/icon";
import { PaymentsForm } from "@/lbm-bro/components/payments-form";
import { OrderCover } from "@/lbm-bro/components/order-cover";
import { isOrderPlaceholder, pickOrderCover, resolveOrderImage } from "@/lbm-bro/lib/docs";
import { fmt, fmtSla, stageIndex, TARIFF_RUB } from "@/lbm-bro/lib/format";
import { downloadDemoPdf, shareDemoPdf } from "@/lbm-bro/lib/order-pdf";
import { CUSTOMS_CALC_MSGS, CUSTOMS_FEE, EMPTY_PAYMENTS, parseRub, paymentsSummary, resolvePayments, type PaymentDraft } from "@/lbm-bro/lib/payments";
import { tariffHasBroker, tariffHasCustoms, tariffShowsRoute, upgradeCost } from "@/lbm-bro/lib/tariffs";
import type { TariffName } from "@/lbm-bro/lib/types";
import { useDemo } from "@/lbm-bro/lib/store";

function money(v: string) {
  if (!v || v === "—" || v === "тариф") return v || "—";
  return v.includes("₽") ? v : `${v} ₽`;
}

function draftFromOrder(order: {
  city?: string;
  price?: string;
  currency?: string;
  qty?: string;
  weightKg?: string;
  places?: string;
  incoterm?: string;
}): PaymentDraft {
  return {
    city: order.city || EMPTY_PAYMENTS.city,
    price: order.price || EMPTY_PAYMENTS.price,
    currency: order.currency || EMPTY_PAYMENTS.currency,
    qty: order.qty || "",
    weightKg: order.weightKg || "",
    places: order.places || "",
    incoterm: order.incoterm || EMPTY_PAYMENTS.incoterm,
  };
}

export function ClientOrderPage({ id }: { id: string }) {
  const router = useRouter();
  const { orders, payOrder, sendToBroker, applyPayments, upgradeTariff, payCustomsBill, showToast, setCurrentOrderId, tickSla, notes, setOrderDocs, balance } = useDemo();
  const o = orders.find((x) => x.id === id);
  const [payDraft, setPayDraft] = useState<PaymentDraft>(EMPTY_PAYMENTS);
  const [syncedOrderId, setSyncedOrderId] = useState<string | null>(null);
  const [addonDraft, setAddonDraft] = useState<"none" | "customs" | "turnkey">("none");
  const [customsCalculating, setCustomsCalculating] = useState(false);
  const [customsCalcStatus, setCustomsCalcStatus] = useState("");

  if (o && syncedOrderId !== o.id) {
    setSyncedOrderId(o.id);
    setCurrentOrderId(o.id);
    setPayDraft(draftFromOrder(o));
  }

  useEffect(() => {
    if (!o || o.status !== "broker" || o.slaLeft <= 0) return;
    const t = window.setInterval(() => tickSla(o.id), 1000);
    return () => window.clearInterval(t);
  }, [o, tickSla]);

  if (!o) {
    return <p style={{ color: "var(--muted)" }}>Заявка не найдена. <Link href="/client/orders">К списку</Link></p>;
  }

  const order = o;
  const hasCustoms = tariffHasCustoms(order.tariff);
  const hasBroker = tariffHasBroker(order.tariff);
  const st = stageIndex(order.status, order.tariff);
  const labels = hasCustoms
    ? ["Параметры", "Оплата", "Код", "Платежи", "Файл"]
    : ["Параметры", "Оплата", "Код", "Файл"];
  const feeAmt = TARIFF_RUB[order.tariff] || 2990;
  const sla = order.status === "broker" && order.slaLeft > 0;
  const orderNotes = notes.filter((n) => n.orderId === order.id);
  const risky = Boolean(order.risk && order.risk !== "Низкий" && order.risk !== "—");
  const codeUnlocked = order.status === "ai" || order.status === "ready" || order.status === "broker" || order.status === "done";
  const hasHs = codeUnlocked && Boolean(order.hs && order.hs !== "—");
  const hasCalc = Boolean(order.duty && order.duty !== "—");
  const paymentsUnlocked = hasCalc;
  const customsBill = hasCalc ? parseRub(order.duty) + parseRub(order.vat) + CUSTOMS_FEE : 0;
  const addCustoms = upgradeCost(order.tariff, "Таможня");
  const addTurnkey = upgradeCost(order.tariff, "Под ключ");
  const showCustomsUpgrade = !hasCustoms && addCustoms > 0;
  const showTurnkeyUpgrade = !hasBroker && addTurnkey > 0;
  const showCustomsBill = hasCustoms && hasCalc && !order.customsPaid && customsBill > 0;
  const customsFlowActive = hasCustoms || addonDraft !== "none";
  const customsFormLocked = customsCalculating || (addonDraft !== "none" && !hasCustoms);
  const showCustomsPay = customsFormLocked && !customsCalculating;
  const addonPayAmount = addonDraft === "customs" ? addCustoms : addonDraft === "turnkey" ? addTurnkey : 0;
  const canPayAddon = addonPayAmount <= 0 || balance >= addonPayAmount;

  function charge(ok: boolean) {
    if (!ok) router.push("/client/balance");
  }

  function payAndGetReport() {
    if (addonDraft === "none" || customsCalculating) return;
    if (!payDraft.price?.trim()) {
      showToast("Укажите таможенную стоимость партии");
      return;
    }
    const next: TariffName = addonDraft === "turnkey" ? "Под ключ" : "Таможня";
    if (!upgradeTariff(order.id, next)) {
      router.push("/client/balance");
      return;
    }
    setCustomsCalculating(true);
    setCustomsCalcStatus(CUSTOMS_CALC_MSGS[0]);
    let msgIdx = 0;
    const tick = window.setInterval(() => {
      msgIdx += 1;
      if (CUSTOMS_CALC_MSGS[msgIdx]) setCustomsCalcStatus(CUSTOMS_CALC_MSGS[msgIdx]);
    }, 850);
    window.setTimeout(() => {
      window.clearInterval(tick);
      savePayments();
      setAddonDraft("none");
      setCustomsCalculating(false);
    }, 2600);
  }

  function buy(next: TariffName) {
    charge(upgradeTariff(order.id, next));
  }

  function pay() {
    const ok = payOrder(order.id);
    if (!ok) router.push("/client/balance");
  }

  function savePayments(opts?: { send?: boolean }) {
    const packLines = order.lines?.filter((l) => l.hs && l.hs !== "—") ?? [];
    const p = resolvePayments({
      price: payDraft.price,
      currency: payDraft.currency,
      hs: order.hs,
      lines: packLines.length >= 2 ? packLines : undefined,
    });
    const s = paymentsSummary(p);
    applyPayments(order.id, {
      ...payDraft,
      country: order.country,
      route: `${order.country || order.route.split("→")[0]?.trim() || "—"} → ${payDraft.city}`,
      duty: s.duty,
      vat: s.vat,
      fee: s.fee,
      sum: s.sum,
    }, opts);
    return s;
  }

  const next =
    order.status === "pay" ? (
      <div style={{ display: "grid", gap: 8 }}>
        <PayMath balance={balance} amount={feeAmt} />
        <button type="button" className="btn btn-primary" onClick={pay}>Оплатить тариф {fmt(feeAmt)} ₽</button>
      </div>
    ) : order.status === "ai" ? (
      <p className="meta" style={{ margin: 0 }}>Форма таможенного расчёта — слева, по коду ТН ВЭД.</p>
    ) : order.status === "ready" ? (
      <div style={{ display: "grid", gap: 8 }}>
        {!order.customsPaid && customsBill > 0 ? (
          <>
            <PayMath balance={balance} amount={customsBill} />
            <button type="button" className="btn btn-primary" onClick={() => charge(payCustomsBill(order.id))}>
              Оплатить на таможне {fmt(customsBill)} ₽
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => downloadDemoPdf(order, showToast)}>Скачать PDF</button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => void shareDemoPdf(order, showToast)}>Поделиться</button>
        {hasBroker ? (
          <button type="button" className="btn btn-ghost" onClick={() => sendToBroker(order.id)}>Передать брокеру</button>
        ) : addTurnkey > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => buy("Под ключ")}>
            Брокер под ключ · {fmt(addTurnkey)} ₽
          </button>
        ) : null}
      </div>
    ) : order.status === "done" ? (
      <div style={{ display: "grid", gap: 8 }}>
        <button type="button" className="btn btn-primary" onClick={() => downloadDemoPdf(order, showToast)}>Скачать PDF с кодом</button>
        <button type="button" className="btn btn-ghost" onClick={() => void shareDemoPdf(order, showToast)}>Поделиться</button>
        {!hasCustoms ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => buy("Таможня")}>
              Таможенный расчёт · {fmt(addCustoms)} ₽
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => buy("Под ключ")}>
              Брокер под ключ · {fmt(addTurnkey)} ₽
            </button>
          </>
        ) : null}
      </div>
    ) : order.status === "draft" ? (
      <Link href="/client/new" className="btn btn-primary">Продолжить просчёт</Link>
    ) : (
      <Link href="/client/chat" className="btn btn-primary">Написать брокеру</Link>
    );

  const nextHint =
    order.status === "pay"
      ? (hasCustoms
        ? "После оплаты откроется код, затем форма таможенного расчёта."
        : "После оплаты откроется только код ТН ВЭД.")
      : order.status === "ai" ? "Код уже ваш. Заполните стоимость партии — получите пошлину и НДС." :
    order.status === "ready"
      ? (hasBroker
        ? "Расчёт готов. Брокер включён в тариф — передайте ему заявку или скачайте PDF."
        : "Расчёт готов. Скачайте или поделитесь. Брокер в этот тариф не входит.")
      : order.status === "broker" ? "Можно уточнить состав в чате, пока идёт проверка." :
    order.status === "draft" ? "Допишите описание и оплатите тариф, чтобы получить код." :
    "Код уже оплачен. Документы в заявке. Дальше можно доплатить таможню или брокера.";

  const nextTitle =
    order.status === "pay" ? "Оплата тарифа" :
    order.status === "ai" ? "Дальше — таможня" :
    order.status === "ready" ? (hasBroker ? "Передать брокеру" : "Расчёт готов") :
    order.status === "broker" ? "Ожидание брокера" :
    order.status === "draft" ? "Черновик просчёта" :
    "Код готов";

  return (
    <div className="order-full">
      <div className="order-full-top">
        <div>
          <Link href="/client/orders" className="btn btn-ghost btn-sm">← К заявкам</Link>
          <span className="go-kicker" style={{ display: "block", marginTop: 14 }}>Заявка #{order.id}</span>
          <h2>{order.title}</h2>
          <div className="meta">
            {tariffShowsRoute(order.tariff) ? `${order.route} · ` : order.country ? `${order.country} · ` : ""}
            тариф {order.tariff}
          </div>
        </div>
        <span className={`pill ${order.pillClass}`}>{order.pill}</span>
      </div>

      <div className="timeline" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
        {labels.map((lab, i) => (
          <button key={lab} type="button" className={i < st ? "done" : i === st ? "on" : ""}>
            <div className="dot" /><strong>{lab}</strong>
          </button>
        ))}
      </div>

      {sla ? (
        <div className={`sla-banner${order.slaLeft < 1800 ? " warn" : ""}`}>
          <div>
            <strong>{order.broker} смотрит заявку</strong>
            <div className="meta">SLA проверки ≤ 4 ч</div>
          </div>
          <div className="t">{fmtSla(order.slaLeft)}</div>
        </div>
      ) : null}

      <div className="order-full-grid">
        <div className="order-full-col">
          <section className={`order-hs${hasHs ? "" : " empty"}`}>
            <div className="order-hs-copy">
              <span className="gt-kicker">
                {hasHs
                  ? (order.lines?.length ? `Пакет ${order.lines.length} кодов ТН ВЭД` : "Код ТН ВЭД ЕАЭС")
                  : order.status === "pay" ? "Код после оплаты" : "Код ещё не посчитан"}
              </span>
              <div className="order-hs-code">
                {hasHs ? (order.lines?.length ? `${order.hs} · ${order.lines.length} поз.` : order.hs) : "— — —"}
              </div>
              <p>
                {hasHs
                  ? (order.why || "Код открыт после оплаты. Платежи считаются отдельной формой.")
                  : order.status === "pay"
                    ? "Оплатите тариф — AI откроет код ТН ВЭД."
                    : "Допишите просчёт и оплатите тариф, чтобы получить код."}
              </p>
              {hasHs && order.conf ? (
                <>
                  <div className="order-hs-conf"><span>{order.lines?.length ? "Средняя уверенность AI" : "Уверенность AI"} {order.conf}%</span></div>
                  <div className="conf"><i style={{ width: `${order.conf}%` }} /></div>
                </>
              ) : null}
              {hasHs ? (
                <Link href={`/client/tnved?hs=${encodeURIComponent(order.hs)}`} className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}>
                  Справочник ТН ВЭД
                </Link>
              ) : null}
              {codeUnlocked ? (
                <div className={`alert-box ${risky ? "warn-box" : "ok-box"}`}>
                  <strong>Риск</strong>{order.risk || "—"}
                </div>
              ) : (
                <div className="alert-box ok-box">
                  <strong>Пока закрыто</strong>Сначала код после оплаты, затем форма стоимости и налогов.
                </div>
              )}
            </div>
            <div className={`order-hs-media${isOrderPlaceholder(resolveOrderImage(pickOrderCover(order))) ? " placeholder" : ""}`}>
              <OrderCover src={pickOrderCover(order)} />
            </div>
          </section>

          {order.lines?.length ? (
            <div className="card">
              <h3>Позиции инвойса</h3>
              <p className="meta" style={{ margin: "0 0 12px" }}>
                Код ТН ВЭД подобран по каждой строке. Таможенный расчёт в форме ниже — по первому коду и сумме партии.
              </p>
              <HsLinesTable lines={order.lines} />
            </div>
          ) : null}

          {hasHs && customsFlowActive && order.status !== "pay" && order.status !== "draft" ? (
            <div className="card" id="order-customs-form">
              <h3>Стоимость и налоги</h3>
              <p className="meta" style={{ margin: "0 0 14px" }}>
                {customsCalculating
                  ? "Оплата прошла — формируем таможенный расчёт по вашей партии."
                  : showCustomsPay
                  ? "Заполните партию — после оплаты сформируем отчёт с пошлиной и НДС."
                  : hasCalc
                    ? "Отчёт готов — можно скачать PDF или передать брокеру."
                    : "Код уже есть. Укажите партию — получите пошлину и НДС"
                      + (hasBroker ? ". Брокер включён в тариф — после цифр передайте ему заявку." : ". Брокер в этот тариф не входит.")}
              </p>
              {customsCalculating ? (
                <div className="ai-run card" style={{ margin: 0 }}>
                  <div className="ring" />
                  <h3 style={{ fontFamily: "var(--display)", fontSize: "1.35rem" }}>Считаем пошлину и НДС</h3>
                  <p style={{ color: "var(--muted)", marginTop: 8 }}>{customsCalcStatus}</p>
                  {order.lines && order.lines.length >= 2 ? <HsLinesTable lines={order.lines} compact /> : null}
                </div>
              ) : (
                <>
              <PaymentsForm
                value={payDraft}
                onChange={(patch) => setPayDraft((d) => ({ ...d, ...patch }))}
                hs={order.hs}
                tariffPaid={feeAmt}
                locked={!hasCalc}
                lines={order.lines && order.lines.length >= 2 ? order.lines : undefined}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                {showCustomsPay ? (
                  canPayAddon ? (
                    <button type="button" className="btn btn-primary" onClick={payAndGetReport}>
                      Оплатить {fmt(addonPayAmount)} ₽ и получить отчёт
                    </button>
                  ) : (
                    <Link href="/client/balance" className="btn btn-primary">Пополнить баланс</Link>
                  )
                ) : hasCalc ? (
                  <>
                    <button
                      type="button"
                      className={hasBroker ? "btn btn-ghost" : "btn btn-primary"}
                      onClick={() => {
                        const s = savePayments();
                        downloadDemoPdf({ ...order, ...s, hs: order.hs }, showToast);
                      }}
                    >
                      Скачать PDF
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        const s = savePayments();
                        void shareDemoPdf({ ...order, ...s, hs: order.hs }, showToast);
                      }}
                    >
                      Поделиться
                    </button>
                    {hasBroker ? (
                      <button type="button" className="btn btn-primary" onClick={() => savePayments({ send: true })}>
                        Передать брокеру
                      </button>
                    ) : null}
                  </>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => savePayments()}>
                    Сохранить расчёт
                  </button>
                )}
              </div>
                </>
              )}
            </div>
          ) : null}

          {paymentsUnlocked ? (
            <div className="order-facts">
              {tariffShowsRoute(order.tariff) ? (
                <div className="metric"><div className="k">Маршрут</div><div className="v">{order.route}</div></div>
              ) : order.country ? (
                <div className="metric"><div className="k">Происхождение</div><div className="v">{order.country}</div></div>
              ) : null}
              <div className="metric"><div className="k">Тариф</div><div className="v">{order.tariff}</div></div>
              <div className="metric"><div className="k">Брокер</div><div className="v">{order.broker}</div></div>
              <div className="metric"><div className="k">На таможне</div><div className="v">{order.sum}</div></div>
            </div>
          ) : order.status !== "ai" ? (
            <div className="order-facts">
              {tariffShowsRoute(order.tariff) ? (
                <div className="metric"><div className="k">Маршрут</div><div className="v">{order.route}</div></div>
              ) : order.country ? (
                <div className="metric"><div className="k">Происхождение</div><div className="v">{order.country}</div></div>
              ) : null}
              <div className="metric"><div className="k">Тариф</div><div className="v">{order.tariff}</div></div>
              <div className="metric"><div className="k">Брокер</div><div className="v">{order.broker}</div></div>
              <div className="metric"><div className="k">Итого</div><div className="v">{hasHs ? "код оплачен" : "после платежей"}</div></div>
            </div>
          ) : null}

          <div className="card">
            <h3>{order.docs.length ? "Документы в заявке" : "Документы"}</h3>
            <p className="meta" style={{ margin: "0 0 12px" }}>
              {order.docs.length
                ? "Уже приложены к этому просчёту. Можно добавить ещё, если нужно."
                : "Invoice, packing list или фото — если ещё не загружали."}
            </p>
            <DocUploader
              docs={order.docs}
              onChange={(docs) => setOrderDocs(order.id, docs)}
              onToast={showToast}
              compact={order.docs.length > 0}
            />
          </div>

          {hasHs ? (
            <div className="card">
              <h3>Доплатить по этой заявке</h3>
              <p className="meta" style={{ margin: "0 0 14px" }}>
                Код уже ваш. Документы заново прикладывать не нужно — доплата идёт сюда же.
              </p>
              {!hasCustoms ? (
                <div className="upgrade-tiles">
                  {showCustomsUpgrade ? (
                    <UpgradeTile
                      icon="chart"
                      tag="Рекомендуем"
                      title="Таможенный расчёт"
                      desc={`Пошлина и НДС по коду ${order.hs}. Считаем по вашему инвойсу — без новой заявки.`}
                      items={["Таможенная стоимость и курс", "Пошлина и НДС 20%", "PDF с кодом и платежами"]}
                      price={`${fmt(addCustoms)} ₽`}
                      note="доплата к тарифу «Код»"
                      featured
                      primary
                      payAmount={addCustoms}
                      balance={balance}
                      cta="Рассчитать таможню и налоги"
                      onClick={() => {
                        setAddonDraft("customs");
                        window.setTimeout(() => {
                          document.getElementById("order-customs-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 0);
                      }}
                    />
                  ) : null}
                  {showTurnkeyUpgrade ? (
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
                      onClick={() => {
                        setAddonDraft("turnkey");
                        window.setTimeout(() => {
                          document.getElementById("order-customs-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 0);
                      }}
                    />
                  ) : null}
                </div>
              ) : (
                <>
                  {order.customsPaid ? (
                    <div className="alert-box ok-box" style={{ marginBottom: showTurnkeyUpgrade ? 14 : 0 }}>
                      <strong>Таможня</strong>Счёт по пошлине и НДС по этой заявке оплачен.
                    </div>
                  ) : !hasCalc ? (
                    <p className="meta" style={{ marginBottom: showTurnkeyUpgrade ? 14 : 0 }}>Сначала заполните форму расчёта — затем появится счёт на таможню.</p>
                  ) : null}
                  {showCustomsBill || showTurnkeyUpgrade ? (
                    <div className={`upgrade-tiles${showCustomsBill && showTurnkeyUpgrade ? "" : " single"}`}>
                      {showCustomsBill ? (
                        <UpgradeTile
                          icon="wallet"
                          tag="Государству"
                          title="Счёт на таможню"
                          desc="Пошлина, НДС и сбор по этой заявке. Это платежи на таможню, не тариф LBM."
                          items={[
                            `Пошлина · ${money(order.duty)}`,
                            `НДС 20% · ${money(order.vat)}`,
                            `Сбор · ${fmt(CUSTOMS_FEE)} ₽`,
                          ]}
                          price={`${fmt(customsBill)} ₽`}
                          note="к уплате на таможне"
                          tone="bill"
                          featured
                          primary
                          payAmount={customsBill}
                          balance={balance}
                          cta="Оплатить счёт на таможню"
                          onClick={() => charge(payCustomsBill(order.id))}
                        />
                      ) : null}
                      {showTurnkeyUpgrade ? (
                        <UpgradeTile
                          icon="users"
                          tag="Брокер включён"
                          title="Брокер под ключ"
                          desc="Живой эксперт возьмёт ваш код и расчёт, проверит риски и доведёт до PDF."
                          items={["Проверка кода и документов", "Правки по спорным позициям", "Чат с брокером"]}
                          price={`${fmt(addTurnkey)} ₽`}
                          note="доплата к тарифу «Таможня»"
                          primary={!showCustomsBill}
                          payAmount={addTurnkey}
                          balance={balance}
                          cta="Оплатить услугу брокера"
                          onClick={() => buy("Под ключ")}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="order-svc">
              <Link href="/client/ship" className="go-tile svc ship">
                <div className="gt-ico"><Icon name="truck" /></div>
                <div className="gt-title">Перевозка</div>
                <div className="gt-sub">Только фуры и наземная доставка по этой заявке</div>
                <div className="gt-more">Заказать <span>›</span></div>
                <div className="gt-art art-ship" aria-hidden>
                  <div className="cab" /><div className="trail" />
                </div>
              </Link>
              <Link href="/client/clearance" className="go-tile svc clear">
                <div className="gt-ico"><Icon name="shield" /></div>
                <div className="gt-title">Оформление</div>
                <div className="gt-sub">Декларация, платежи и выпуск</div>
                <div className="gt-more">Оформить <span>›</span></div>
                <div className="gt-art art-clear" aria-hidden>
                  <div className="stamp">ТО</div>
                </div>
              </Link>
              <Link href="/client/brokers" className="go-tile svc turnkey">
                <div className="gt-ico"><Icon name="users" /></div>
                <div className="gt-title">Брокер под ключ</div>
                <div className="gt-sub">Сменить эксперта или взять пакет</div>
                <div className="gt-more">Выбрать <span>›</span></div>
                <div className="gt-art art-turn" aria-hidden>
                  <div className="p1" /><div className="p2" />
                </div>
              </Link>
            </div>
          )}
        </div>

        <aside className="order-aside">
          <div className="card order-next">
            <h3>{nextTitle}</h3>
            <p className="meta" style={{ marginBottom: 14 }}>{nextHint}</p>
            {next}
          </div>

          <div className="card">
            <h3>Платежи</h3>
            {paymentsUnlocked ? (
              <>
                <div className="pay-row"><span>Пошлина</span><strong>{money(order.duty)}</strong></div>
                <div className="pay-row"><span>НДС</span><strong>{money(order.vat)}</strong></div>
                <div className="pay-row"><span>Сбор</span><strong>{money(order.fee)}</strong></div>
                <div className="pay-row total"><span>На таможне</span><strong>{order.sum}</strong></div>
                {order.customsPaid ? (
                  <p className="meta" style={{ marginTop: 10 }}>Счёт на таможню оплачен.</p>
                ) : null}
              </>
            ) : (
              <p className="meta" style={{ margin: 0 }}>
                {order.status === "ai"
                  ? "Появится после формы слева — по коду, стоимости и партии."
                  : order.status === "pay"
                    ? (hasCustoms ? "Сначала код после оплаты, затем таможенный расчёт." : "В тарифе «Код» пошлина и НДС не считаются.")
                    : hasCustoms
                      ? "Пошлина и НДС считаются после кода."
                      : "Таможенный расчёт и брокер можно доплатить в этой же заявке."}
              </p>
            )}
          </div>

          <div className="card order-broker">
            <h3>Брокер</h3>
            {order.broker && order.broker !== "—" ? (
              <>
                <div className="order-broker-row">
                  <div className="photo"><img src="/lbm-bro/assets/avatar-broker.svg" alt="" /></div>
                  <div>
                    <strong>Алексей {order.broker}</strong>
                    <div className="meta">Онлайн · SLA ≤ 4 ч</div>
                  </div>
                </div>
                <Link href="/client/chat" className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 12 }}>Открыть чат</Link>
              </>
            ) : (
              <>
                <p className="meta" style={{ marginBottom: 12 }}>
                  {hasBroker
                    ? (order.status === "ready" || order.status === "ai"
                      ? "Брокер включён в тариф «Под ключ». После расчёта нажмите «Передать брокеру»."
                      : "Брокер входит в пакет — появится после передачи заявки.")
                    : "Брокер не входит в тариф «Код». Можно доплатить пакет «Под ключ» в этой заявке."}
                </p>
                <Link href="/client/brokers" className="btn btn-ghost btn-sm">Выбрать заранее</Link>
              </>
            )}
          </div>

          {orderNotes.length ? (
            <div className="card">
              <h3>События</h3>
              <div className="activity-list">
                {orderNotes.map((n) => (
                  <div key={n.id} className="activity-item">
                    <div className={`dot ${n.tone}`} />
                    <div><strong>{n.title}</strong><span>{n.text}</span></div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
