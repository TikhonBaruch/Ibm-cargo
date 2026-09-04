/**
 * Card-enrich overlay: field taxonomy + sanitize + assemble (plan-tnved-card-enrich.md).
 * No CustomsOnline / Alta / TKS scrape. Fail-open empty block.
 */
import { createHash } from "crypto";
import packFile from "./tnved-card-enrich-pack.json";

export const TNVED_ENRICH_SCHEMA = "card-enrich/v1";

/** Stable field kinds — UI / DB enum (string). */
export const TNVED_ENRICH_FIELD_KINDS = [
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
] as const;

export type TnvedEnrichFieldKind = (typeof TNVED_ENRICH_FIELD_KINDS)[number];

const KIND_SET = new Set<string>(TNVED_ENRICH_FIELD_KINDS);

export type TnvedEnrichFactInput = {
  code: string;
  fieldKind: string;
  valueShort?: string | null;
  valueText?: string | null;
  npaRef?: string | null;
  sourceLayer?: string | null;
  asOf?: string | null;
};

export type TnvedCardEnrichField = {
  fieldKind: TnvedEnrichFieldKind | string;
  valueShort: string | null;
  valueText: string | null;
  npaRef: string | null;
  sourceLayer: string | null;
  asOf: string | null;
};

export type TnvedCardEnrich = {
  schema: string;
  asOf: string | null;
  fields: TnvedCardEnrichField[];
};

type PackFile = {
  schema?: string;
  asOf?: string | null;
  sourceKey?: string;
  note?: string;
  items?: Array<{
    code?: string;
    facts?: Array<{
      fieldKind?: string;
      valueShort?: string | null;
      valueText?: string | null;
      npaRef?: string | null;
      sourceLayer?: string | null;
      asOf?: string | null;
    }>;
  }>;
};

const pack = packFile as PackFile;

const DONOR_HOST_RE =
  /customsonline\.ru|alta\.ru|tks\.ru|tnved\.info|tamognia\.ru|брокер-консультант/gi;

/** Strip scripts, HTML, javascript: URLs, and commercial donor hostnames. */
export function sanitizeEnrichText(raw: string | null | undefined): string {
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
  s = s.replace(/\s+/g, " ").trim();
  return s.slice(0, 4000);
}

export function isEnrichFieldKind(k: string): k is TnvedEnrichFieldKind {
  return KIND_SET.has(k);
}

