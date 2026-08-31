import type { TnvedCard } from "@/lib/ved/tnved";
import { formatHsCode } from "@/lib/ved/tnved";
import { formatCardDutyLabel } from "@/lib/ved/tnved-card-layers";
import { TNVED_RELATION_KIND_LABEL, type TnvedRelationKind } from "@/lib/ved/tnved-relations";

function formatDuty(card: TnvedCard): string {
  return formatCardDutyLabel(card.rate);
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

      {(card.children || []).length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kb-muted)]">
            Внутри позиции
          </p>
          <ul className="mt-1 space-y-1">
            {(card.children || []).map((c) => (
              <li key={c.code} className="text-xs text-[#0f172a]">
                <span className="font-mono font-medium">{c.codeDisplay}</span>
                <span className="text-[var(--kb-muted)]"> — {c.titleRu}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(card.related || []).length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kb-muted)]">
            Связанные коды
          </p>
          <ul className="mt-1 space-y-2">
            {(card.related || []).map((rel) => (
              <li key={`${rel.kind}-${rel.code}`} className="text-xs text-[#0f172a]">
                <span className="font-medium text-[var(--kb-muted)]">
                  {TNVED_RELATION_KIND_LABEL[rel.kind as TnvedRelationKind] || rel.kind}
                  {": "}
                </span>
                <span className="font-mono font-medium">{formatHsCode(rel.code) || rel.code}</span>
                <span className="text-[var(--kb-muted)]"> — {rel.why}</span>
              </li>
            ))}
          </ul>
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
          НДС и сбор — канон РФ, не колонка классификатора. «нет в НСИ» — нет официальной ставки
          СТНВЭДСТ; fill TWS не выдаём за НСИ. Акциз / утиль / НТМ — только триггер «возможно».
        </p>
      </div>

      {card.explanation ? (
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kb-muted)]">
            Пояснения ЕЭК (PSN)
          </p>
          <p className="mt-1 text-xs font-medium text-[#0f172a]">{card.explanation.heading}</p>
          <p className="mt-1 text-xs text-[var(--kb-muted)]">{card.explanation.excerpt}</p>
          {card.explanation.url ? (
            <a
              className="mt-2 inline-block text-[11px] text-[#2b72f4]"
              href={card.explanation.url}
              target="_blank"
              rel="noreferrer"
            >
              Полный текст на сайте ЕЭК
            </a>
          ) : null}
        </div>
      ) : null}

      {(card.classificationDecisions || []).length > 0 ? (
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kb-muted)]">
            Решения ЕЭК о классификации
          </p>
          <ul className="mt-2 space-y-1.5">
            {card.classificationDecisions.map((d) => (
              <li key={`${d.code}-${d.title}`} className="text-xs text-[#0f172a]">
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-[#2b72f4]">
                    {d.title}
                  </a>
                ) : (
                  d.title
                )}
                {d.asOf ? (
                  <span className="text-[var(--kb-muted)]"> · {d.asOf}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {card.measuresHint.excisePossible ||
      card.measuresHint.utilSborPossible ||
      card.measuresHint.ecoFeePossible ||
      card.measuresHint.ntmPossible ? (
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kb-muted)]">
            Меры (триггер)
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[#0f172a]">
            {card.measuresHint.excisePossible ? <li>Акциз: возможно (НК РФ ст. 181 — сверить вид товара)</li> : null}
            {card.measuresHint.utilSborPossible ? (
              <li>Утильсбор: возможно (ПП 1291 / 81 — нужны категория, возраст, мощность)</li>
            ) : null}
            {card.measuresHint.ecoFeePossible ? (
              <li>
                Экосбор РОП: возможно (ПП 2414 — товар и/или упаковка; не путать с утильсбором ТС)
              </li>
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
