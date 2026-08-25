"use client";

import type { SimilarPrecedent } from "./types";

/** Show approved similar HS when LLM/heuristic may be wrong. */
export function BrokerSimilarPrecedents({
  items,
  aiHs,
  onPickHs,
}: {
  items?: SimilarPrecedent[] | null;
  aiHs?: string | null;
  onPickHs?: (hs: string) => void;
}) {
  if (!items?.length) return null;
  const mismatch = items.some(
    (p) => aiHs && p.hsCode.replace(/\s/g, "") !== String(aiHs).replace(/\s/g, "")
  );
  return (
    <div
      className={`rounded-2xl border px-3 py-3 text-sm ${
        mismatch ? "border-amber-100 bg-amber-50/80" : "border-slate-100 bg-slate-50"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#7a7f89]">
        Похожие утверждённые коды
      </p>
      <p className="mt-1 text-[11px] text-[#7a7f89]">
        Не подмена AI. Если черновик LLM расходится — сверьте с этими кейсами.
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="w-full rounded-xl border border-transparent bg-white px-3 py-2 text-left text-xs hover:border-slate-200"
              onClick={() => onPickHs?.(p.hsCode)}
            >
              <span className="font-semibold text-[#0f172a]">{p.hsCode}</span>
              {p.quality === "CLIENT_HELPFUL" ? (
                <span className="ml-2 text-[10px] font-medium text-emerald-700">клиент 👍</span>
              ) : null}
              <p className="mt-0.5 text-[11px] text-[var(--kb-muted)]">{p.canonicalText}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
