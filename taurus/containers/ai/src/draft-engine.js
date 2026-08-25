/**
 * Heuristic draft engine (C3) — loads shared rules from src/lib/ved/ai-draft-rules.json.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_IMPORT_VAT_PERCENT, customsOperationsFeeFromUsd } from "./customs-fees.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, "../../../src/lib/ved/ai-draft-rules.json"), // monorepo: containers/ai/src
  path.resolve(here, "./ai-draft-rules.json"), // docker image copy next to engine
  path.resolve(here, "../shared/ai-draft-rules.json"),
];

function loadPack() {
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      /* try next */
    }
  }
  throw new Error("ai-draft-rules.json not found (shared heuristic rules)");
}

const pack = loadPack();
const RULES = (pack.rules || []).map((r) => ({
  ...r,
  re: new RegExp(r.test || ".*", r.flags || "i"),
}));

export function buildHeuristicDraft(body = {}) {
  const text = `${body.title || ""} ${body.description || ""}`.trim();
  const matched = RULES.find((r) => r.re.test(text));
  const rule = matched || pack.default;
  const countryBoost = body.country && /китай|china|cn\b/i.test(body.country) ? 0.03 : 0;
  const confidence = Math.min(0.95, rule.confidence + countryBoost);
  return {
    hsCode: rule.hsCode,
    duties: {
      customsDutyPercent: rule.duty,
      vatPercent: DEFAULT_IMPORT_VAT_PERCENT,
      feeRub: customsOperationsFeeFromUsd(body.shipmentValue),
      note: `${pack.version} · rule=${rule.id} · vat=${DEFAULT_IMPORT_VAT_PERCENT} · fee=PP1637`,
    },
    documents: rule.docs || pack.defaultDocs,
    confidence,
    disclaimer: pack.disclaimer,
    inputPreview: text.slice(0, 200),
    engine: "heuristic-v1",
  };
}
