/**
 * Family hint trees for fill-time clarify (C21).
 * JSON filename must not match this module (CJS would load the .json).
 */
import overlayJson from "./tnved-hint-tree-packs.json";

export type HintTreeOption = {
  id: string;
  label: string;
  value: string;
  hsHeading: string;
  why?: string;
  triggers?: string[];
};

export type HintTreeQuestion = {
  id: string;
  text: string;
  hint?: string;
  options: HintTreeOption[];
};

type OverlayPack = {
  id: string;
  triggers: string[];
  skipQuestionIds?: string[];
  question: HintTreeQuestion;
};

type OverlayFile = { asOf?: string; packs: OverlayPack[] };

const overlay = overlayJson as OverlayFile;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е");
}

function matches(desc: string, raw: string) {
  const q = normalize(desc);
  const p = normalize(raw).trim();
  if (!p) return false;
  if (p.length <= 3) {
    return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(p)}(?:$|[^a-zа-я0-9])`, "i").test(q);
  }
  return q.includes(p);
}

function scoreKeys(desc: string, keys: string[]) {
  let score = 0;
  for (const k of keys) {
    if (matches(desc, k)) score += Math.min(normalize(k).length, 10);
  }
  return score;
}

export function matchHintPack(desc: string): OverlayPack | null {
  const text = String(desc || "").trim();
  if (text.length < 3) return null;
  let best: OverlayPack | null = null;
  let bestScore = 0;
  for (const pack of overlay.packs || []) {
    const score = scoreKeys(text, pack.triggers || []);
    if (score > bestScore) {
      best = pack;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Clarify chips for a description when a family pack matches. */
export function hintTreeQuestions(desc: string): HintTreeQuestion[] {
  const pack = matchHintPack(desc);
  if (!pack) return [];
  const q = pack.question;
  if (!q?.options?.length) return [];
  return [
    {
      id: q.id,
      text: q.text,
      hint: q.hint,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        value: o.value,
        hsHeading: o.hsHeading,
        why: o.why,
      })),
    },
  ];
}

export function hintTreeSkipQuestionIds(desc: string): string[] {
  const pack = matchHintPack(desc);
  return pack?.skipQuestionIds ? [...pack.skipQuestionIds] : [];
}

export function hintTreeHeadingForAnswer(desc: string, questionId: string, answer: string): string | null {
  const pack = matchHintPack(desc);
  if (!pack || pack.question.id !== questionId) return null;
  const ans = String(answer || "").trim();
  const hit = pack.question.options.find((o) => o.value === ans || o.label === ans || o.id === ans);
  return hit?.hsHeading || null;
}

export function hintTreesAsSearchExtras(): Map<string, { why: string[]; tokens: string[] }> {
  const out = new Map<string, { why: string[]; tokens: string[] }>();
  const add = (code: string, tokens: string[]) => {
    const digits = String(code || "").replace(/\D/g, "");
    if (![2, 4, 6, 8, 10].includes(digits.length)) return;
    const row = out.get(digits) || { why: [], tokens: [] };
    row.tokens.push(...tokens);
    out.set(digits, row);
  };
  for (const pack of overlay.packs || []) {
    for (const o of pack.question.options || []) {
      add(o.hsHeading, [o.label, o.value, ...(o.triggers || []), ...(pack.triggers || [])]);
    }
  }
  return out;
}

export function hintTreeFocusCodes(): string[] {
  const codes = new Set<string>();
  for (const pack of overlay.packs || []) {
    for (const o of pack.question.options || []) {
      const digits = String(o.hsHeading || "").replace(/\D/g, "");
      if ([2, 4, 6, 8, 10].includes(digits.length)) codes.add(digits);
    }
  }
  return [...codes];
}

export const TNVED_HINT_TREES_AS_OF = overlay.asOf || "2026-08-28";
