/**
 * Family hint trees for fill-time clarify (C21 / C21b multi-step).
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
  isYogaMatQuery,
  isFinishedApparelQuery,
  isForkliftMachineQuery,
} from "./tnved-query-match";

export type HintTreeOption = {
  id: string;
  label: string;
  value: string;
  /** Digits-only heading; empty string = attrs-only step (no HS update). */
  hsHeading: string;
  why?: string;
  triggers?: string[];
  attrs?: Record<string, string>;
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
  /** Legacy single question (= steps[0] when steps omitted). */
  question?: HintTreeQuestion;
  /** C21b: purpose → composition (max 3). */
  steps?: HintTreeQuestion[];
};

type OverlayFile = { asOf?: string; packs: OverlayPack[] };

const overlay = overlayJson as OverlayFile;

const HS_DIGITS = /^\d{2,10}$/;

function scoreKeys(desc: string, keys: string[]) {
  let score = 0;
  for (const k of keys) {
    if (packTriggerMatches(desc, k)) {
      score += Math.min(normalizeTnvedQueryText(k).trim().length, 10);
    }
  }
  return score;
}

function normalizeOption(o: HintTreeOption): HintTreeOption {
  const hs = String(o.hsHeading ?? "").replace(/\D/g, "");
  return {
    id: o.id,
    label: o.label,
    value: o.value,
    hsHeading: hs,
    why: o.why,
    triggers: o.triggers,
    attrs: o.attrs,
  };
}

function normalizeQuestion(q: HintTreeQuestion): HintTreeQuestion {
  return {
    id: q.id,
    text: q.text,
    hint: q.hint,
    options: (q.options || []).map(normalizeOption),
  };
}

/** Resolve pack steps; legacy `question` becomes a single-step chain. */
export function packSteps(pack: OverlayPack | null | undefined): HintTreeQuestion[] {
  if (!pack) return [];
  if (pack.steps?.length) {
    return pack.steps.slice(0, 3).map(normalizeQuestion);
  }
  if (pack.question?.options?.length) {
    return [normalizeQuestion(pack.question)];
  }
  return [];
}

/** Primary question for search-extras / legacy callers. */
export function packPrimaryQuestion(pack: OverlayPack | null | undefined): HintTreeQuestion | null {
  const steps = packSteps(pack);
  return steps[0] || null;
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
  const yogaMat = isYogaMatQuery(text);
  const finishedApparel = isFinishedApparelQuery(text);
  let best: OverlayPack | null = null;
  let bestScore = 0;
  for (const pack of overlay.packs || []) {
    // Coverage P0: plant «молоко/йогурт» ≠ milk; «мышь» ≠ computers.
    if (plantDairy && pack.id === "milk") continue;
    if (plantDairy && pack.id === "pantry-sweet") continue;
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
    if (finishedApparel && pack.id === "textiles-raw") continue;
    if (wheelchair && pack.id === "baby-gear") continue;
    // Cov-P13: yoga mat ≠ rugs; wardrobe шкаф → bedroom-furniture (not seating furniture).
    if (yogaMat && pack.id === "rugs") continue;
    // Cov-P15: dishwasher ≠ tableware «посуда»; LED bulb ≠ furniture lamps.
    if (/посудомо/i.test(text) && pack.id === "tableware") continue;
    if (/(?:^|[^a-zа-я0-9])led(?:$|[^a-zа-я0-9])|светодиод|лампочк/i.test(text) && pack.id === "lamps") {
      continue;
    }
    // Clar-DB: погрузчик с АКБ ≠ batteries (8507); АКБ для погрузчика остаётся batteries.
    if (isForkliftMachineQuery(text) && pack.id === "batteries") continue;
    const score = scoreKeys(text, pack.triggers || []);
    if (score > bestScore) {
      best = pack;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Clarify chips for a description when a family pack matches (all steps). */
export function hintTreeQuestions(desc: string): HintTreeQuestion[] {
  return packSteps(matchHintPack(desc));
}

export function hintTreeSkipQuestionIds(desc: string): string[] {
  const pack = matchHintPack(desc);
  return pack?.skipQuestionIds ? [...pack.skipQuestionIds] : [];
}

export function hintTreeHeadingForAnswer(desc: string, questionId: string, answer: string): string | null {
  const pack = matchHintPack(desc);
  const step = packSteps(pack).find((q) => q.id === questionId);
  if (!step) return null;
  const ans = String(answer || "").trim();
  const hit = step.options.find((o) => o.value === ans || o.label === ans || o.id === ans);
  const hs = hit?.hsHeading || "";
  return HS_DIGITS.test(hs) ? hs : null;
}

/**
 * Best hsHint from answered pack steps: longest digit heading wins
 * (e.g. 900410 over 9004). Same length → later step wins (composition can fork).
 */
export function hintTreeBestHeading(
  desc: string,
  answers: Record<string, string>,
): string | null {
  let best: string | null = null;
  for (const q of packSteps(matchHintPack(desc))) {
    const ans = String(answers[q.id] || "").trim();
    if (!ans) continue;
    const hit = q.options.find((o) => o.value === ans || o.label === ans || o.id === ans);
    const hs = hit?.hsHeading || "";
    if (!HS_DIGITS.test(hs)) continue;
    if (!best || hs.length > best.length || hs.length === best.length) best = hs;
  }
  return best;
}

export function hintTreesAsSearchExtras(): Map<string, { why: string[]; tokens: string[] }> {
  const out = new Map<string, { why: string[]; tokens: string[] }>();
  const add = (code: string, tokens: string[]) => {
    const digits = String(code || "").replace(/\D/g, "");
    if (!HS_DIGITS.test(digits)) return;
    const row = out.get(digits) || { why: [], tokens: [] };
    row.tokens.push(...tokens);
    out.set(digits, row);
  };
  for (const pack of overlay.packs || []) {
    for (const step of packSteps(pack)) {
      for (const o of step.options) {
        add(o.hsHeading, [o.label, o.value, ...(o.triggers || []), ...(pack.triggers || [])]);
      }
    }
  }
  return out;
}

export function hintTreeFocusCodes(): string[] {
  const codes = new Set<string>();
  for (const pack of overlay.packs || []) {
    for (const step of packSteps(pack)) {
      for (const o of step.options) {
        const digits = String(o.hsHeading || "").replace(/\D/g, "");
        if (HS_DIGITS.test(digits)) codes.add(digits);
      }
    }
  }
  return [...codes];
}

export const TNVED_HINT_TREES_AS_OF = overlay.asOf || "2026-08-28";
