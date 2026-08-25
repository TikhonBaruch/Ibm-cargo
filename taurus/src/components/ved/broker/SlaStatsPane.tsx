"use client";

import type { Calc } from "./types";

function hoursBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / 3600_000;
}

export function SlaStatsPane({ mine, queue }: { mine: Calc[]; queue: Calc[] }) {
  const done = mine.filter((x) => x.status === "DONE");
  const inReview = mine.filter((x) => x.status === "IN_REVIEW");
  const risk = [...queue, ...mine].filter((x) => x.status === "SLA_RISK");

  let hsDelta = 0;
  let itemsChecked = 0;
  for (const c of done) {
    for (const it of c.items || []) {
      itemsChecked += 1;
      if (it.hsCodeAi && it.hsCodeFinal && it.hsCodeAi !== it.hsCodeFinal) hsDelta += 1;
    }
  }

  const responseHours = done
    .map((c) => hoursBetween(c.claimedAt, c.doneAt))
    .filter((h): h is number => h != null);
  const avgResponseH =
    responseHours.length > 0
      ? responseHours.reduce((s, h) => s + h, 0) / responseHours.length
      : null;

  const onTime = done.filter((c) => {
    if (!c.doneAt || !c.slaDeadline) return false;
    return new Date(c.doneAt).getTime() <= new Date(c.slaDeadline).getTime();
  }).length;
  const onTimePct = done.length > 0 ? Math.round((onTime / done.length) * 100) : null;

  const correctedPct =
    itemsChecked > 0 ? Math.round((hsDelta / itemsChecked) * 100) : 0;
  const acceptedPct = itemsChecked > 0 ? 100 - correctedPct : 0;

  const avgConf =
    done.filter((c) => c.confidence != null).length > 0
      ? done
          .filter((c) => c.confidence != null)
          .reduce((s, c) => s + (c.confidence || 0), 0) /
        done.filter((c) => c.confidence != null).length
      : null;

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="text-sm text-[var(--kb-muted)]">Средний SLA</div>
          <div className="text-3xl font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
            {avgResponseH != null ? `${avgResponseH.toFixed(1)} ч` : "—"}
          </div>
          {avgResponseH != null && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#2b72f4]"
                style={{ width: `${Math.min(100, Math.round((avgResponseH / 4) * 100))}%` }}
                title="Относительно целевых 4 ч"
              />
            </div>
          )}
        </div>
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="text-sm text-[var(--kb-muted)]">Заявок в срок</div>
          <div className="text-3xl font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
            {onTimePct != null ? `${onTimePct}%` : "—"}
          </div>
          {onTimePct != null && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${onTimePct}%` }}
              />
            </div>
          )}
        </div>
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="text-sm text-[var(--kb-muted)]">В работе</div>
          <div className="text-3xl font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
            {inReview.length}
          </div>
        </div>
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="text-sm text-[var(--kb-muted)]">Закрыто</div>
          <div className="text-3xl font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
            {done.length}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="text-sm text-[var(--kb-muted)]">SLA risk</div>
          <div className="text-3xl font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
            {risk.length}
          </div>
        </div>
        <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="text-sm text-[var(--kb-muted)]">HS AI≠broker</div>
          <div className="text-3xl font-bold" style={{ fontFamily: "var(--kb-font-display)" }}>
            {hsDelta}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
        <h3 className="mb-2 font-semibold" style={{ fontFamily: "var(--kb-font-display)" }}>
          Качество AI vs ваши правки
        </h3>
        <p className="mb-4 text-sm text-[var(--kb-muted)]">
          {itemsChecked > 0
            ? `По закрытым заявкам скорректирован код ТН ВЭД в ${correctedPct}% позиций.${
                avgConf != null
                  ? ` Средняя уверенность AI на закрытых — ${Math.round(avgConf * 100)}%.`
                  : ""
              }`
            : "Нет закрытых заявок с позициями для сравнения AI ↔ брокер."}
        </p>
        {itemsChecked > 0 && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <span>Принято без правок HS</span>
              <strong>{acceptedPct}%</strong>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#2b72f4]"
                style={{ width: `${acceptedPct}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <span>Скорректировано вами</span>
              <strong>{correctedPct}%</strong>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${correctedPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
