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
    path.join(here, "tnved-relation-edges.json"),
    path.join(here, "../../../src/lib/ved/tnved-relation-edges.json"),
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

function loadJsonOverlay(names, fallback) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const name of names) {
    for (const p of [path.join(here, name), path.join(here, "../../../src/lib/ved", name)]) {
      try {
        return JSON.parse(readFileSync(p, "utf8"));
      } catch {
        /* try next */
      }
    }
  }
  return fallback;
}

const psnPack = loadJsonOverlay(["tnved-psn-excerpts.json"], { groups: {} });
const decisionsPack = loadJsonOverlay(["tnved-classification-decisions.json"], { items: [] });
const enrichPack = loadJsonOverlay(["tnved-card-enrich-pack.json"], {
  items: [],
  schema: "card-enrich/v1",
});
const PSN_NOTES_RE = /^ЕЭК\s*PSN:\s*(.+?)\.\s+([\s\S]+)$/i;
const DONOR_HOST_RE =
  /customsonline\.ru|alta\.ru|tks\.ru|tnved\.info|tamognia\.ru|брокер-консультант/gi;
const ENRICH_KINDS = new Set([
  "import_duty",
  "preferential_good",
  "temporary_import_duty",
  "vat",
  "excise",
  "security_rate",
  "preferential_regime",
  "import_licensing",
  "dual_use_import",
  "certification",
  "classification_confirm",
  "clearance_places",
  "export_licensing",
  "dual_use_export",
  "export_quota",
  "other_import",
  "other_export",
  "preliminary_classification",
]);

function sanitizeEnrichText(raw) {
  let s = String(raw ?? "");
  if (!s) return "";
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/on\w+\s*=\s*(['"]).*?\1/gi, " ");
  s = s.replace(/javascript\s*:/gi, "");
  s = s.replace(/https?:\/\/[^\s"'<>]+/gi, (url) => {
    if (DONOR_HOST_RE.test(url)) {
      DONOR_HOST_RE.lastIndex = 0;
      return "";
    }
    DONOR_HOST_RE.lastIndex = 0;
    return url;
  });
  s = s.replace(DONOR_HOST_RE, "");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
  return s.replace(/\s+/g, " ").trim().slice(0, 4000);
}

function lookupPackEnrichFields(codeInput) {
  const code = String(codeInput || "").replace(/\D/g, "");
  const fields = [];
  for (const item of enrichPack.items || []) {
    const itemCode = String(item.code || "").replace(/\D/g, "");
    if (itemCode !== code) continue;
    for (const f of item.facts || []) {
      const fieldKind = String(f.fieldKind || "").trim();
      if (!ENRICH_KINDS.has(fieldKind)) continue;
      const valueShort = sanitizeEnrichText(f.valueShort).slice(0, 120) || null;
      const valueText = sanitizeEnrichText(f.valueText) || null;
      if (!valueShort && !valueText) continue;
      fields.push({
        fieldKind,
        valueShort,
        valueText,
        npaRef: sanitizeEnrichText(f.npaRef).slice(0, 500) || null,
        sourceLayer: sanitizeEnrichText(f.sourceLayer).slice(0, 80) || null,
        asOf: f.asOf || enrichPack.asOf || null,
      });
    }
  }
  return {
    schema: enrichPack.schema || "card-enrich/v1",
    asOf: enrichPack.asOf || null,
    fields,
  };
}

function parsePsnFromNotes(notes) {
  const lead = String(notes || "")
    .trim()
    .split(/\n+/)[0]
    ?.trim();
  if (!lead) return null;
  const m = lead.match(PSN_NOTES_RE);
  if (!m) return null;
  const heading = m[1].trim();
  const excerpt = m[2].replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!heading || !excerpt) return null;
  return { heading, excerpt, url: psnPack.sourceUrl || null, origin: "notes" };
}

function lookupPsnExplanation(code, notes, ancestors) {
  const fromOwn = parsePsnFromNotes(notes);
  if (fromOwn) return fromOwn;
  for (const a of ancestors || []) {
    const hit = parsePsnFromNotes(a.notes);
    if (hit) return hit;
  }
  const group = String(code || "").replace(/\D/g, "").slice(0, 2);
  const row = psnPack.groups?.[group];
  if (!row?.excerpt?.trim()) return null;
  return {
    heading: String(row.heading || `Группа ${group}`).trim(),
    excerpt: String(row.excerpt).replace(/\s+/g, " ").trim().slice(0, 1200),
    url: row.url ?? psnPack.sourceUrl ?? null,
    origin: "overlay",
  };
}

function lookupClassificationDecisions(codeRaw, limit = 5) {
  const code = String(codeRaw || "").replace(/\D/g, "");
  if (code.length !== 10) return [];
  const out = [];
  for (const raw of decisionsPack.items || []) {
    const c = String(raw.code || "").replace(/\D/g, "");
    if (c !== code) continue;
    const title = String(raw.title || "").trim();
    if (!title) continue;
    out.push({
      code: c,
      title,
      url: raw.url ?? decisionsPack.sourceUrl ?? null,
      asOf: raw.asOf ?? decisionsPack.asOf ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

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
    hits.push({
      flag: rule.flag,
      source: rule.source,
      url: rule.url ?? null,
      prefix,
      ...(rule.group ? { group: rule.group } : {}),
    });
  }
  return hits;
}

function layerGToHint(hits) {
  return {
    excisePossible: hits.some((h) => h.flag === "excisePossible"),
    utilSborPossible: hits.some((h) => h.flag === "utilSborPossible"),
    ecoFeePossible: hits.some((h) => h.flag === "ecoFeePossible"),
    ntmPossible: hits.some((h) => h.flag === "ntmPossible"),
    hits: hits.map((h) => ({
      flag: h.flag,
      source: h.source,
      prefix: h.prefix,
      ...(h.group ? { group: h.group } : {}),
    })),
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
    layer: "E",
    title: "Решения ЕЭК о классификации",
    url: "https://eec.eaeunion.org/comission/department/catr/classification/",
    asOf: null,
  },
  {
    layer: "G",
    title: "Акциз / утиль / экосбор РОП / НТМ — триггеры НПА (не ставка)",
    url: null,
    asOf: "2026-08-29",
  },
  {
    layer: "ENRICH",
    title: "Условия импорта/экспорта (card-enrich overlay)",
    url: null,
    asOf: "2026-09-04",
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
  const anc = ancestors || [];
  return {
    code: row.code,
    codeDisplay: row.codeDisplay,
    titleRu: row.titleRu,
    titleEn: row.titleEn ?? null,
    level: row.level,
    isLeaf: Boolean(row.isLeaf),
    notes: row.notes ?? null,
    ancestors: anc,
    children: more.children || [],
    related: more.related || relationsForCode(row.code),
    rate: pickEttRate(rates),
    explanation: lookupPsnExplanation(row.code, row.notes, anc),
    classificationDecisions: lookupClassificationDecisions(row.code),
    paymentsHint: { vatPct: DEFAULT_IMPORT_VAT_PERCENT, feeRule: TNVED_FEE_RULE },
    measuresHint: layerGToHint(matchLayerG(row.code)),
    cardEnrich: more.cardEnrich || lookupPackEnrichFields(row.code),
    sources: TNVED_CARD_SOURCES,
    disclaimer: TNVED_CARD_DISCLAIMER,
    rates,
  };
}
