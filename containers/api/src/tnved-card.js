import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * TN VED card envelope (opendata slices 2–3 + G triggers). Mirrors src/lib/ved/tnved.ts assembleTnvedCard.
 */
export const DEFAULT_IMPORT_VAT_PERCENT = 22;
export const TNVED_FEE_RULE = "ПП 1637";
export const TNVED_CARD_DISCLAIMER =
  "Рекомендация справочника, не решение таможенного органа. Финальный код подтверждает брокер.";

const overlay = (() => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "tnved-layer-g.json"), // docker image (copied next to src)
    path.join(here, "../../../src/lib/ved/tnved-layer-g.json"), // monorepo checkout
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      /* try next */
    }
  }
  return { rules: [] };
})();

const relationsOverlay = (() => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "tnved-relations.json"),
    path.join(here, "../../../src/lib/ved/tnved-relations.json"),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      /* try next */
    }
  }
  return { edges: [] };
})();

function normalizeHsDigits(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (![2, 4, 6, 8, 10].includes(digits.length)) return null;
  return digits;
}

const RELATION_KINDS = new Set(["not", "variant", "part", "kit"]);

function buildRelationIndex(file) {
  const map = new Map();
  const push = (fromRaw, toRaw, kind, why) => {
    const from = normalizeHsDigits(fromRaw);
    const to = normalizeHsDigits(toRaw);
    if (!from || !to || from === to) return;
    const row = map.get(from) || [];
    if (row.some((r) => r.code === to && r.kind === kind)) return;
    row.push({ code: to, kind, why });
    map.set(from, row);
  };
  for (const edge of file.edges || []) {
    if (!RELATION_KINDS.has(edge.kind)) continue;
    push(edge.from, edge.to, edge.kind, edge.why);
    if (edge.symmetric !== false) push(edge.to, edge.from, edge.kind, edge.why);
  }
  return map;
}

const relationIndex = buildRelationIndex(relationsOverlay);

export function relationsForCode(codeRaw) {
  const code = normalizeHsDigits(codeRaw);
  if (!code) return [];
  return relationIndex.get(code) || [];
}

function matchLayerG(code) {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length < 2) return [];
  const hits = [];
  const seen = new Set();
  for (const rule of overlay.rules || []) {
    if (seen.has(rule.flag)) continue;
    const prefixes = [...(rule.prefixes || [])].sort((a, b) => b.length - a.length);
    const prefix = prefixes.find((p) => digits.startsWith(p));
    if (!prefix) continue;
    seen.add(rule.flag);
    hits.push({ flag: rule.flag, source: rule.source, url: rule.url ?? null, prefix });
  }
  return hits;
}

function layerGToHint(hits) {
  return {
    excisePossible: hits.some((h) => h.flag === "excisePossible"),
    utilSborPossible: hits.some((h) => h.flag === "utilSborPossible"),
    ntmPossible: hits.some((h) => h.flag === "ntmPossible"),
    hits,
  };
}

export const TNVED_CARD_SOURCES = [
  {
    layer: "A",
    title: "ФНС: классификатор ТН ВЭД (TNVED.ZIP)",
    url: "https://www.nalog.gov.ru/rn77/program/5961290/",
    asOf: "2026-04-27",
  },
  {
    layer: "B",
    title: "ЕТТ ЕАЭС (ставка пошлины)",
    url: "https://eec.eaeunion.org/comission/department/catr/ett/",
    asOf: null,
  },
  {
    layer: "C",
    title: "НК РФ НДС 22% · сбор ПП 1637",
    url: null,
    asOf: "2026-01-01",
  },
  {
    layer: "D",
    title: "ЕЭК пояснения к ТН ВЭД (PSN)",
    url: "https://eec.eaeunion.org/comission/department/catr/psn/",
    asOf: "2026-08-08",
  },
  {
    layer: "G",
    title: "Акциз / утиль / НТМ — триггеры НПА (не ставка)",
    url: null,
    asOf: "2026-01-01",
  },
];

const ETT_SOURCE_RE = /ett|stnvedst|egov|nsi|тариф/i;
const LEVELS = [2, 4, 6, 8, 10];

export function hsCodeAncestors(leaf) {
  const digits = String(leaf || "").replace(/\D/g, "");
  const out = [];
  for (const level of LEVELS) {
    if (digits.length >= level) out.push(digits.slice(0, level));
  }
  return out;
}

export function pickEttRate(rates) {
  const list = Array.isArray(rates) ? rates : [];
  const withDuty = list.filter(
    (r) =>
      (r.dutyPct != null && Number.isFinite(Number(r.dutyPct))) ||
      (r.dutyRubPerUnit != null && Number.isFinite(Number(r.dutyRubPerUnit)))
  );
  const preferred = withDuty.find((r) => ETT_SOURCE_RE.test(String(r.source || "")));
  const hit = preferred || withDuty[0];
  if (!hit) return null;
  return {
    dutyKind: hit.dutyKind || "AD_VALOREM",
    dutyPct: hit.dutyPct ?? null,
    dutyRubPerUnit: hit.dutyRubPerUnit ?? null,
    unit: hit.unit ?? null,
    source: hit.source ?? null,
  };
}

export function assembleTnvedCard(row, ancestors, extra) {
  const rates = Array.isArray(row.rates) ? row.rates : [];
  const more = extra || {};
  return {
    code: row.code,
    codeDisplay: row.codeDisplay,
    titleRu: row.titleRu,
    titleEn: row.titleEn ?? null,
    level: row.level,
    isLeaf: Boolean(row.isLeaf),
    notes: row.notes ?? null,
    ancestors: ancestors || [],
    children: more.children || [],
    related: more.related || relationsForCode(row.code),
    rate: pickEttRate(rates),
    paymentsHint: { vatPct: DEFAULT_IMPORT_VAT_PERCENT, feeRule: TNVED_FEE_RULE },
    measuresHint: layerGToHint(matchLayerG(row.code)),
    sources: TNVED_CARD_SOURCES,
    disclaimer: TNVED_CARD_DISCLAIMER,
    rates,
  };
}
