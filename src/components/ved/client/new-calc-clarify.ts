import { EMPTY_WIZARD, type WizardDraft } from "@/lbm-bro/lib/types";
import type { ClarificationQuestion } from "@/lbm-bro/lib/clarify-ai";

export type ClarifyPart = { id: string; text: string; answer: string };

/** Live single-item draft for lab `getClarificationQuestions({ wizard, step: 1 })`. */
export function wizardDraftForClarify(desc: string, country: string): WizardDraft {
  return {
    ...EMPTY_WIZARD,
    desc,
    country: country || "Китай",
    docs: [],
    packMode: "single",
  };
}

export function unansweredClarifyParts(
  questions: ClarificationQuestion[],
  answers: Record<string, string>,
  appliedIds: string[],
): ClarifyPart[] {
  return questions
    .map((q) => ({
      id: q.id,
      text: q.text,
      answer: (answers[q.id] || "").trim(),
    }))
    .filter((p) => p.answer && !appliedIds.includes(p.id));
}

/** Lab apply: append labeled answers into the product description. */
export function appendClarifyBlock(desc: string, parts: ClarifyPart[]): string {
  if (!parts.length) return desc;
  const block = parts
    .map((p, i) => `${i + 1}) ${p.text}\nОтвет: ${p.answer}`)
    .join("\n\n");
  return `${desc.trim()}\n\nУточнения (ИИ):\n${block}`;
}

/** Prefer the composition chip so create still sends origin + composition. */
export function compositionFromClarify(
  answers: Record<string, string>,
  fallback: string,
): string {
  const fromQ = answers.composition?.trim();
  if (fromQ) return fromQ;
  return fallback.trim();
}

/** Draft HS heading from a family-pack chip. Not hsCodeFinal (D15). */
export function hsHintFromClarify(
  questions: ClarificationQuestion[],
  answers: Record<string, string>,
): string | undefined {
  for (const q of questions) {
    const ans = (answers[q.id] || "").trim();
    if (!ans) continue;
    const hit = q.options?.find((o) => o.value === ans || o.label === ans);
    const hs = hit?.hsHeading?.replace(/\D/g, "");
    if (hs && [2, 4, 6, 8, 10].includes(hs.length)) return hs;
  }
  return undefined;
}
