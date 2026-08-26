/**
 * TN VED (HS) code helpers + directory shape (D24).
 * Storage PK = digits only; display uses spaced Russian 10-digit form.
 */
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { DEFAULT_IMPORT_VAT_PERCENT } from "./customs-fees";
import { expandFromAliases, matchAlias, type HsAlias } from "./tnved-aliases";
import { layerGToHint, matchLayerG } from "./tnved-layer-g";

export const TNVED_LEVELS = [2, 4, 6, 8, 10] as const;
export type TnvedLevel = (typeof TNVED_LEVELS)[number];

/** Digits only, length 2|4|6|8|10. */
export function normalizeHsCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (![2, 4, 6, 8, 10].includes(digits.length)) return null;
  return digits;
}

/** Format 10-digit code as "8471 30 000 0"; shorter codes as groups of 2. */
export function formatHsCode(code: string | null | undefined): string | null {
  const digits = normalizeHsCode(code);
  if (!digits) return null;
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 2) {
    parts.push(digits.slice(i, i + 2));
  }
  return parts.join(" ");
}

export function hsCodeLevel(code: string | null | undefined): TnvedLevel | null {
  const digits = normalizeHsCode(code);
  if (!digits) return null;
  return digits.length as TnvedLevel;
}

export function parentHsCode(code: string | null | undefined): string | null {
  const digits = normalizeHsCode(code);
  if (!digits || digits.length <= 2) return null;
  const idx = TNVED_LEVELS.indexOf(digits.length as TnvedLevel);
  if (idx <= 0) return null;
  return digits.slice(0, TNVED_LEVELS[idx - 1]);
}

export const tnvedCodeSchema = z.object({
  code: z
    .string()
    .regex(/^\d{2}(\d{2}){0,4}$/)
    .refine((c) => [2, 4, 6, 8, 10].includes(c.length), "level must be 2/4/6/8/10"),
  codeDisplay: z.string().min(2).max(20),
  level: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8), z.literal(10)]),
  parentCode: z.string().regex(/^\d{2,8}$/).nullable().optional(),
  titleRu: z.string().min(1).max(2000),
  titleEn: z.string().max(2000).nullable().optional(),
  isLeaf: z.boolean().default(false),
  isActive: z.boolean().default(true),
  notes: z.string().max(4000).nullable().optional(),
  validFrom: z.union([z.string(), z.date()]).nullable().optional(),
  validTo: z.union([z.string(), z.date()]).nullable().optional(),
});

export type TnvedCodeInput = z.infer<typeof tnvedCodeSchema>;

export const tnvedDutyRateSchema = z.object({
  code: z.string().regex(/^\d{2,10}$/),
  dutyKind: z.enum(["AD_VALOREM", "SPECIFIC", "COMBINED"]).default("AD_VALOREM"),
  dutyPct: z.number().min(0).max(100).nullable().optional(),
  dutyRubPerUnit: z.number().nonnegative().nullable().optional(),
  vatPct: z.number().min(0).max(100).nullable().optional(),
  feeHintRub: z.number().int().nonnegative().nullable().optional(),
  unit: z.string().max(32).nullable().optional(),
  source: z.string().max(120).nullable().optional(),
});

export type TnvedDutyRateInput = z.infer<typeof tnvedDutyRateSchema>;

/**
 * Soft validation for broker/AI HS strings (directory check is separate).
 */
export function isValidHsCodeShape(input: string | null | undefined): boolean {
  return normalizeHsCode(input) != null;
}

/**
 * Build ancestor chain for insert order: chapter → … → leaf.
 * Example: "8471300000" → ["84","8471","847130","84713000","8471300000"]
 */
export function hsCodeAncestors(leafDisplayOrDigits: string): string[] {
  const leaf = normalizeHsCode(leafDisplayOrDigits);
  if (!leaf) return [];
  const out: string[] = [];
  for (const level of TNVED_LEVELS) {
    if (leaf.length >= level) out.push(leaf.slice(0, level));
  }
  return out;
}

export type TnvedSearchOpts = {
  q?: string;
  limit?: number;
  leafOnly?: boolean;
  /** Digits prefix, e.g. chapter "84" or heading "8471". */
  codePrefix?: string;
  /** Exact hierarchy level filter (2|4|6|8|10). */
  level?: TnvedLevel;
};

export type TnvedMatchKind = "code" | "title" | "alias" | "expand";

export type TnvedMatchMeta = {
  score: number;
  kind: TnvedMatchKind;
  why?: string;
  risk?: string;
};

