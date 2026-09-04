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

/** Draft HS heading from family-pack chips. Prefer longest digits; same length → later step (D15: not final). */
export function hsHintFromClarify(
  questions: ClarificationQuestion[],
  answers: Record<string, string>,
): string | undefined {
  let best: string | undefined;
  for (const q of questions) {
    const ans = (answers[q.id] || "").trim();
    if (!ans) continue;
    const hit = q.options?.find((o) => o.value === ans || o.label === ans || o.id === ans);
    const hs = hit?.hsHeading?.replace(/\D/g, "") || "";
    if (!hs || ![2, 4, 6, 8, 10].includes(hs.length)) continue;
    if (!best || hs.length > best.length || hs.length === best.length) best = hs;
  }
  return best;
}

/**
 * C21b F4: reveal pack steps one-by-one (purpose → composition).
 * Non-pack questions (docs, residual category) stay visible alongside the current step.
 */
export function progressiveClarifyQuestions(
  questions: ClarificationQuestion[],
  answers: Record<string, string>,
  packStepIds: string[],
): ClarificationQuestion[] {
  if (!packStepIds.length) return questions;
  const packSet = new Set(packStepIds);
  const revealed = new Set<string>();
  for (const id of packStepIds) {
    revealed.add(id);
    if (!(answers[id] || "").trim()) break;
  }
  return questions.filter((q) => !packSet.has(q.id) || revealed.has(q.id));
}
