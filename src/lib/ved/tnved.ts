/**
 * TN VED (HS) code helpers + directory shape (D24).
 * Storage PK = digits only; display uses spaced Russian 10-digit form.
 */
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { DEFAULT_IMPORT_VAT_PERCENT } from "./customs-fees";
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
  q: string;
  limit?: number;
  leafOnly?: boolean;
  /** 4-digit headings in a 2-digit chapter (lab group browse). */
  headingOnly?: boolean;
};

type TnvedDb = Pick<Prisma.TransactionClient, "tnvedCode" | "tnvedDutyRate">;

export async function countActiveTnvedCodes(db: Pick<Prisma.TransactionClient, "tnvedCode">) {
  return db.tnvedCode.count({ where: { isActive: true } });
}

export async function countTnvedDirectoryStats(db: Pick<Prisma.TransactionClient, "tnvedCode">) {
  const [total, leaves, variations] = await Promise.all([
    db.tnvedCode.count({ where: { isActive: true } }),
    db.tnvedCode.count({ where: { isActive: true, isLeaf: true } }),
    db.tnvedCode.count({ where: { isActive: true, notes: { not: null } } }),
  ]);
  return { total, leaves, variations };
}

/** Stems so «футболка» hits notes token «футболк» (lab alias keys). */
const TNVED_SEARCH_STOP = new Set(["для", "или", "без", "the", "and", "for", "with", "from"]);

export function tnvedSearchStems(query: string): string[] {
  const q = String(query || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
  if (!q) return [];
  const words = q
    .replace(/[-_/\\,.;:()[\]{}+]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !TNVED_SEARCH_STOP.has(w));
  const tokens = words.length ? words : q.length >= 2 ? [q] : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const variants = [t];
    if (t.length >= 6) variants.push(t.slice(0, -1));
    if (t.length >= 8) variants.push(t.slice(0, -2));
    for (const v of variants) {
      if (v.length < 2 || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export function scoreTnvedSearchHit(
  row: { code: string; titleRu?: string | null; notes?: string | null; isLeaf?: boolean; level?: number },
  opts: { stems: string[]; digits: string; phrase?: string },
): number {
  const notes = String(row.notes || "")
    .toLowerCase()
    .replace(/ё/g, "е");
  const title = String(row.titleRu || "")
    .toLowerCase()
    .replace(/ё/g, "е");
  const lead = notes.split(/\n+/)[0] || "";
  const noteParts = notes.split(/[,\n;]+/).map((p) => p.trim()).filter(Boolean);
  const phrase = String(opts.phrase || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
  let score = 0;
  if (/[.!?]/.test(lead) && lead.length >= 24) score += 40;
  if (phrase.length >= 5 && notes.includes(phrase)) score += 90;
  for (const s of opts.stems) {
    if (!s) continue;
    if (noteParts.some((p) => p === s || p.startsWith(`${s} `) || p.startsWith(`${s},`))) score += 80;
    else if (notes.includes(s)) score += 25;
    if (title.includes(s)) {
      const word = new RegExp(`(?:^|[^а-яa-z0-9])${s}(?:[^а-яa-z0-9]|$)`, "i");
      score += word.test(title) ? 35 : 8;
    }
  }
  if (opts.digits.length >= 2 && row.code.startsWith(opts.digits)) {
    score += 100;
    if (row.code === opts.digits) score += 50;
  }
  if (row.isLeaf) score += 15;
  score += Number(row.level || 0);
  return score;
}

/** Directory search by code prefix and/or titleRu / notes (D-TNVED). */
export async function searchTnvedCodes(db: TnvedDb, opts: TnvedSearchOpts) {
  const q = String(opts.q || "").trim();
  if (!q) return [];
  const cap = opts.headingOnly ? 200 : 50;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), cap);
  const digits = q.replace(/\D/g, "");
  const codeOnly = digits.length >= 2 && /^[\d\s./-]+$/.test(q);

  if (opts.headingOnly && digits.length >= 2) {
    return db.tnvedCode.findMany({
      where: {
        isActive: true,
        level: 4,
        code: { startsWith: digits.slice(0, 2) },
      },
      take: limit,
      orderBy: { code: "asc" },
    });
  }

  const stems = codeOnly ? [digits] : tnvedSearchStems(q);
  const or: Array<Record<string, unknown>> = [];
  if (digits.length >= 2) {
    or.push({ code: { startsWith: digits } });
  }
  for (const stem of stems.length ? stems : [q]) {
    or.push({ titleRu: { contains: stem, mode: "insensitive" } });
    or.push({ notes: { contains: stem, mode: "insensitive" } });
  }
  if (!codeOnly && q.length >= 4) {
    or.push({ notes: { contains: q, mode: "insensitive" } });
    or.push({ titleRu: { contains: q, mode: "insensitive" } });
  }
  const pool = codeOnly ? Math.min(50, Math.max(limit * 4, 24)) : 500;
  const rows = await db.tnvedCode.findMany({
    where: {
      isActive: true,
      OR: or,
      ...(opts.leafOnly ? { isLeaf: true } : {}),
    },
    take: pool,
    orderBy: [{ level: "desc" }, { code: "asc" }],
  });
  return [...rows]
    .sort((a, b) => {
      const d = scoreTnvedSearchHit(b, { stems: stems.length ? stems : [q], digits, phrase: q })
        - scoreTnvedSearchHit(a, { stems: stems.length ? stems : [q], digits, phrase: q });
      return d || a.code.localeCompare(b.code);
    })
    .slice(0, limit);
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
        ...(parsed.notes !== undefined ? { notes: parsed.notes ?? null } : {}),
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
        ...(parsed.notes !== undefined ? { notes: parsed.notes ?? null } : {}),
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