export function digitsCode(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

export function normalizeEnrichFact(input: TnvedEnrichFactInput): TnvedEnrichFactInput | null {
  const code = digitsCode(input.code);
  if (!code || code.length < 2 || code.length > 10 || code.length % 2 !== 0) return null;
  const fieldKind = String(input.fieldKind || "").trim();
  if (!fieldKind || !isEnrichFieldKind(fieldKind)) return null;
  const valueShort = sanitizeEnrichText(input.valueShort).slice(0, 120) || null;
  const valueText = sanitizeEnrichText(input.valueText) || null;
  const npaRef = sanitizeEnrichText(input.npaRef).slice(0, 500) || null;
  const sourceLayer = sanitizeEnrichText(input.sourceLayer).slice(0, 80) || null;
  if (!valueShort && !valueText) return null;
  return {
    code,
    fieldKind,
    valueShort,
    valueText,
    npaRef,
    sourceLayer,
    asOf: input.asOf ? String(input.asOf).slice(0, 32) : null,
  };
}

export function factsFromPack(packData: PackFile = pack): {
  sourceKey: string;
  asOf: string | null;
  schemaKind: string;
  facts: TnvedEnrichFactInput[];
} {
  const facts: TnvedEnrichFactInput[] = [];
  for (const item of packData.items || []) {
    const code = digitsCode(item.code);
    if (!code) continue;
    for (const f of item.facts || []) {
      const norm = normalizeEnrichFact({
        code,
        fieldKind: String(f.fieldKind || ""),
        valueShort: f.valueShort,
        valueText: f.valueText,
        npaRef: f.npaRef,
        sourceLayer: f.sourceLayer,
        asOf: f.asOf ?? packData.asOf ?? null,
      });
      if (norm) facts.push(norm);
    }
  }
  return {
    sourceKey: String(packData.sourceKey || "pack:card-enrich"),
    asOf: packData.asOf ?? null,
    schemaKind: String(packData.schema || TNVED_ENRICH_SCHEMA),
    facts,
  };
}

export function shaOfFacts(facts: TnvedEnrichFactInput[]): string {
  const payload = facts
    .map((f) => `${f.code}|${f.fieldKind}|${f.valueShort || ""}|${f.valueText || ""}`)
    .sort()
    .join("\n");
  return createHash("sha1").update(payload).digest("hex");
}

export function assembleCardEnrich(input: {
  code: string;
  facts?: TnvedEnrichFactInput[] | null;
  asOf?: string | null;
}): TnvedCardEnrich {
  const code = digitsCode(input.code);
  const list = (input.facts || []).filter((f) => digitsCode(f.code) === code || !f.code);
  const fields: TnvedCardEnrichField[] = [];
  for (const f of list) {
    const norm = normalizeEnrichFact({ ...f, code: f.code || code });
    if (!norm) continue;
    fields.push({
      fieldKind: norm.fieldKind,
      valueShort: norm.valueShort ?? null,
      valueText: norm.valueText ?? null,
      npaRef: norm.npaRef ?? null,
      sourceLayer: norm.sourceLayer ?? null,
      asOf: norm.asOf ?? input.asOf ?? null,
    });
  }
  return {
    schema: TNVED_ENRICH_SCHEMA,
    asOf: input.asOf ?? pack.asOf ?? null,
    fields,
  };
}

/** Lookup curated pack facts for a code (fail-open). */
export function lookupPackEnrichFacts(codeInput: string): TnvedEnrichFactInput[] {
  const code = digitsCode(codeInput);
  if (!code) return [];
  const { facts } = factsFromPack();
  return facts.filter((f) => f.code === code);
}

export type EnrichReconcileReport = {
  packCodes: number;
  missingInTree: string[];
  inactiveInTree: string[];
  ok: number;
};

export function reconcileEnrichCodes(
  packCodes: string[],
  tree: Map<string, { isActive: boolean }>,
): EnrichReconcileReport {
  const missing: string[] = [];
  const inactive: string[] = [];
  let ok = 0;
  const unique = [...new Set(packCodes.map(digitsCode).filter(Boolean))];
  for (const code of unique) {
    const row = tree.get(code);
    if (!row) {
      missing.push(code);
      continue;
    }
    if (!row.isActive) {
      inactive.push(code);
      continue;
    }
    ok += 1;
  }
  return { packCodes: unique.length, missingInTree: missing, inactiveInTree: inactive, ok };
}

/** RU labels for drawer «Условия». */
export const TNVED_ENRICH_FIELD_LABELS: Record<string, string> = {
  import_duty: "Импортная пошлина",
  preferential_good: "Преференциальный товар",
  temporary_import_duty: "Временная импортная пошлина",
  vat: "НДС",
  excise: "Акциз",
  security_rate: "Ставка обеспечения",
  preferential_regime: "Преференциальный режим",
  import_licensing: "Лицензирование импорта",
  dual_use_import: "Двойное применение (импорт)",
  certification: "Сертификация",
  classification_confirm: "Подтверждение классификации",
  clearance_places: "Места оформления",
  export_licensing: "Лицензирование экспорта",
  dual_use_export: "Двойное применение (экспорт)",
  export_quota: "Квотирование экспорта",
  other_import: "Прочее (импорт)",
  other_export: "Прочее (экспорт)",
  preliminary_classification: "Предварительные решения",
};

const EMPTY_SHORT_RE = /^(нет данных|—|-)$/i;
/** Kinds covered by paymentsHint / measuresHint — skip in «Условия» unless preferential VAT or pointer. */
const DUPLICATE_OF_CARD_UI = new Set([
  "import_duty",
  "excise",
  "import_licensing",
]);

/**
 * Fields safe to show in TnvedCodeCard «Условия».
 * Skips empty hold, default VAT 22% (already in payments), and measure duplicates.
 */
export function visibleCardEnrichFields(
  enrich: TnvedCardEnrich | null | undefined,
  opts?: {
    paymentsVatPct?: number | null;
    measures?: {
      excisePossible?: boolean;
      ntmPossible?: boolean;
      ecoFeePossible?: boolean;
    } | null;
  },
): TnvedCardEnrichField[] {
  const fields = enrich?.fields || [];
  const vatDefault = opts?.paymentsVatPct == null || Number(opts.paymentsVatPct) === 22;
  const out: TnvedCardEnrichField[] = [];
  for (const f of fields) {
    const short = (f.valueShort || "").trim();
    if (!short || EMPTY_SHORT_RE.test(short)) continue;
    if (f.sourceLayer === "hold") continue;
    if (f.fieldKind === "vat" && vatDefault && /^22\s*%?$/.test(short)) continue;
    if (f.fieldKind === "import_duty" && DUPLICATE_OF_CARD_UI.has(f.fieldKind)) continue;
    if (f.fieldKind === "excise" && opts?.measures?.excisePossible) continue;
    if (f.fieldKind === "import_licensing" && opts?.measures?.ntmPossible) continue;
    if (f.fieldKind === "other_import" && /экосбор/i.test(short) && opts?.measures?.ecoFeePossible) {
      continue;
    }
    out.push(f);
  }
  return out;
}

