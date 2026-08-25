/**
 * Heuristic draft engine (C3). Not an LLM — deterministic TN VED suggestions
 * for local/CI and for containers/ai until models are wired.
 * Rules: ./ai-draft-rules.json (shared with containers/ai).
 */
import rulesJson from "./ai-draft-rules.json";
import { DEFAULT_IMPORT_VAT_PERCENT, customsOperationsFeeRub } from "./customs-fees";

export type DraftEngineInput = {
  description: string;
  country?: string;
  title?: string;
  docs?: string[];
};

export type DraftEngineResult = {
  hsCode: string;
  duties: {
    customsDutyPercent: number;
    vatPercent: number;
    feeRub: number;
    note?: string;
  };
  documents: string[];
  confidence: number;
  disclaimer: string;
  inputPreview?: string;
  engine: "heuristic-v1";
};

type RuleRow = {
  id: string;
  test?: string;
  flags?: string;
  hsCode: string;
  duty: number;
  feeRub: number;
  confidence: number;
  why?: string;
  docs?: string[];
};

export type HeuristicHsCandidate = {
  id: string;
  hsCode: string;
  confidence: number;
  why: string;
};

const pack = rulesJson as {
  version: string;
  defaultDocs: string[];
  disclaimer: string;
  default: RuleRow;
  rules: RuleRow[];
};

const RULES = pack.rules.map((r) => ({
  ...r,
  re: new RegExp(r.test || ".*", r.flags || "i"),
}));

const FALLBACK_WHY: Record<string, string> = {
  laptop: "В тексте ноутбук / ПК — типичная глава 8471.",
  phone: "Смартфон / телефон — глава 8517.",
  textile: "Одежда / текстиль — глава 62.",
  auto: "Автозапчасти — глава 87.",
  chem: "Химия / краска — глава 32.",
  food: "Пищевые товары — глава 18 или смежная.",
  furniture: "Мебель — глава 94.",
  generic: "Точного правила нет — общий черновик, брокер уточнит код.",
};

function whyFor(rule: RuleRow): string {
  return rule.why || FALLBACK_WHY[rule.id] || `Правило «${rule.id}».`;
}

function countryBoost(country?: string): number {
  return country && /китай|china|cn\b/i.test(country) ? 0.03 : 0;
}

/** Top-N matching heuristic rules for client /new (M1.2). Not an LLM. */
export function rankHeuristicCandidates(
  input: DraftEngineInput,
  limit = 3
): HeuristicHsCandidate[] {
  const text = `${input.title || ""} ${input.description || ""}`.trim();
  const boost = countryBoost(input.country);
  const matched = RULES.filter((r) => r.re.test(text)).sort((a, b) => b.confidence - a.confidence);
  const out: HeuristicHsCandidate[] = [];
  const seen = new Set<string>();
  for (const r of matched) {
    if (seen.has(r.hsCode)) continue;
    seen.add(r.hsCode);
    out.push({
      id: r.id,
      hsCode: r.hsCode,
      confidence: Math.min(0.95, r.confidence + boost),
      why: whyFor(r),
    });
    if (out.length >= limit) return out;
  }
  if (out.length < limit && !seen.has(pack.default.hsCode)) {
    out.push({
      id: pack.default.id,
      hsCode: pack.default.hsCode,
      confidence: pack.default.confidence,
      why: whyFor(pack.default),
    });
  }
  return out.slice(0, limit);
}

export function buildHeuristicDraft(input: DraftEngineInput): DraftEngineResult {
  const text = `${input.title || ""} ${input.description || ""}`.trim();
  const matched = RULES.find((r) => r.re.test(text));
  const rule = matched || pack.default;
  const confidence = Math.min(0.95, rule.confidence + countryBoost(input.country));

  // Provisional fee at default demo value (18k USD × 90); create path recomputes via schedule.
  const provisionalCustomsValueRub = 18_000 * 90;
  return {
    hsCode: rule.hsCode,
    duties: {
      customsDutyPercent: rule.duty,
      vatPercent: DEFAULT_IMPORT_VAT_PERCENT,
      feeRub: customsOperationsFeeRub(provisionalCustomsValueRub),
      note: `${pack.version} · rule=${rule.id} · vat=${DEFAULT_IMPORT_VAT_PERCENT} · fee=PP1637`,
    },
    documents: rule.docs || pack.defaultDocs,
    confidence,
    disclaimer: pack.disclaimer,
    inputPreview: text.slice(0, 200),
    engine: "heuristic-v1",
  };
}
