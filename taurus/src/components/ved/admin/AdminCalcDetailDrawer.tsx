"use client";

import { VedDetailDrawer } from "../VedDetailDrawer";
import { StatusPill } from "../VedShell";
import { EventsTimeline } from "../EventsTimeline";
import { LandedWithoutFreightCard } from "../LandedWithoutFreightCard";
import type { AdminBrokerRow, AdminCalc } from "./types";

export function AdminCalcDetailDrawer({
  calc,
  assignBrokerId,
  busy,
  onClose,
  onAssign,
  onEscalate,
}: {
  calc: AdminCalc;
  assignBrokerId: string;
  busy: boolean;
  onClose: () => void;
  onAssign: (calcId: string, brokerUserId: string) => void;
  onEscalate: (calcId: string) => void;
}) {
  return (
    <VedDetailDrawer
      open
      title={`${calc.number} · ${calc.title}`}
      subtitle="Админ · заявка"
      onClose={onClose}
    >
      <div className="space-y-4 rounded-[24px] border border-black/[0.04] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm text-[var(--kb-muted)]">
              {calc.company?.name || calc.clientUser?.name} · брокер {calc.brokerUser?.name || "—"} · тариф{" "}
              {calc.tariff?.name || "—"}
            </p>
            {(calc.description || calc.country || calc.shipmentValue) && (
              <div className="mt-2 max-w-2xl rounded-2xl bg-slate-50 px-3 py-2 text-sm text-[#0f172a]">
                {calc.description && <p className="whitespace-pre-wrap">{calc.description}</p>}
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--kb-muted)]">
                  {calc.country && <span>Страна: {calc.country}</span>}
                  {calc.shipmentValue && <span>Партия: {calc.shipmentValue}</span>}
                </div>
              </div>
            )}
            {calc.brokerComment && (
              <p className="mt-2 text-sm text-[var(--kb-muted)]">Комментарий брокера: {calc.brokerComment}</p>
            )}
            {(calc.extraFeeRub ?? 0) > 0 && (
              <p className="mt-2 text-sm text-[var(--kb-muted)]">
                Прочие сборы: {(calc.extraFeeRub ?? 0).toLocaleString("ru-RU")} ₽
                {calc.extraFeeNote ? ` · ${calc.extraFeeNote}` : ""}
              </p>
            )}
            <div className="mt-3">
              <LandedWithoutFreightCard calc={calc} compact />
            </div>
          </div>
          <StatusPill status={calc.status} />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {assignBrokerId && ["QUEUED", "SLA_RISK", "IN_REVIEW"].includes(calc.status) && (
            <button
              type="button"
              disabled={busy}
              className="rounded-full bg-[#2b72f4] px-3 py-1.5 font-semibold text-white disabled:opacity-50"
              onClick={() => onAssign(calc.id, assignBrokerId)}
            >
              Назначить
            </button>
          )}
          {["QUEUED", "IN_REVIEW"].includes(calc.status) && (
            <button
              type="button"
              disabled={busy}
              className="rounded-full border border-red-200 px-3 py-1.5 text-red-600 disabled:opacity-50"
              onClick={() => onEscalate(calc.id)}
            >
              Эскалировать
            </button>
          )}
        </div>
        <ul className="space-y-1 text-sm">
          {calc.items?.map((it) => {
            const a = it.attrs;
            const attrBits = a
              ? [
                  a.brand && `бренд: ${a.brand}`,
                  a.material && `мат.: ${a.material}`,
                  a.originCountry && `origin: ${a.originCountry}`,
                  a.netWeightKg != null && `${a.netWeightKg} кг`,
                  a.hsHint && `hint: ${a.hsHint}`,
                ].filter(Boolean)
              : [];
            return (
              <li key={it.id} className="rounded-xl bg-slate-50 px-3 py-2">
                <div>
                  {it.name} · AI {it.hsCodeAi || "—"} · final {it.hsCodeFinal || "—"}
                </div>
                {attrBits.length > 0 && (
                  <div className="mt-0.5 text-xs text-[var(--kb-muted)]">{attrBits.join(" · ")}</div>
                )}
              </li>
            );
          })}
        </ul>
        <div>
          <div className="mb-2 text-sm font-medium">История</div>
          <EventsTimeline calculationId={calc.id} />
        </div>
        {Boolean(calc.hasPdf || calc.pdfHtml) && (
          <p className="text-sm">
            <a
              href={`/api/v1/calculations/${calc.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#2b72f4] underline-offset-2 hover:underline"
            >
              Открыть PDF / HTML-отчёт
            </a>
          </p>
        )}
      </div>
    </VedDetailDrawer>
  );
}

/** Approved brokers first; fallback to all for assign dropdown. */
export function assignBrokerOptions(brokers: AdminBrokerRow[]) {
  const approved = brokers.filter((b) => b.moderationStatus === "APPROVED");
  return approved.length > 0 ? approved : brokers;
}
