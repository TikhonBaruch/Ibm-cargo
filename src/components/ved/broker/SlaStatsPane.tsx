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
    <section>
      <div className="stats">
        <div className="stat">
          <div className="v">{avgResponseH != null ? `${avgResponseH.toFixed(1)} ч` : "—"}</div>
          <div className="k">Средний SLA</div>
        </div>
        <div className="stat">
          <div className="v">{onTimePct != null ? `${onTimePct}%` : "—"}</div>
          <div className="k">Заявок в срок</div>
        </div>
        <div className="stat">
          <div className="v">{inReview.length}</div>
          <div className="k">В работе</div>
        </div>
        <div className="stat">
          <div className="v">{done.length}</div>
          <div className="k">Закрыто</div>
        </div>
      </div>
      {risk.length > 0 ? (
        <div className="alert-box warn-box">
          <strong>SLA risk: {risk.length}</strong>
          Заявки с риском срока — в очереди или в работе. Не выдуманный 3.1 ч / 96% из макета.
        </div>
      ) : null}
      <div className="card">
        <h3>Качество AI vs ваши правки</h3>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>
          {itemsChecked > 0
            ? `По закрытым заявкам скорректирован код ТН ВЭД в ${correctedPct}% позиций.${
                avgConf != null
                  ? ` Средняя уверенность AI на закрытых — ${Math.round(avgConf * 100)}%.`
                  : ""
              } HS AI≠broker: ${hsDelta}.`
            : "Нет закрытых заявок с позициями для сравнения AI ↔ брокер."}
        </p>
        {itemsChecked > 0 && (
          <div className="breakdown">
            <div>
              <span>Принято без правок HS</span>
              <strong>{acceptedPct}%</strong>
            </div>
            <div className="progress-line">
              <i style={{ width: `${acceptedPct}%` }} />
            </div>
            <div style={{ marginTop: 10 }}>
              <span>Скорректировано вами</span>
              <strong>{correctedPct}%</strong>
            </div>
            <div className="progress-line">
              <i style={{ width: `${correctedPct}%`, background: "linear-gradient(90deg,#c2410c,#f59e0b)" }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
