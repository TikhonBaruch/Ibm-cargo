import {
  fillEmptyProductAttrs,
  type ProductAttrs,
} from "../product-description";
import type { ClarificationQuestion, ClarifyAnswers, ClarifyOption } from "./types";

export function mergeSearchTokens(answers: ClarifyAnswers): string {
  return Object.values(answers)
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" ");
}

function findOption(questions: ClarificationQuestion[], qid: string, value: string): ClarifyOption | undefined {
  const q = questions.find((x) => x.id === qid);
  if (!q?.options?.length) return undefined;
  return q.options.find((o) => o.searchValue === value && o.id !== "custom");
}

function fallbackPatch(questionId: string, text: string): ProductAttrs | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (questionId === "composition" || questionId === "textile-material") {
    return { composition: t };
  }
  if (questionId === "upper" || questionId === "material" || questionId === "dishes-material") {
    return { material: t, extra: { [questionId]: t } };
  }
  if (questionId === "purpose" || questionId === "kind" || questionId === "garment") {
    return { purpose: t };
  }
  if (questionId === "brand" || questionId === "brand-model") {
    return { brand: t };
  }
  if (questionId === "specs" || questionId === "display-weight" || questionId === "power") {
    return { technicalSpecs: t };
  }
  if (questionId === "sole" || questionId === "knit-woven" || questionId === "color") {
    return { extra: { [questionId.replace("-", "_")]: t } };
  }
  return { extra: { [questionId]: t } };
}

/** Merge attrsPatch from answered chips (fill-empty only against `existing`). */
export function applyAttrsPatches(
  answers: ClarifyAnswers,
  questions: ClarificationQuestion[],
  existing?: ProductAttrs | null
): ProductAttrs | undefined {
  let patch: ProductAttrs = {};
  for (const [qid, raw] of Object.entries(answers)) {
    const text = (raw || "").trim();
    if (!text) continue;
    const opt = findOption(questions, qid, text);
    const fromOpt = opt?.attrsPatch;
    const piece = fromOpt || fallbackPatch(qid, text);
    if (!piece) continue;
    patch = fillEmptyProductAttrs(patch, piece) || patch;
    if (opt?.hsHint) {
      patch = fillEmptyProductAttrs(patch, { hsHint: opt.hsHint }) || patch;
    }
  }
  return fillEmptyProductAttrs(existing, patch);
}

/** Base description + clarify search tokens for HS ranking / search. */
export function buildEnrichedHsQuery(base: string, answers: ClarifyAnswers): string {
  const tokens = mergeSearchTokens(answers);
  const b = base.trim();
  if (!tokens) return b;
  if (!b) return tokens;
  return `${b} ${tokens}`.replace(/\s+/g, " ").trim();
}

/** Resolve one chip answer into attrs patch (for NewCalc single accept). */
export function patchForClarifyAnswer(
  question: ClarificationQuestion,
  value: string
): { searchValue: string; attrsPatch?: ProductAttrs; hsHint?: string } {
  const text = value.trim();
  const opt = question.options?.find((o) => o.searchValue === text && o.id !== "custom");
  return {
    searchValue: text,
    attrsPatch: opt?.attrsPatch || fallbackPatch(question.id, text),
    hsHint: opt?.hsHint,
  };
}
