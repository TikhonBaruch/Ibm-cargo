"use client";

import type { HeuristicHsCandidate } from "@/lib/ved/ai-draft-engine";

/** D32: suggestion list (not LLM CTA). Click fills hsHint on the first position. */
export function HsHintCandidates({
  candidates,
  selectedHs,
  onPick,
}: {
  candidates: HeuristicHsCandidate[];
  selectedHs?: string;
  onPick: (hsCode: string) => void;
}) {
  if (!candidates.length) return null;
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-[#0f172a]">Черновик ТН ВЭД по правилам</p>
      <p className="mt-0.5 text-[11px] text-[var(--kb-muted)]">
        Не нейросеть. Клик — подсказка в первую позицию без кода; финал — у брокера (D15).
      </p>
      <ul className="mt-2 space-y-1.5">
        {candidates.map((c) => {
          const active = selectedHs === c.hsCode;
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                  active
                    ? "border-[#2b72f4] bg-white shadow-[inset_3px_0_0_#2b72f4]"
                    : "border-transparent bg-white hover:border-slate-200"
                }`}
                onClick={() => onPick(c.hsCode)}
              >
                <span className="font-semibold text-[#0f172a]">{c.hsCode}</span>
                <span className="ml-2 text-[var(--kb-muted)]">
                  {Math.round(c.confidence * 100)}%
                </span>
                <p className="mt-0.5 text-[11px] text-[var(--kb-muted)]">{c.why}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