export type TnvedSearchHit = {
  code: string;
  codeDisplay: string;
  titleRu: string;
  notes?: string | null;
  level: number;
  isLeaf: boolean;
  matchMeta?: TnvedMatchMeta;
};

type TnvedDb = Pick<Prisma.TransactionClient, "tnvedCode" | "tnvedDutyRate">;

type TnvedSearchRow = {
  code: string;
  codeDisplay: string;
  titleRu: string;
  notes?: string | null;
  level: number;
  isLeaf: boolean;
};

/** Fallback expand when aliases miss (legacy browse boost). */
const SEARCH_EXPAND_FALLBACK: Array<{ test: RegExp; tokens: string[]; prefixes: string[] }> = [
  { test: /ноутбук|laptop|notebook|macbook|нетбук|thinkpad/i, tokens: ["портативн", "вычислительн"], prefixes: ["847130"] },
  { test: /смартфон|телефон|iphone|android|mobile\s*phone/i, tokens: ["телефон"], prefixes: ["8517"] },
  { test: /футболка|t-?shirt|поло|майка/i, tokens: ["футболк", "майк", "нательн"], prefixes: ["6109", "6105"] },
  { test: /кроссов|кеды|sneakers|обув/i, tokens: ["обув"], prefixes: ["6404", "6402"] },
  { test: /фильтр.*(масл|oil)|oil\s*filter/i, tokens: ["фильтр"], prefixes: ["8421"] },
];

function normalizeSearchText(s: string) {
  return s.toLowerCase().replace(/ё/g, "е");
}

/** Score a candidate for directory ranking (higher = better). */
export function scoreTnvedSearchHit(
  row: TnvedSearchRow,
  opts: {
    q: string;
    digits: string;
    expandPrefixes: string[];
    expandTokens: string[];
    pinCode?: string | null;
  }
): number {
  const title = normalizeSearchText(row.titleRu || "");
  const notes = normalizeSearchText(row.notes || "");
  const q = normalizeSearchText(opts.q);
  let score = 0;

  const pin = opts.pinCode ? opts.pinCode.replace(/\D/g, "") : "";
  if (pin && (row.code === pin || row.code.startsWith(pin) || pin.startsWith(row.code))) {
    // lbm-bro searchTnved pins classify/alias winner at 2000
    score += 2000;
  }

  if (opts.digits.length >= 2) {
    if (row.code === opts.digits || row.code === `${opts.digits}0`) score += 1000;
    else if (row.code.startsWith(opts.digits) || opts.digits.startsWith(row.code)) {
      score += 400 - Math.abs(row.code.length - opts.digits.length) * 8;
    }
  }

  if (q.length >= 2) {
    const tPos = title.indexOf(q);
    if (tPos >= 0) score += 120 - Math.min(tPos, 40);
    const nPos = notes.indexOf(q);
    if (nPos >= 0) score += 80 - Math.min(nPos, 30);
  }

  for (const p of opts.expandPrefixes) {
    if (row.code.startsWith(p)) score += 200 + Math.min(p.length, 6) * 10;
  }
  for (const tok of opts.expandTokens) {
    if (title.includes(tok) || notes.includes(tok)) score += 60;
  }

  if (row.isLeaf) score += 40;
  score += row.level;
  return score;
}

function expandForQuery(q: string) {
  const fromAliases = expandFromAliases(q);
  const expandPrefixes = [...fromAliases.expandPrefixes];
  const expandTokens = [...fromAliases.expandTokens];
  for (const rule of SEARCH_EXPAND_FALLBACK) {
    if (!rule.test.test(q)) continue;
    expandPrefixes.push(...rule.prefixes);
    expandTokens.push(...rule.tokens);
  }
  return {
    expandPrefixes: [...new Set(expandPrefixes)],
    expandTokens: [...new Set(expandTokens)],
    aliasHits: fromAliases.hits,
  };
}

function matchKindForHit(
  row: TnvedSearchRow,
  score: number,
  opts: { q: string; digits: string; pinCode?: string | null; expandPrefixes: string[] }
): TnvedMatchKind {
  const pin = opts.pinCode ? opts.pinCode.replace(/\D/g, "") : "";
  if (pin && (row.code === pin || row.code.startsWith(pin.slice(0, 6)))) return "alias";
  if (opts.digits.length >= 2 && (row.code.startsWith(opts.digits) || opts.digits.startsWith(row.code))) {
    return "code";
  }
  if (opts.expandPrefixes.some((p) => row.code.startsWith(p)) && score >= 200) return "expand";
  return "title";
}

function resolvePinAlias(q: string): { alias: HsAlias; score: number } | null {
  if (!q.trim()) return null;
  return matchAlias(q);
}

