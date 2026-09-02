"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "../VedShell";
import { EventsTimeline } from "../EventsTimeline";
import { LandedWithoutFreightCard } from "../LandedWithoutFreightCard";
import { OrderResultFeedback } from "./OrderResultFeedback";
import type { Broker, Calc, ClientFeedbackReaction, Me } from "./types";
import { originCountryRuLabel } from "@/lib/ved/field-suggest";
import { landedFromAiDraft } from "@/lib/ved/landed-cost";
import { formatTestModeLlmNotice } from "@/lib/ved/ai-drain-retry";
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
import { AiRunCard } from "./AiRunCard";
import { UpgradeTile } from "@/lbm-bro/components/upgrade-tile";
import { OrderCover } from "@/lbm-bro/components/order-cover";
import { HsLinesTable } from "@/lbm-bro/components/hs-lines";
import { PayMath } from "@/lbm-bro/components/pay-math";
import { Icon } from "@/lbm-bro/components/icon";
import { isOrderPlaceholder, resolveOrderImage } from "@/lbm-bro/lib/docs";
import type { HsLine } from "@/lbm-bro/lib/types";
import {
  clientOrderHsLabel,
  clientOrderNextStep,
  clientOrderTimeline,
  formatRub,
  wizardStepClass,
} from "../lbm-pane-visual";

function clientLlmSoftFailNotice(calc: Calc): string | null {
  const codes = calc.aiDraft?.llmSoftFails;
  if (Array.isArray(codes) && codes.length) {
    return formatTestModeLlmNotice(codes.map(String));
  }
  const d = calc.aiDraft?.disclaimer || "";
  if (/Тестовый режим:/i.test(d)) {
    const m = d.match(/Тестовый режим:[^.]*\.\s*Использован запасной путь;[^.]*\.?/i);
    return m ? m[0].trim() : d;
  }
  return null;
}

function itemsAsHsLines(items: Calc["items"], confPct: number | null, revealed: boolean): HsLine[] {
  const conf = confPct ?? 0;
  return (items || []).map((it, i) => ({
    id: it.id,
    n: i + 1,
    name: it.name,
    qty: it.qty != null ? String(it.qty) : "",
    price: it.unitPrice != null ? String(it.unitPrice) : "",
    currency: "USD",
    hs: revealed ? it.hsCodeFinal || it.hsCodeAi || "—" : "—",
    conf: revealed ? conf : 0,
    why: it.description || "",
    risk: "",
    status: revealed
      ? it.hsCodeFinal
        ? "ok"
        : it.hsCodeAi
          ? "run"
          : "wait"
      : "wait",
  }));
}

function holdClick() {
  /* C15: visual slot only — no domain upgrade / customs bill / ship order. */
}

