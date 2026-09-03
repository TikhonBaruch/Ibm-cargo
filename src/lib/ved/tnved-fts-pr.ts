/**
 * FTS RF preliminary decisions (C39): parse workbooks, reconcile vs TnvedCode, actualize search notes.
 * Does not mutate titleRu.
 */
import { createHash } from "crypto";
import { mergeNotesWithSearchExtras } from "./tnved-lab-catalog";

export const FTS_PR_WHY_MARKER = "ФТС предварительные решения";

export type FtsPrRow = {
  code: string;
  description: string;
  country: string;
  justification: string;
  descFingerprint: string;
  rowIndex: number;
};

export type FtsPrWorkbook = {
  schemaKind: string;
  rows: FtsPrRow[];
  uniqueCodes: number;
};

const STOP = new Set(
  [
    "и", "или", "в", "во", "на", "по", "для", "из", "от", "до", "при", "с", "со", "к", "ко", "о", "об",
    "как", "что", "это", "его", "ее", "их", "они", "она", "он", "же", "бы", "ли", "не", "нет", "да",
    "шт", "кг", "мм", "см", "мл", "гц", "вт", "the", "and", "for", "with", "from",
    "товар", "товара", "товаров", "изделие", "изделия", "продукт", "продукция", "предназначен",
    "предназначена", "предназначено", "согласно", "классификации", "решение", "обоснование",
  ].map((s) => s.replace(/^ /, "")),
);

export function digits10(raw: unknown): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length === 10 ? d : "";
}

export function fingerprintDescription(desc: string): string {
  const norm = String(desc || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha1").update(norm).digest("hex");
}

export function parseAsOfFromFileName(name: string): Date | null {
  const cru = name.match(/CRU(20\d{6})/i);
  if (cru) {
    const s = cru[1];
    const y = Number(s.slice(0, 4));
    const m = Number(s.slice(4, 6));
    const d = Number(s.slice(6, 8));
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return new Date(Date.UTC(y, m - 1, d));
  }
  const cruRu = name.match(/C_RU_(\d{4})_(\d{2})/i);
  if (cruRu) {
    const y = Number(cruRu[1]);
    const m = Number(cruRu[2]);
    if (m >= 1 && m <= 12) return new Date(Date.UTC(y, m - 1, 1));
  }
  const dotted = name.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
  if (dotted) {
    let y = Number(dotted[3]);
    if (y < 100) y += 2000;
    const d = Number(dotted[1]);
    const m = Number(dotted[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return new Date(Date.UTC(y, m - 1, d));
  }
  return null;
}

function pickField(keys: string[], preds: RegExp[]): string | undefined {
  for (const re of preds) {
    const hit = keys.find((k) => re.test(k));
    if (hit) return hit;
  }
  return undefined;
}

export function schemaKindFromKeys(keys: string[]): string {
  const n = keys.map((k) => k.replace(/\s+/g, " ").trim());
  const has = (arr: string[]) => arr.every((x) => n.includes(x));
  if (
    has([
      "Код товара по ТН ВЭД ЕАЭС",
      "Описание товара",
      "Страна",
      "Обоснование принятия решения",
    ])
  ) {
    return "canon4";
  }
  if (has(["Код ТН ВЭД ЕАЭС", "Номер повтор.", "Описание", "Примечание"])) return "pr4";
  const joined = n.join("|").toLowerCase();
  if (/код/.test(joined) && /описан/.test(joined)) return "fuzzy_code_desc";
  return "other";
}

/** Map sheet_to_json objects → normalized rows. */
export function rowsFromSheetObjects(objs: Record<string, unknown>[]): FtsPrWorkbook {
  if (!objs.length) return { schemaKind: "empty", rows: [], uniqueCodes: 0 };
  const keys = Object.keys(objs[0] || {});
  const kind = schemaKindFromKeys(keys);
  const codeField =
    pickField(keys, [/код.*тн.*вэд/i, /tnved/i, /^код товара$/i, /код/i]) || keys[0];
  const descField =
    pickField(keys, [/описан.*товар/i, /^описание$/i, /ndescription/i, /описан/i]) || keys[1];
  const countryField = pickField(keys, [/страна/i, /country/i]);
  const whyField = pickField(keys, [/обоснован/i, /примечан/i, /reason/i]);

  const rows: FtsPrRow[] = [];
  const codes = new Set<string>();
  objs.forEach((o, i) => {
    const code = digits10(o[codeField]);
    const description = String(o[descField] ?? "").trim();
    if (!code || !description) return;
    codes.add(code);
    rows.push({
      code,
      description,
      country: countryField ? String(o[countryField] ?? "").trim() : "",
      justification: whyField ? String(o[whyField] ?? "").trim() : "",
      descFingerprint: fingerprintDescription(description),
      rowIndex: i + 1,
    });
  });
  return { schemaKind: kind, rows, uniqueCodes: codes.size };
}

/** Lexical tokens for TnvedCode.notes search overlay. */
export function tokensFromFtsDescription(desc: string, max = 24): string[] {
  const words = String(desc || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s-]/gi, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && w.length <= 48 && !STOP.has(w) && !/^\d+$/.test(w));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

export function stripFtsPrWhy(notes: string | null | undefined): string {
  const raw = String(notes || "").trim();
  if (!raw) return "";
  return raw
    .split(/\n+/)
    .filter((line) => !line.includes(FTS_PR_WHY_MARKER))
    .join("\n")
    .trim();
}

export function buildFtsPrNotesPatch(
  existingNotes: string | null | undefined,
  decisionCount: number,
  tokens: string[],
): string | undefined {
  const cleaned = stripFtsPrWhy(existingNotes);
  const why = `${FTS_PR_WHY_MARKER}: ${decisionCount} запис. в текущем срезе (overlay, не titleRu).`;
  return mergeNotesWithSearchExtras(cleaned || null, { why: [why], tokens });
}

export type ReconcileStats = {
  currentFile: string | null;
  decisionRows: number;
  uniqueCodes: number;
  missingInMain: string[];
  inactiveInMain: string[];
  presentActive: number;
};

export function summarizeReconcile(opts: {
  currentFile: string | null;
  codes: string[];
  main: Map<string, { isActive: boolean }>;
}): ReconcileStats {
  const uniq = [...new Set(opts.codes.filter(Boolean))];
  const missing: string[] = [];
  const inactive: string[] = [];
  let presentActive = 0;
  for (const code of uniq) {
    const row = opts.main.get(code);
    if (!row) missing.push(code);
    else if (!row.isActive) inactive.push(code);
    else presentActive++;
  }
  return {
    currentFile: opts.currentFile,
    decisionRows: opts.codes.length,
    uniqueCodes: uniq.length,
    missingInMain: missing.sort(),
    inactiveInMain: inactive.sort(),
    presentActive,
  };
}

/** Prefer latest CRU20YYMMDD.xls by name; else latest asOf. */
export function pickCurrentSourceFile(names: string[]): string | null {
  const cru = names
    .filter((n) => /^CRU20\d{6}/i.test(n) && /\.xlsx?$/i.test(n))
    .sort((a, b) => a.localeCompare(b));
  if (cru.length) return cru[cru.length - 1];
  return null;
}
