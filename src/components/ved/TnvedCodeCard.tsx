import type { TnvedCard } from "@/lib/ved/tnved";

function formatDuty(card: TnvedCard): string {
  const rate = card.rate;
  if (!rate || (rate.dutyPct == null && rate.dutyRubPerUnit == null)) {
    return "нет в источнике ЕТТ";
  }
  if (rate.dutyKind === "SPECIFIC" && rate.dutyRubPerUnit != null) {
    return `${rate.dutyRubPerUnit} ₽${rate.unit ? ` / ${rate.unit}` : ""}`;
  }
  if (rate.dutyPct != null) return `${rate.dutyPct} %`;
  return "нет в источнике ЕТТ";
}

/** Slide-over body: official HS name, tree, ETT rate, RF payments. D32 — not a new page. */
export function TnvedCodeCard({ card }: { card: TnvedCard }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-mono text-base font-bold text-[#0f172a]">{card.codeDisplay}</p>
        <p className="mt-1 whitespace-pre-wrap text-[#0f172a]">{card.titleRu}</p>
        {card.isLeaf ? (
          <p className="mt-1 text-[11px] font-medium text-[var(--kb-muted)]">Лист · 10 знаков</p>
        ) : (
          <p className="mt-1 text-[11px] font-medium text-[var(--kb-muted)]">Уровень {card.level}</p>
        )}
      </div>

      {card.ancestors.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kb-muted)]">
            Дерево
          </p>
          <ol className="mt-1 space-y-1">
            {card.ancestors.map((a) => (
              <li key={a.code} className="text-xs text-[#0f172a]">
                <span className="font-mono font-medium">{a.codeDisplay}</span>
                <span className="text-[var(--kb-muted)]"> — {a.titleRu}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="rounded-2xl bg-white p-3 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kb-muted)]">
          Платежи
        </p>
        <dl className="mt-2 space-y-1.5">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--kb-muted)]">Пошлина ЕТТ</dt>
            <dd className="text-right font-medium">{formatDuty(card)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--kb-muted)]">НДС</dt>
            <dd className="text-right font-medium">{card.paymentsHint.vatPct}%</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--kb-muted)]">Сбор</dt>
            <dd className="text-right font-medium">{card.paymentsHint.feeRule}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] text-[var(--kb-muted)]">
          НДС и сбор — канон РФ, не колонка классификатора. Акциз / утиль / НТМ — только
          триггер «возможно» по НПА, без ставки.
        </p>
      </div>

      {card.measuresHint.excisePossible ||
      card.measuresHint.utilSborPossible ||
      card.measuresHint.ntmPossible ? (
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kb-muted)]">
            Меры (триггер)
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[#0f172a]">
            {card.measuresHint.excisePossible ? <li>Акциз: возможно (НК РФ ст. 181)</li> : null}
            {card.measuresHint.utilSborPossible ? (
              <li>Утильсбор: возможно (ПП 1291 / 81 — нужны категория, возраст, мощность)</li>
            ) : null}
            {card.measuresHint.ntmPossible ? (
              <li>НТМ: возможно (сверить единый перечень ЕЭК)</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {card.notes ? (
        <p className="text-xs text-[var(--kb-muted)]">
          <span className="font-semibold text-[#0f172a]">Заметки: </span>
          {card.notes}
        </p>
      ) : null}

      <ul className="space-y-1 text-[11px] text-[var(--kb-muted)]">
        {card.sources.map((s) => (
          <li key={s.layer}>
            {s.layer}. {s.title}
            {s.asOf ? ` · ${s.asOf}` : ""}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-[var(--kb-muted)]">{card.disclaimer}</p>
    </div>
  );
}