/** Directory search by code prefix and/or titleRu/notes (D-TNVED) with lbm-bro-style ranking. */
export async function searchTnvedCodes(db: TnvedDb, opts: TnvedSearchOpts): Promise<TnvedSearchHit[]> {
  const q = String(opts.q || "").trim();
  const codePrefix = String(opts.codePrefix || "").replace(/\D/g, "");
  if (!q && !codePrefix) return [];

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const digits = q.replace(/\D/g, "");
  const { expandPrefixes, expandTokens, aliasHits } = expandForQuery(q);
  const pinHit = resolvePinAlias(q);
  const pinCode = pinHit?.alias.code || null;

  const or: Array<Record<string, unknown>> = [];
  if (q) {
    or.push({ titleRu: { contains: q, mode: "insensitive" } });
    or.push({ notes: { contains: q, mode: "insensitive" } });
  }
  if (digits.length >= 2) {
    or.push({ code: { startsWith: digits } });
  }
  if (pinCode) {
    or.push({ code: { startsWith: pinCode.slice(0, Math.min(6, pinCode.length)) } });
    or.push({ code: pinCode });
  }
  for (const p of expandPrefixes) {
    or.push({ code: { startsWith: p } });
  }
  for (const tok of expandTokens) {
    or.push({ titleRu: { contains: tok, mode: "insensitive" } });
  }

  const where: Record<string, unknown> = {
    isActive: true,
    ...(opts.leafOnly ? { isLeaf: true } : {}),
    ...(opts.level ? { level: opts.level } : {}),
    ...(codePrefix ? { code: { startsWith: codePrefix } } : {}),
  };
  if (or.length) where.OR = or;

  // Fetch a wider pool, then rank in memory (ILIKE has no relevance score).
  const pool = Math.min(Math.max(limit * 4, 40), 120);
  const rows = (await db.tnvedCode.findMany({
    where,
    take: pool,
    orderBy: [{ level: "desc" }, { code: "asc" }],
  })) as TnvedSearchRow[];

  // Ensure alias pin code is in the pool even if ILIKE missed (thin seed / notes gap).
  let poolRows = rows;
  if (pinCode && !rows.some((r) => r.code === pinCode || r.code.startsWith(pinCode.slice(0, 6)))) {
    const pinned = (await db.tnvedCode.findMany({
      where: {
        isActive: true,
        OR: [{ code: pinCode }, { code: { startsWith: pinCode.slice(0, 6) } }],
        ...(opts.leafOnly ? { isLeaf: true } : {}),
      },
      take: 8,
      orderBy: [{ level: "desc" }, { code: "asc" }],
    })) as TnvedSearchRow[];
    if (pinned.length) {
      const seen = new Set(rows.map((r) => r.code));
      poolRows = [...rows, ...pinned.filter((r) => !seen.has(r.code))];
    }
  }

  const scoreOpts = { q, digits, expandPrefixes, expandTokens, pinCode };
  const ranked = poolRows
    .map((row) => ({
      row,
      score: scoreTnvedSearchHit(row, scoreOpts),
    }))
    .sort((a, b) => b.score - a.score || b.row.level - a.row.level || a.row.code.localeCompare(b.row.code));

  const topAlias = pinHit?.alias || aliasHits[0]?.alias || null;

  return ranked.slice(0, limit).map((r) => {
    const kind = matchKindForHit(r.row, r.score, {
      q,
      digits,
      pinCode,
      expandPrefixes,
    });
    const meta: TnvedMatchMeta = {
      score: r.score,
      kind,
      ...(kind === "alias" && topAlias
        ? { why: topAlias.why, risk: topAlias.risk }
        : {}),
    };
    return { ...r.row, matchMeta: meta };
  });
}

/** Chapter nodes (level 2) for directory browse. */
export async function listTnvedChapters(db: TnvedDb) {
  return db.tnvedCode.findMany({
    where: { isActive: true, level: 2 },
    orderBy: { code: "asc" },
    select: { code: true, codeDisplay: true, titleRu: true },
  });
}

export const TNVED_CARD_DISCLAIMER =
  "Рекомендация справочника, не решение таможенного органа. Финальный код подтверждает брокер.";

export const TNVED_FEE_RULE = "ПП 1637";

export type TnvedCardAncestor = {
  code: string;
  codeDisplay: string;
  titleRu: string;
  level: number;
};

export type TnvedCardRate = {
  dutyKind: string | null;
  dutyPct: number | null;
  dutyRubPerUnit: number | null;
  unit: string | null;
  source: string | null;
};

export type TnvedCardSource = {
  layer: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  title: string;
  url: string | null;
  asOf: string | null;
};