export function OrderDetail({
  selected,
  brokers,
  me,
  preferredBrokerUserId,
  busy,
  onPreferred,
  onPay,
  onTopupThenPay,
  onFeedback,
  ordersHref = "/cabinet/orders",
  tnvedHref = "/cabinet/tnved",
  children,
}: {
  selected: Calc;
  brokers: Broker[];
  me: Me | null;
  preferredBrokerUserId: string;
  busy: boolean;
  onPreferred: (id: string) => void;
  onPay: () => void;
  onTopupThenPay?: () => void;
  onFeedback?: (reaction: ClientFeedbackReaction, comment?: string) => Promise<void>;
  ordersHref?: string;
  tnvedHref?: string;
  children?: ReactNode;
}) {
  const price = selected.tariff?.priceRub ?? 0;
  const balance = me?.company?.balanceRub ?? 0;
  const canPay = balance >= price;
  const payable =
    ["AI_READY", "AWAITING_PAYMENT"].includes(selected.status) && !selected.paidAt;
  const llmNotice = clientLlmSoftFailNotice(selected);
  const enrichPending = isAiDrainPending(selected);
  const confPct = calcConfidencePct(selected);
  const needsClarify = needsClassificationClarify(selected);
  const whyTitle = classificationWhyTitle(selected);
  const whyBody = classificationWhyBody(selected);
  const heroKicker = classificationHeroKicker(selected, enrichPending);
  const timeline = clientOrderTimeline({
    status: selected.status,
    paidAt: selected.paidAt,
  });
  const hs = clientOrderHsLabel({
    hsCode: selected.hsCode,
    hsCodeFinal: selected.hsCodeFinal,
  });
  const codeRevealed = shouldRevealClientDraftHs(selected);
  const hasHs = codeRevealed && hs !== "—";
  const displayHs = codeRevealed ? hs : "— — —";
  const cover = selected.items?.find((it) => it.mediaUrl)?.mediaUrl;
  const originLabel = originCountryRuLabel(
    selected.country,
    selected.items?.[0]?.attrs?.originCountry,
  );
  const brokerName =
    selected.preferredBrokerUser?.name ||
    brokers.find((b) => b.user.id === selected.preferredBrokerUserId)?.user.name ||
    "—";
  const lines = itemsAsHsLines(selected.items, confPct, codeRevealed);
  const docs = (selected.items || []).filter((it) => it.mediaUrl);
  const hasCalc = (selected.dutyRub ?? 0) > 0 || (selected.vatRub ?? 0) > 0;
  const nextTitle = payable
    ? "Оплата тарифа"
    : selected.status === "DONE"
      ? "Код готов"
      : ["QUEUED", "IN_REVIEW", "SLA_RISK"].includes(selected.status)
        ? "Ожидание брокера"
        : clientOrderNextStep({ status: selected.status, paidAt: selected.paidAt });

  return (
    <div className="order-full view-client">
      <div className="order-full-top">
        <div>
          <Link href={ordersHref} className="btn btn-ghost btn-sm">
            ← К заявкам
          </Link>
          <span className="go-kicker" style={{ display: "block", marginTop: 14 }}>
            Заявка {selected.number}
          </span>
          <h2>{selected.title}</h2>
          <div className="meta">
            {originLabel ? `${originLabel} · ` : ""}
            тариф {selected.tariff?.name || "—"}
          </div>
        </div>
        <StatusPill status={selected.status} />
      </div>

      <div className="timeline" style={{ gridTemplateColumns: `repeat(${timeline.labels.length}, minmax(0, 1fr))` }}>
        {timeline.labels.map((lab, i) => (
          <button key={lab} type="button" className={wizardStepClass(i, timeline.current)} tabIndex={-1}>
            <div className="dot" />
            <strong>{lab}</strong>
          </button>
        ))}
      </div>

      <div className="order-full-grid">
        <div className="order-full-col">
          {enrichPending ? (
            <AiRunCard
              title={aiRunTitle(enrichPending, lines.length >= 2)}
              lines={lines.length >= 2 ? lines : undefined}
              compactTable
            />
          ) : null}

          {enrichPending && !hasHs ? null : (
            <section className={`order-hs${hasHs ? "" : " empty"}`}>
              <div className="order-hs-copy">
                <span className="gt-kicker">
                  {codeRevealed ? heroKicker : payable ? "Код после оплаты" : heroKicker}
                </span>
                <div className="order-hs-code">{displayHs}</div>
                {originLabel ? (
                  <p className="meta" style={{ margin: "8px 0 0" }}>
                    Страна происхождения · {originLabel}
                  </p>
                ) : null}
                {enrichPending && hasHs ? (
                  <p className="meta" style={{ margin: "10px 0 0" }}>
                    Предварительный черновик. Точный код обновится через 1–2 минуты.
                  </p>
                ) : null}
                {!enrichPending && codeRevealed ? (
                  <>
                    {confPct != null ? (
                      <>
                        <div className="order-hs-conf">
                          <span>
                            {lines.length >= 2 ? "Средняя уверенность AI" : "Уверенность AI"} {confPct}%
                          </span>
                        </div>
                        <div className="conf">
                          <i style={{ width: `${confPct}%` }} />
                        </div>
                      </>
                    ) : (
                      <div className="order-hs-conf">Уверенность AI: —</div>
                    )}
                    <div
                      className={`alert-box ${needsClarify ? "warn-box" : "ok-box"}`}
                      style={{ marginTop: 14 }}
                    >
                      <strong>{whyTitle}</strong>
                      {whyBody}
                    </div>
                    {selected.aiDraft?.llmEnrich ? (
                      <p className="meta" style={{ margin: "10px 0 0" }}>
                        Уточнено {selected.aiDraft.llmEnrich}. Финал подтверждает брокер.
                      </p>
                    ) : null}
                  </>
                ) : confPct != null && hasHs ? (
                  <>
                    <div className="order-hs-conf">
                      <span>Уверенность AI {confPct}% · предварительно</span>
                    </div>
                    <div className="conf">
                      <i style={{ width: `${confPct}%` }} />
                    </div>
                  </>
                ) : null}
                {codeRevealed && hasHs ? (
                  <Link
                    href={`${tnvedHref}?hs=${encodeURIComponent(hs)}`}
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 14 }}
                  >
                    Справочник ТН ВЭД
                  </Link>
                ) : null}
              </div>
              <div
                className={`order-hs-media${isOrderPlaceholder(resolveOrderImage(cover)) ? " placeholder" : ""}`}
                aria-hidden
              >
                <OrderCover src={cover} />
              </div>
            </section>
          )}

          {lines.length >= 2 && codeRevealed ? (
            <div className="card">
              <h3>Позиции инвойса</h3>
              <p className="meta" style={{ margin: "0 0 12px" }}>
                Код ТН ВЭД по каждой строке
                {confPct != null ? ` · средняя уверенность ${confPct}%` : ""}. Таможня справа — НДС 22% и сбор
                ПП 1637.
              </p>
              <HsLinesTable lines={lines} />
            </div>
          ) : null}

          <div className="card lbm-m-hide" id="order-customs-form">
            <h3>Стоимость и налоги</h3>
            <p className="meta" style={{ margin: "0 0 14px" }}>
              Куда едет партия и условия поставки. Платежи справа — пошлина, НДС 22% и сбор ПП 1637.
            </p>
            <fieldset disabled className="order-hold-form">
              <div className="two">
                <div className="field">
                  <label>Куда в РФ</label>
                  <select defaultValue="Москва">
                    <option>Москва</option>
                    <option>Санкт-Петербург</option>
                  </select>
                </div>
                <div className="field">
                  <label>Условия поставки</label>
                  <select defaultValue="FOB">
                    <option>FOB</option>
                    <option>CIF</option>
                    <option>EXW</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Таможенная стоимость партии</label>
                <input defaultValue="" placeholder="из документов партии" readOnly />
              </div>
            </fieldset>
          </div>

          <div className="order-facts">
            <div className="metric">
              <div className="k">Происхождение</div>
              <div className="v">{originLabel || "—"}</div>
            </div>
            <div className="metric">
              <div className="k">Тариф</div>
              <div className="v">{selected.tariff?.name || "—"}</div>
            </div>
            <div className="metric">
              <div className="k">Брокер</div>
              <div className="v">{brokerName}</div>
            </div>
            <div className="metric">
              <div className="k">На таможне</div>
              <div className="v">{hasCalc ? formatRub(selected.totalPaymentsRub ?? 0) : "после цифр"}</div>
            </div>
          </div>

          {!landedFromAiDraft(selected.aiDraft) ? (
            <div className="order-facts">
              <div className="metric">
                <div className="k">Пошлина</div>
                <div className="v">{formatRub(selected.dutyRub ?? 0)}</div>
              </div>
              <div className="metric">
                <div className="k">НДС 22%</div>
                <div className="v">{formatRub(selected.vatRub ?? 0)}</div>
              </div>
              <div className="metric">
                <div className="k">Сбор ПП 1637</div>
                <div className="v">{formatRub(selected.feeRub ?? 0)}</div>
              </div>
              <div className="metric">
                <div className="k">Итого</div>
                <div className="v">{formatRub(selected.totalPaymentsRub ?? 0)}</div>
              </div>
            </div>
          ) : null}

          <LandedWithoutFreightCard calc={selected} />

          <div className="card">
            <h3>{docs.length ? "Документы в заявке" : "Документы"}</h3>
            <p className="meta" style={{ margin: "0 0 12px" }}>
              {docs.length
                ? "Файлы позиций этой заявки."
                : "Invoice, packing list или фото."}
            </p>
            {docs.length ? (
              <div className="doc-list">
                {docs.map((it) => (
                  <div key={it.id} className="doc-chip">
                    <div className="doc-thumb">
                      <OrderCover src={it.mediaUrl} />
                    </div>
                    <div className="doc-info">
                      <b>{it.name || "Файл"}</b>
                      <span className="meta">позиция</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="dropzone order-hold-drop lbm-m-hide" aria-disabled>
              <strong>Добавить документ</strong>
              <span className="meta">CSV, PDF, JPG · до 12 МБ</span>
            </div>
          </div>

          <div className="card lbm-m-hide">
            <h3>Доплатить по этой заявке</h3>
            <p className="meta" style={{ margin: "0 0 14px" }}>
              Таможня и брокер — отдельные пакеты в макете. Здесь тариф уже выбран при создании.
            </p>
            <div className="upgrade-tiles order-hold-upgrades">
              <UpgradeTile
                icon="chart"
                tag="Макет"
                title="Таможенный расчёт"
                desc="Пошлина и НДС по этой заявке — в блоке «Платежи»."
                items={["Стоимость партии", "Пошлина и НДС", "CTA выключен"]}
                price="—"
                note="После кода"
                featured
                primary
                cta="Недоступно"
                onClick={holdClick}
              />
              <UpgradeTile
                icon="users"
                tag="Макет"
                title="Брокер под ключ"
                desc="Эксперт в очереди после оплаты тарифа."
                items={["Чат после оплаты", "SLA брокера", "CTA выключен"]}
                price="—"
                note="После оплаты"
                cta="Недоступно"
                onClick={holdClick}
              />
            </div>
          </div>

          <div className="order-svc order-hold-svc lbm-m-hide">
            <div className="go-tile svc ship">
              <div className="gt-ico">
                <Icon name="truck" />
              </div>
              <div className="gt-title">Перевозка</div>
              <div className="gt-sub">Только фуры и наземная доставка</div>
              <div className="gt-more">Скоро</div>
            </div>
            <div className="go-tile svc clear">
              <div className="gt-ico">
                <Icon name="shield" />
              </div>
              <div className="gt-title">Оформление</div>
              <div className="gt-sub">Декларация, платежи и выпуск груза</div>
              <div className="gt-more">Скоро</div>
            </div>
            <div className="go-tile svc turnkey">
              <div className="gt-ico">
                <Icon name="users" />
              </div>
              <div className="gt-title">Брокер под ключ</div>
              <div className="gt-sub">UI выбора · очередь после оплаты</div>
              <div className="gt-more">Скоро</div>
            </div>
          </div>

          {llmNotice && (
            <div className="alert-box warn-box" role="status">
              <strong>Тестовый режим · AI</strong>
              {llmNotice}
            </div>
          )}
          {selected.brokerComment && (
            <div className="card">
              <h3>Комментарий брокера</h3>
              <p className="whitespace-pre-wrap">{selected.brokerComment}</p>
            </div>
          )}
          {onFeedback && <OrderResultFeedback selected={selected} busy={busy} onSubmit={onFeedback} />}
        </div>

        <aside className="order-aside">
          <div className="card order-next">
            <h3>{nextTitle}</h3>
            <p className="meta" style={{ marginBottom: 14 }}>
              {payable
                ? "После оплаты заявка встанет в очередь брокера (D11), не «передать» вручную."
                : selected.status === "DONE"
                  ? "Код подтверждён. Скачайте PDF."
                  : "Статус и действия — живые /api/v1, не demo-store."}
            </p>
            {payable ? (
              <div style={{ display: "grid", gap: 8 }}>
                <PayMath balance={balance} amount={price} />
                <label className="field">
                  Предпочтительный брокер
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
                </label>
                <button type="button" className="btn btn-primary" disabled={busy || !canPay} onClick={onPay}>
                  Оплатить тариф {formatRub(price)}
                </button>
                {!canPay && onTopupThenPay ? (
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={onTopupThenPay}>
                    Пополнить до тарифа и оплатить
                  </button>
                ) : null}
              </div>
            ) : selected.status === "DONE" ? (
              <div style={{ display: "grid", gap: 8 }}>
                <a
                  className="btn btn-primary"
                  href={`/api/v1/calculations/${selected.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Скачать PDF с кодом
                </a>
              </div>
            ) : (
              <p className="meta" style={{ margin: 0 }}>
                {clientOrderNextStep({ status: selected.status, paidAt: selected.paidAt })}
              </p>
            )}
          </div>

          <div className="card">
            <h3>Платежи</h3>
            {hasCalc ? (
              <>
                <div className="pay-row">
                  <span>Пошлина</span>
                  <strong>{formatRub(selected.dutyRub)}</strong>
                </div>
                <div className="pay-row">
                  <span>НДС 22%</span>
                  <strong>{formatRub(selected.vatRub)}</strong>
                </div>
                <div className="pay-row">
                  <span>Сбор ПП 1637</span>
                  <strong>{formatRub(selected.feeRub)}</strong>
                </div>
                <div className="pay-row total">
                  <span>На таможне</span>
                  <strong>{formatRub(selected.totalPaymentsRub)}</strong>
                </div>
              </>
            ) : (
              <p className="meta" style={{ margin: 0 }}>
                Пошлина и НДС появятся с кодом.
              </p>
            )}
          </div>

          <div className="card order-broker">
            <h3>Брокер</h3>
            {brokerName !== "—" ? (
              <>
                <div className="order-broker-row">
                  <div className="photo">
                    <img src="/lbm-bro/assets/avatar-broker.svg" alt="" />
                  </div>
                  <div>
                    <strong>{brokerName}</strong>
                    <div className="meta">Очередь после оплаты · SLA live</div>
                  </div>
                </div>
              </>
            ) : (
              <p className="meta" style={{ marginBottom: 12 }}>
                Брокер появится после оплаты тарифа STANDARD/PRO (D11). EXPRESS — без очереди при high conf.
              </p>
            )}
            {children ? <div className="order-chat">{children}</div> : null}
          </div>

          <div className="card">
            <h3>События</h3>
            <div className="activity-list">
              <EventsTimeline calculationId={selected.id} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
