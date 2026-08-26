/**
 * Lab wizard clarify API — thin adapter over shared `@/lib/ved/clarify-hints`.
 */
import type { WizardDraft } from "./types";
import type { ClarificationQuestion as SharedQuestion, ClarifyOption as SharedOption } from "@/lib/ved/clarify-hints";
import {
  heuristicClarificationQuestions,
  normalizeQuestion as sharedNormalize,
} from "@/lib/ved/clarify-hints";

export type ClarifyOption = { id: string; label: string; value: string };

export type ClarificationQuestion = {
  id: string;
  text: string;
  required: boolean;
  hint?: string;
  kind?: "choice" | "text";
  options?: ClarifyOption[];
  allowCustom?: boolean;
};

type ClarifyInput = {
  wizard: WizardDraft;
  step: 1 | 2;
};

function toUiOption(o: SharedOption): ClarifyOption {
  return { id: o.id, label: o.label, value: o.searchValue };
}

function toUiQuestion(q: SharedQuestion): ClarificationQuestion {
  return {
    id: q.id,
    text: q.text,
    required: q.required,
    hint: q.hint,
    kind: q.kind,
    allowCustom: q.allowCustom,
    options: q.options?.map(toUiOption),
  };
}

export function normalizeQuestion(q: ClarificationQuestion): ClarificationQuestion {
  return toUiQuestion(
    sharedNormalize({
      ...q,
      options: q.options?.map((o) => ({ id: o.id, label: o.label, searchValue: o.value })),
    })
  );
}

/**
 * Returns clarifying questions for the wizard.
 * Optional NEXT_PUBLIC_AI_CLARIFY_URL; else shared heuristic map.
 */
export async function getClarificationQuestions({ wizard, step }: ClarifyInput): Promise<ClarificationQuestion[]> {
  const endpoint = process.env.NEXT_PUBLIC_AI_CLARIFY_URL;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step, wizard }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.questions)) {
          return (data.questions as ClarificationQuestion[]).map(normalizeQuestion);
        }
      }
    } catch {
      // Fall back to heuristics
    }
  }

  const hasDocs = Array.isArray(wizard.docs) && wizard.docs.length > 0;
  const qs = heuristicClarificationQuestions({
    desc: wizard.desc,
    step,
    hasDocs,
    includeDocsQuestion: true,
    includePriceQuestions: true,
    price: wizard.price,
    tariff: wizard.tariff,
  });
  return qs.map(toUiQuestion);
}

export type { SharedQuestion };
