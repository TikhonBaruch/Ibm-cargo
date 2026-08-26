"use client";

import { StatusPill } from "../VedShell";
import { EventsTimeline } from "../EventsTimeline";
import { LandedWithoutFreightCard } from "../LandedWithoutFreightCard";
import { OrderResultFeedback } from "./OrderResultFeedback";
import type { Broker, Calc, ClientFeedbackReaction, Me } from "./types";
import { originCountryRuLabel } from "@/lib/ved/field-suggest";
import { landedFromAiDraft } from "@/lib/ved/landed-cost";
import { commercialInvoiceUiEnabled } from "@/lib/ved/cabinet-features";
import { formatTestModeLlmNotice } from "@/lib/ved/ai-drain-retry";
import { isAiDrainPending } from "@/lib/ved/ai-drain-client";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import {
  clientOrderHsLabel,
  clientOrderStepper,
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
  embedded,
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
  /** Inside drawer/sheet — tighter chrome, no top margin. */
  embedded?: boolean;
  children?: React.ReactNode;
}) {
  const price = selected.tariff?.priceRub ?? 0;
  const balance = me?.company?.balanceRub ?? 0;
  const canPay = balance >= price;
  const payable =
    ["AI_READY", "AWAITING_PAYMENT"].includes(selected.status) && !selected.paidAt;
  const llmNotice = clientLlmSoftFailNotice(selected);
  const enrichPending = isAiDrainPending(selected);
  const conf =
    selected.confidence ??
    (typeof selected.aiDraft?.confidence === "number" ? selected.aiDraft.confidence : null);
  const stepper = clientOrderStepper({
    status: selected.status,
    tariffCode: selected.tariff?.code,
  });
  const hs = clientOrderHsLabel({
    hsCode: selected.hsCode,
    hsCodeFinal: selected.hsCodeFinal,
  });
  const cover = selected.items?.find((it) => it.mediaUrl)?.mediaUrl;
  const stepClass = stepper.labels.length === 3 ? "steps-3" : "steps-4";
  const originLabel = originCountryRuLabel(
    selected.country,
    selected.items?.[0]?.attrs?.originCountry,
  );

  return (
    <div className="order-full view-client" style={embedded ? undefined : { marginTop: 24 }}>
      <div className="order-full-top">
        <div>
          <span className="go-kicker">{selected.number}</span>
          <h2>{selected.title}</h2>
          {originLabel ? <div className="meta">Страна происхождения · {originLabel}</div> : null}
        </div>
        <StatusPill status={selected.status} />
      </div>
      <div className={`wiz-steps labeled ${stepClass}`}>
        {stepper.labels.map((lab, i) => (
          <button key={lab} type="button" className={wizardStepClass(i, stepper.current)} tabIndex={-1}>
            <b>{i + 1}</b>
            <span className="wiz-step-lab">{lab}</span>
          </button>
        ))}
      </div>
      <div className="order-full-grid">
        <div className="order-full-col">
          <div className={`order-hs${hs === "—" ? " empty" : ""}`}>
            <div className="order-hs-copy">
              <span className="gt-kicker">ТН ВЭД</span>
              <div className="order-hs-code">{hs}</div>
              {originLabel ? (
                <p className="meta" style={{ margin: "8px 0 0" }}>
                  Страна происхождения · {originLabel}
                </p>
              ) : null}
              <p>
                {selected.description ||
                  "Черновик кода с сервера. Финал подтверждает брокер; смета — НДС 22% и сбор ПП 1637, не цифры макета."}
              </p>
              <div className="order-hs-conf">
                Confidence: {conf != null ? `${Math.round(conf * 100)}%` : "—"}
              </div>
            </div>
            <div className="order-hs-media" aria-hidden>
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" />
              ) : null}
            </div>
          </div>
          {(selected.description || (commercialInvoiceUiEnabled() && selected.shipmentValue)) && (
            <div className="card" style={{ margin: "12px 0 0" }}>
              {selected.description && <p className="whitespace-pre-wrap">{selected.description}</p>}
              <div className="meta" style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
                {commercialInvoiceUiEnabled() && selected.shipmentValue ? (
                  <span>Стоимость партии: {selected.shipmentValue}</span>
                ) : null}
              </div>
            </div>
          )}
          {!landedFromAiDraft(selected.aiDraft) && (
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
          )}
          {(selected.extraFeeRub ?? 0) > 0 && !landedFromAiDraft(selected.aiDraft) ? (
            <p className="text-sm text-[var(--kb-muted)]">
              Прочие сборы: {formatRub(selected.extraFeeRub)}
              {selected.extraFeeNote ? ` · ${selected.extraFeeNote}` : ""}
            </p>
          ) : null}
          <p className="text-sm">
            Тариф: {selected.tariff?.name} · {formatRub(price)}
            {selected.preferredBrokerUserId ? (
              <span className="ml-2 text-xs text-[#2b72f4]">preferred broker</span>
            ) : null}
          </p>
          <LandedWithoutFreightCard calc={selected} />

          {enrichPending && (
            <div
              className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
              role="status"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-sky-800/80">
                Уточняем ТН ВЭД…
              </div>
              <p className="mt-1">
                Показан предварительный код. Точный ответ AI обычно приходит в течение 1–2 минут —
                карточка обновится сама.
              </p>
            </div>
          )}
          {!enrichPending && selected.aiDraft?.llmEnrich && (
            <p className="text-xs text-emerald-700">
              Код уточнён AI ({selected.aiDraft.llmEnrich}
              {selected.aiDraft.chainId != null ? ` · chain ${selected.aiDraft.chainId}` : ""}).
            </p>
          )}

          {llmNotice && (
            <div
              className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-amber-800/80">
                Тестовый режим · AI
              </div>
              <p className="mt-1">{llmNotice}</p>
            </div>
          )}

          {selected.brokerComment && (
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-[#7a7f89]">
                Комментарий брокера
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[#0f172a]">{selected.brokerComment}</p>
            </div>
          )}

          {selected.status === "DONE" && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
              <span className="font-medium">Просчёт готов — скачайте PDF</span>
              <a
                className="btn btn-primary btn-sm"
                href={`/api/v1/calculations/${selected.id}/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                Открыть PDF
              </a>
            </div>
          )}

          {onFeedback && (
            <OrderResultFeedback selected={selected} busy={busy} onSubmit={onFeedback} />
          )}

          {selected.items && selected.items.length > 0 && (
            <div className="card" style={{ margin: 0 }}>
              <h3>Позиции</h3>
              <div className="overflow-x-auto text-sm">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Attrs</th>
                      <th>ТН ВЭД AI</th>
                      <th>Финальный</th>
                      <th>Файл</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((it) => {
                      const a = it.attrs;
                      const pendingMfg = Boolean(a?.extra?.manufacturerProposalId);
                      const attrBits = a
                        ? [
                            a.manufacturerName &&
                              `производитель: ${a.manufacturerName}${pendingMfg ? " (ожидает админа)" : ""}`,
                            a.brand && `бренд: ${a.brand}`,
                            a.material && `мат.: ${a.material}`,
                            a.originCountry && `origin: ${a.originCountry}`,
                            commercialInvoiceUiEnabled() && a.netWeightKg != null && `${a.netWeightKg} кг`,
                            a.hsHint && `hint: ${a.hsHint}`,
                          ].filter(Boolean)
                        : [];
                      return (
                        <tr key={it.id}>
                          <td>
                            <div>{it.name}</div>
                            {it.description && (
                              <p className="mt-0.5 text-xs text-[#7a7f89]">
                                Как описал брокер: {it.description}
                              </p>
                            )}
                          </td>
                          <td className="max-w-[12rem] text-xs text-[var(--kb-muted)]">
                            {attrBits.length ? attrBits.join(" · ") : "—"}
                          </td>
                          <td>{it.hsCodeAi || "—"}</td>
                          <td>{it.hsCodeFinal || "—"}</td>
                          <td>
                            {it.mediaUrl ? (
                              <a className="text-[#2b72f4]" href={it.mediaUrl} target="_blank" rel="noreferrer">
                                файл
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card" style={{ margin: 0 }}>
            <h3>История</h3>
            <EventsTimeline calculationId={selected.id} />
          </div>
        </div>

        <aside className="order-aside">
          {payable && (
            <div className="card order-next" style={{ margin: 0 }}>
              <h3>Оплата тарифа</h3>
              <div
                className={`rounded-2xl px-3 py-2 text-sm ${
                  canPay ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                }`}
              >
                Баланс {balance.toLocaleString("ru-RU")} ₽ · тариф {price.toLocaleString("ru-RU")} ₽ —{" "}
                {canPay ? "хватает" : "не хватает"}
              </div>
              <label className="mt-3 block text-sm">
                Предпочтительный брокер (optional)
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
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
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !canPay}
                  onClick={onPay}
                  className="btn btn-primary"
                >
                  Оплатить тариф и продолжить
                </button>
                {!canPay && onTopupThenPay && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onTopupThenPay}
                    className="btn btn-ghost"
                  >
                    Пополнить до тарифа и оплатить
                  </button>
                )}
              </div>
            </div>
          )}
          <DesignerStub
            compact
            title="Апгрейд Код → Таможня → Под ключ"
            intent="На карточке заявки дизайнер ставил UpgradeTile: докупить расчёт платежей или брокера."
            gap="В LBM пакет фиксируется при создании (D10). Смена линейки с карточки не в domain."
          />
          <DesignerStub
            compact
            title="Честный знак и голос"
            intent="Маркировка в заявке и голосовые пузыри в чате."
            gap="Нет в domain MVP (D27) — чат текстовый."
          />
          {children}
        </aside>
      </div>
    </div>
  );
}
