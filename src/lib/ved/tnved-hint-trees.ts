/**
 * Family hint trees for fill-time clarify (C21).
 * JSON filename must not match this module (CJS would load the .json).
 */
import overlayJson from "./tnved-hint-tree-packs.json";
import {
  normalizeTnvedQueryText,
  packTriggerMatches,
  isPlantDairyQuery,
  isPointerDeviceQuery,
  isJuiceOrBeverageQuery,
  isPreparedMealQuery,
  isCoffeeMachineQuery,
  isCarSeatQuery,
  isLaundryDetergentQuery,
  isDairyFatQuery,
  isCookingOilQuery,
  isFishSeafoodQuery,
  isVegetableConservesQuery,
  isMotorOilQuery,
  isPcPartsQuery,
  isPhotoGearQuery,
  isVapeDeviceQuery,
  isGamingConsoleQuery,
  isAgriFeedQuery,
  isTextilesRawQuery,
  isWheelchairQuery,
} from "./tnved-query-match";

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

function scoreKeys(desc: string, keys: string[]) {
  let score = 0;
  for (const k of keys) {
    if (packTriggerMatches(desc, k)) {
      score += Math.min(normalizeTnvedQueryText(k).trim().length, 10);
    }
  }
  return score;
}

export function matchHintPack(desc: string): OverlayPack | null {
  const text = String(desc || "").trim();
  if (text.length < 3) return null;
  const plantDairy = isPlantDairyQuery(text);
  const pointer = isPointerDeviceQuery(text);
  const juice = isJuiceOrBeverageQuery(text);
  const preparedMeal = isPreparedMealQuery(text);
  const coffeeMachine = isCoffeeMachineQuery(text);
  const carSeat = isCarSeatQuery(text);
  const laundryDetergent = isLaundryDetergentQuery(text);
  const dairyFat = isDairyFatQuery(text);
  const cookingOil = isCookingOilQuery(text);
  const fishSeafood = isFishSeafoodQuery(text);
  const vegConserves = isVegetableConservesQuery(text);
  const motorOil = isMotorOilQuery(text);
  const pcParts = isPcPartsQuery(text);
  const photoGear = isPhotoGearQuery(text);
  const vapeDevice = isVapeDeviceQuery(text);
  const gamingConsole = isGamingConsoleQuery(text);
  const agriFeed = isAgriFeedQuery(text);
  const textilesRaw = isTextilesRawQuery(text);
  const wheelchair = isWheelchairQuery(text);
  let best: OverlayPack | null = null;
  let bestScore = 0;
  for (const pack of overlay.packs || []) {
    // Coverage P0: plant «молоко/йогурт» ≠ milk; «мышь» ≠ computers.
    if (plantDairy && pack.id === "milk") continue;
    if (pointer && pack.id === "computers") continue;
    // Coverage P2: сок ≠ fruit; суп ≠ produce (овощной суп → prepared-food).
    if (juice && pack.id === "fruit-fresh") continue;
    if (preparedMeal && pack.id === "produce-fresh") continue;
    if (preparedMeal && pack.id === "meat") continue;
    // Cov-P0 baseline: known WRONG steals.
    if (coffeeMachine && pack.id === "tea-coffee") continue;
    if (carSeat && pack.id === "furniture") continue;
    if (laundryDetergent && pack.id === "appliances") continue;
    // Cov-P7 food disambiguation.
    if (cookingOil && pack.id === "milk") continue;
    if (dairyFat && pack.id === "pantry-sweet") continue;
    if (fishSeafood && pack.id === "produce-fresh") continue;
    if (vegConserves && pack.id === "fish-seafood") continue;
    // Cov-P8 home/electronics/auto disambiguation.
    if (motorOil && (pack.id === "pantry-sweet" || pack.id === "milk")) continue;
    if (pcParts && pack.id === "computers") continue;
    if (photoGear && pack.id === "security-cam") continue;
    if (coffeeMachine && pack.id === "small-appliances" && /кофемаш/i.test(text)) continue;
    // Cov-P9 long-tail disambiguation.
    if (vapeDevice && pack.id === "tobacco") continue;
    if (gamingConsole && pack.id === "toys") continue;
    if (agriFeed && pack.id === "pet-food") continue;
    if (textilesRaw && (pack.id === "knit-top" || pack.id === "woven-apparel")) continue;
    if (wheelchair && pack.id === "baby-gear") continue;
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