export type TnvedCard = {
  code: string;
  codeDisplay: string;
  titleRu: string;
  titleEn: string | null;
  level: number;
  isLeaf: boolean;
  notes: string | null;
  ancestors: TnvedCardAncestor[];
  rate: TnvedCardRate | null;
  paymentsHint: { vatPct: number; feeRule: string };
  measuresHint: {
    excisePossible: boolean;
    utilSborPossible: boolean;
    ntmPossible: boolean;
    hits: Array<{ flag: string; source: string; prefix: string }>;
  };
  sources: TnvedCardSource[];
  disclaimer: string;
  /** Kept for combobox onHint (legacy). */
  rates: unknown[];
};

export const TNVED_CARD_SOURCES: TnvedCardSource[] = [
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

export function pickEttRate(
  rates: Array<{
    dutyKind?: string | null;
    dutyPct?: number | null;
    dutyRubPerUnit?: number | null;
    unit?: string | null;
    source?: string | null;
  }>
): TnvedCardRate | null {
  const withDuty = rates.filter(
    (r) =>
      (r.dutyPct != null && Number.isFinite(r.dutyPct)) ||
      (r.dutyRubPerUnit != null && Number.isFinite(r.dutyRubPerUnit))
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

export function assembleTnvedCard(input: {
  row: {
    code: string;
    codeDisplay: string;
    titleRu: string;
    titleEn?: string | null;
    level: number;
    isLeaf: boolean;
    notes?: string | null;
    rates?: unknown[];
  };
  ancestors: TnvedCardAncestor[];
}): TnvedCard {
  const rates = Array.isArray(input.row.rates) ? input.row.rates : [];
  return {
    code: input.row.code,
    codeDisplay: input.row.codeDisplay,
    titleRu: input.row.titleRu,
    titleEn: input.row.titleEn ?? null,
    level: input.row.level,
    isLeaf: Boolean(input.row.isLeaf),
    notes: input.row.notes ?? null,
    ancestors: input.ancestors,
    rate: pickEttRate(rates as Parameters<typeof pickEttRate>[0]),
    paymentsHint: { vatPct: DEFAULT_IMPORT_VAT_PERCENT, feeRule: TNVED_FEE_RULE },
    measuresHint: layerGToHint(matchLayerG(input.row.code)),
    sources: TNVED_CARD_SOURCES,
    disclaimer: TNVED_CARD_DISCLAIMER,
    rates,
  };
}

/** Lookup one code (digits or display) with recent duty rates. */
export async function getTnvedByCode(db: TnvedDb, codeInput: string) {
  const code = normalizeHsCode(codeInput);
  if (!code) return null;
  return db.tnvedCode.findUnique({
    where: { code },
    include: {
      rates: { orderBy: { validFrom: "desc" }, take: 5 },
    },
  });
}

/** Card envelope for GET /v1/tnved/:code (opendata slices 2–3). */
export async function getTnvedCard(db: TnvedDb, codeInput: string): Promise<TnvedCard | null> {
  const row = await getTnvedByCode(db, codeInput);
  if (!row) return null;
  const ancestorCodes = hsCodeAncestors(row.code).filter((c) => c !== row.code);
  const found = ancestorCodes.length
    ? await db.tnvedCode.findMany({ where: { code: { in: ancestorCodes } } })
    : [];
  const byCode = new Map(found.map((a) => [a.code, a]));
  const ancestors: TnvedCardAncestor[] = ancestorCodes
    .map((c) => byCode.get(c))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({
      code: a.code,
      codeDisplay: a.codeDisplay,
      titleRu: a.titleRu,
      level: a.level,
    }));
  return assembleTnvedCard({ row, ancestors });
}

function toOptionalDate(value: string | Date | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Upsert nomenclature rows (admin import). Rates optional per row. */
export async function upsertTnvedBatch(
  db: TnvedDb,
  rows: Array<TnvedCodeInput & { rate?: TnvedDutyRateInput }>
) {
  let upserted = 0;
  for (const row of rows) {
    const parsed = tnvedCodeSchema.parse(row);
    const code = normalizeHsCode(parsed.code)!;
    const validFrom = toOptionalDate(parsed.validFrom);
    const validTo = toOptionalDate(parsed.validTo);
    await db.tnvedCode.upsert({
      where: { code },
      create: {
        code,
        codeDisplay: parsed.codeDisplay || formatHsCode(code) || code,
        level: parsed.level,
        parentCode: parsed.parentCode ?? parentHsCode(code),
        titleRu: parsed.titleRu,
        titleEn: parsed.titleEn ?? null,
        isLeaf: parsed.isLeaf,
        isActive: parsed.isActive,
        notes: parsed.notes ?? null,
        ...(validFrom !== undefined ? { validFrom } : {}),
        ...(validTo !== undefined ? { validTo } : {}),
      },
      update: {
        codeDisplay: parsed.codeDisplay || formatHsCode(code) || code,
        level: parsed.level,
        parentCode: parsed.parentCode ?? parentHsCode(code),
        titleRu: parsed.titleRu,
        titleEn: parsed.titleEn ?? null,
        isLeaf: parsed.isLeaf,
        isActive: parsed.isActive,
        notes: parsed.notes ?? null,
        ...(validFrom !== undefined ? { validFrom } : {}),
        ...(validTo !== undefined ? { validTo } : {}),
      },
    });
    if (row.rate) {
      const rate = tnvedDutyRateSchema.parse({ ...row.rate, code });
      await db.tnvedDutyRate.create({
        data: {
          code,
          dutyKind: rate.dutyKind,
          dutyPct: rate.dutyPct ?? null,
          dutyRubPerUnit: rate.dutyRubPerUnit ?? null,
          vatPct: rate.vatPct ?? DEFAULT_IMPORT_VAT_PERCENT,
          feeHintRub: rate.feeHintRub ?? null,
          unit: rate.unit ?? null,
          source: rate.source ?? "import",
        },
      });
    }
    upserted += 1;
  }
  return { upserted };
}

/** Simplified admin form/CSV row → import item (level/parent/display derived). */
export type TnvedSimpleRow = {
  code: string;
  titleRu: string;
  dutyPct?: number | null;
  vatPct?: number | null;
  isLeaf?: boolean;
  titleEn?: string | null;
  notes?: string | null;
};

export type TnvedImportItem = TnvedCodeInput & { rate?: TnvedDutyRateInput };

export function buildTnvedImportItem(row: TnvedSimpleRow): TnvedImportItem {
  const code = normalizeHsCode(row.code);
  if (!code) throw new Error(`Некорректный код ТН ВЭД: ${row.code}`);
  const titleRu = String(row.titleRu || "").trim();
  if (!titleRu) throw new Error(`Пустое название для кода ${code}`);
  const level = hsCodeLevel(code)!;
  const item: TnvedImportItem = {
    code,
    codeDisplay: formatHsCode(code) || code,
    level,
    parentCode: parentHsCode(code),
    titleRu,
    titleEn: row.titleEn ?? null,
    isLeaf: row.isLeaf ?? code.length === 10,
    isActive: true,
    notes: row.notes ?? null,
  };
  const dutyPct =
    row.dutyPct === undefined || row.dutyPct === null || Number.isNaN(Number(row.dutyPct))
      ? undefined
      : Number(row.dutyPct);
  const vatPct =
    row.vatPct === undefined || row.vatPct === null || Number.isNaN(Number(row.vatPct))
      ? undefined
      : Number(row.vatPct);
  if (dutyPct !== undefined || vatPct !== undefined) {
    item.rate = {
      code,
      dutyKind: "AD_VALOREM",
      dutyPct: dutyPct ?? null,
      vatPct: vatPct ?? DEFAULT_IMPORT_VAT_PERCENT,
      source: "admin-ui",
    };
  }
  return item;
}

/**
 * CSV: header `code,titleRu[,dutyPct][,vatPct]` or positional columns.
 * Skips empty lines and `#` comments. Max 500 data rows.
 */
export function parseTnvedCsv(text: string): {
  items: TnvedImportItem[];
  errors: Array<{ line: number; message: string }>;
} {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (!lines.length) return { items: [], errors: [{ line: 0, message: "Пустой CSV" }] };

  let start = 0;
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes("code") && header.includes("title");
  if (hasHeader) start = 1;

  const items: TnvedImportItem[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  for (let i = start; i < lines.length; i++) {
    if (items.length >= 500) {
      errors.push({ line: i + 1, message: "Лимит 500 позиций" });
      break;
    }
    const parts = lines[i].split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
    const code = parts[0] || "";
    const titleRu = parts[1] || "";
    const dutyRaw = parts[2];
    const vatRaw = parts[3];
    try {
      items.push(
        buildTnvedImportItem({
          code,
          titleRu,
          dutyPct: dutyRaw === undefined || dutyRaw === "" ? undefined : Number(dutyRaw),
          vatPct: vatRaw === undefined || vatRaw === "" ? undefined : Number(vatRaw),
        })
      );
    } catch (e) {
      errors.push({ line: i + 1, message: e instanceof Error ? e.message : "Ошибка строки" });
    }
  }
  return { items, errors };
}
