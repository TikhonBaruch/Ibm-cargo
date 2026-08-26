"use client";

import { useMemo, useState } from "react";
import type { ClarificationQuestion } from "@/lib/ved/clarify-hints";
import { CUSTOM_OPTION_ID, patchForClarifyAnswer } from "@/lib/ved/clarify-hints";
import type { ProductAttrs } from "@/lib/ved/product-description";

type Props = {
  questions: ClarificationQuestion[];
  answers: Record<string, string>;
  onAnswers: (next: Record<string, string>) => void;
  /** Called when a chip is accepted — parent merges attrs fill-empty. */
  onAccept?: (patch: {
    questionId: string;
    searchValue: string;
    attrsPatch?: ProductAttrs;
    hsHint?: string;
  }) => void;
};

/**
 * D32 inline clarify chips (not a stepper). Shared map → searchTokens + attrsPatch.
 */
export function ClarifyHintsPanel({ questions, answers, onAnswers, onAccept }: Props) {
  const [customMode, setCustomMode] = useState<Record<string, boolean>>({});

  const visible = useMemo(
    () => questions.filter((q) => q.kind === "choice" || q.kind === "text"),
    [questions]
  );

  if (!visible.length) return null;

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700/80">
        Уточнения
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-sky-950/80">
        Выберите чипы — улучшат черновик ТН ВЭД и подставят пустые атрибуты.
      </p>
      <div className="mt-2 space-y-3">
        {visible.map((q) => {
          const value = answers[q.id] || "";
          const isChoice = q.kind === "choice" && q.options?.length;
          if (!isChoice) {
            return (
              <div key={q.id}>
                <p className="mb-1 text-[11px] font-medium text-slate-700">{q.text}</p>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm"
                  value={value}
                  placeholder={q.hint || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onAnswers({ ...answers, [q.id]: v });
                    if (v.trim()) {
                      const p = patchForClarifyAnswer(q, v);
                      onAccept?.({ questionId: q.id, ...p });
                    }
                  }}
                />
              </div>
            );
          }

          const matched = q.options!.find(
            (o) => o.id !== CUSTOM_OPTION_ID && o.searchValue === value
          );
          const custom = customMode[q.id] || Boolean(q.allowCustom && value && !matched);
          const activeId = matched?.id || (custom ? CUSTOM_OPTION_ID : "");

          return (
            <div key={q.id}>
              <p className="mb-1 text-[11px] font-medium text-slate-700">{q.text}</p>
              <div className="flex flex-wrap gap-1.5">
                {q.options!.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={
                      activeId === opt.id
                        ? "rounded-full border border-sky-600 bg-sky-700 px-2.5 py-1 text-[11px] font-medium text-white"
                        : "rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-[#0f172a] hover:border-sky-400"
                    }
                    onClick={() => {
                      if (opt.id === CUSTOM_OPTION_ID) {
                        setCustomMode((m) => ({ ...m, [q.id]: true }));
                        onAnswers({ ...answers, [q.id]: "" });
                        return;
                      }
                      setCustomMode((m) => ({ ...m, [q.id]: false }));
                      onAnswers({ ...answers, [q.id]: opt.searchValue });
                      const p = patchForClarifyAnswer(q, opt.searchValue);
                      onAccept?.({ questionId: q.id, ...p });
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {q.hint ? (
                <p className="mt-1 text-[10px] text-[var(--kb-muted)]">{q.hint}</p>
              ) : null}
              {q.allowCustom && custom ? (
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm"
                  value={value}
                  placeholder="Укажите свой вариант"
                  onChange={(e) => {
                    const v = e.target.value;
                    onAnswers({ ...answers, [q.id]: v });
                    if (v.trim()) {
                      const p = patchForClarifyAnswer(q, v);
                      onAccept?.({ questionId: q.id, ...p });
                    }
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
