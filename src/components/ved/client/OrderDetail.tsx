"use client";

import { StatusPill } from "../VedShell";
import { EventsTimeline } from "../EventsTimeline";
import { LandedWithoutFreightCard } from "../LandedWithoutFreightCard";
import { OrderResultFeedback } from "./OrderResultFeedback";
import type { Broker, Calc, ClientFeedbackReaction, Me } from "./types";
import { landedFromAiDraft } from "@/lib/ved/landed-cost";
import { formatTestModeLlmNotice } from "@/lib/ved/ai-drain-retry";
import { isAiDrainPending } from "@/lib/ved/ai-drain-client";

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

  return (
    <div
      className={
        embedded
          ? "space-y-4 rounded-[24px] border border-black/[0.04] bg-white p-4 shadow-sm sm:p-5"
          : "mt-6 space-y-4 rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-sm"
      }
    >
      {!embedded && (
        <h2 className="text-lg font-semibold">
          {selected.number} · {selected.title}
        </h2>
      )}
      {embedded && (
        <h2 className="text-base font-semibold text-[#0f172a]">
          {selected.number} · {selected.title}
        </h2>
      )}
      {(selected.description || selected.country || selected.shipmentValue) && (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-[#0f172a]">
          {selected.description && <p className="whitespace-pre-wrap">{selected.description}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#7a7f89]">
            {selected.country && <span>Страна: {selected.country}</span>}
            {selected.shipmentValue && <span>Стоимость партии: {selected.shipmentValue}</span>}
          </div>
        </div>
      )}
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          ТН ВЭД: <strong>{selected.hsCodeFinal || selected.hsCode || "—"}</strong>
        </div>
        <div>
          Confidence: {conf != null ? `${Math.round(conf * 100)}%` : "—"}
        </div>
        {!landedFromAiDraft(selected.aiDraft) && (
          <>
            <div>Пошлина: {(selected.dutyRub ?? 0).toLocaleString("ru-RU")} ₽</div>
            <div>НДС: {(selected.vatRub ?? 0).toLocaleString("ru-RU")} ₽</div>
            <div>Сбор: {(selected.feeRub ?? 0).toLocaleString("ru-RU")} ₽</div>
            {(selected.extraFeeRub ?? 0) > 0 && (
              <div>
                Прочие сборы: {(selected.extraFeeRub ?? 0).toLocaleString("ru-RU")} ₽
                {selected.extraFeeNote ? ` · ${selected.extraFeeNote}` : ""}
              </div>
            )}
            <div>
              Итого платежей:{" "}
              <strong>{(selected.totalPaymentsRub ?? 0).toLocaleString("ru-RU")} ₽</strong>
            </div>
          </>
        )}
        <div>
          Тариф: {selected.tariff?.name} · {price.toLocaleString("ru-RU")} ₽
        </div>
        <div>
          <StatusPill status={selected.status} />
          {selected.preferredBrokerUserId && (
            <span className="ml-2 text-xs text-[#2b72f4]">preferred broker</span>
          )}
        </div>
      </div>
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
            className="rounded-full bg-[#2b72f4] px-4 py-2 text-xs font-semibold text-white"
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
        <div className="overflow-x-auto text-sm">
          <div className="mb-2 font-medium">Позиции</div>
          <table className="w-full text-left">
            <thead className="text-[#7a7f89]">
              <tr>
                <th className="py-1 pr-2">Название</th>
                <th className="py-1 pr-2">Attrs</th>
                <th className="py-1 pr-2">ТН ВЭД AI</th>
                <th className="py-1 pr-2">Финальный</th>
                <th className="py-1">Файл</th>
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
                      a.netWeightKg != null && `${a.netWeightKg} кг`,
                      a.hsHint && `hint: ${a.hsHint}`,
                    ].filter(Boolean)
                  : [];
                return (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="py-1 pr-2">
                      <div>{it.name}</div>
                      {it.description && (
                        <p className="mt-0.5 text-xs text-[#7a7f89]">
                          Как описал брокер: {it.description}
                        </p>
                      )}
                    </td>
                    <td className="max-w-[12rem] py-1 pr-2 text-xs text-[var(--kb-muted)]">
                      {attrBits.length ? attrBits.join(" · ") : "—"}
                    </td>
                    <td className="py-1 pr-2">{it.hsCodeAi || "—"}</td>
                    <td className="py-1 pr-2">{it.hsCodeFinal || "—"}</td>
                    <td className="py-1">
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
      )}

      <div>
        <div className="mb-2 text-sm font-medium">История</div>
        <EventsTimeline calculationId={selected.id} />
      </div>

      {payable && (
        <div className="space-y-2">
          <div
            className={`rounded-2xl px-3 py-2 text-sm ${
              canPay ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
            }`}
          >
            Баланс {balance.toLocaleString("ru-RU")} ₽ · тариф {price.toLocaleString("ru-RU")} ₽ —{" "}
            {canPay ? "хватает" : "не хватает"}
          </div>
          <label className="block text-sm">
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !canPay}
              onClick={onPay}
              className="rounded-full bg-[#2b72f4] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Оплатить тариф и продолжить
            </button>
            {!canPay && onTopupThenPay && (
              <button
                type="button"
                disabled={busy}
                onClick={onTopupThenPay}
                className="rounded-full border px-5 py-2.5 text-sm font-semibold"
              >
                Пополнить до тарифа и оплатить
              </button>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
