import { dutyRate } from "./payments";
import { aliasByCode, matchAlias, normalizeQuery, type HsAlias } from "./hs-aliases";
import { formatHs, type HsRead } from "./hs-catalog";
import { classificationText, isGenericProductTitle, productTitle } from "./product-copy";
import { TNVED_GROUPS } from "./tnved-groups";

export type TnvedItem = { code: string; title: string };
export type TnvedData = { source: string; asOf: string; items: TnvedItem[] };

type Raw = { source: string; asOf: string; items: [string, string][] };
type IndexEntry = [string, string, string[], number];
type IndexRaw = { asOf: string; entries: IndexEntry[]; aliasTokens: Record<string, string[]> };

export type ClassifyResult = {
  hs: string;
  why: string;
  risk: string;
  conf: number;
};

let cache: Promise<TnvedData> | null = null;
let indexCache: Promise<IndexRaw> | null = null;
let inverted: Map<string, Map<string, number>> | null = null;
let titleByCode: Map<string, string> | null = null;

const STOP = new Set([
  "для", "или", "из", "на", "при", "без", "не", "и", "в", "с", "по", "от", "до", "the", "and", "for", "with",
]);

const TOKEN_MIN = 12;
const TOKEN_WEAK = 18;

export function loadTnved(): Promise<TnvedData> {
  if (!cache) {
    cache = fetch("/lbm-bro/data/tnved.json")
      .then((r) => {
        if (!r.ok) throw new Error("Не удалось загрузить справочник ТН ВЭД");
        return r.json() as Promise<Raw>;
      })
      .then((raw) => ({
        source: raw.source,
        asOf: raw.asOf,
        items: raw.items.map(([code, title]) => ({ code, title })),
      }));
  }
  return cache;
}

export function loadTnvedIndex(): Promise<IndexRaw> {
  if (!indexCache) {
    indexCache = fetch("/lbm-bro/data/tnved-index.json")
      .then((r) => {
        if (!r.ok) throw new Error("Не удалось загрузить индекс ТН ВЭД");
        return r.json() as Promise<IndexRaw>;
      })
      .then((raw) => {
        inverted = null;
        titleByCode = new Map(raw.entries.map(([code, title]) => [code, title]));
        ensureInverted(raw);
        return raw;
      });
  }
  return indexCache;
}

function digits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function queryTokens(text: string) {
  return normalizeQuery(text)
    .replace(/[^a-zа-я0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function ensureInverted(index: IndexRaw) {
  if (inverted) return inverted;
  const map = new Map<string, Map<string, number>>();
  for (const [code, , toks, generic] of index.entries) {
    for (const t of toks) {
      if (!map.has(t)) map.set(t, new Map());
      const row = map.get(t)!;
      row.set(code, Math.max(row.get(code) || 0, generic ? 3 : 8));
    }
  }
  for (const [tok, codes] of Object.entries(index.aliasTokens)) {
    if (!map.has(tok)) map.set(tok, new Map());
    const row = map.get(tok)!;
    for (const code of codes) row.set(code, Math.max(row.get(code) || 0, 15));
  }
  inverted = map;
  return map;
}

function headingOf(data: TnvedData, code: string) {
  const d = digits(code);
  if (d.length >= 6) {
    const sub = data.items.find((i) => i.code === d.slice(0, 6));
    if (sub) return sub;
  }
  if (d.length < 4) return null;
  return data.items.find((i) => i.code === d.slice(0, 4)) || null;
}

export function groupOf(code: string) {
  const d = digits(code).slice(0, 2);
  return TNVED_GROUPS.find((g) => g[0] === d) || null;
}

export function displayTitle(data: TnvedData, item: TnvedItem) {
  if (item.code.length <= 4) return item.title;
  const heading = headingOf(data, item.code);
  if (!heading || heading.title.toLowerCase() === item.title.toLowerCase()) return item.title;
  if (item.title.length < 56 || /^(прочие|другие|из |для |мужск|женск)/i.test(item.title)) {
    return `${heading.title} — ${item.title}`;
  }
  return item.title;
}

function itemByCode(data: TnvedData, code: string): TnvedItem | null {
  const d = digits(code);
  const exact = data.items.find((i) => i.code === d);
  if (exact) return exact;
  if (d.length === 9) return data.items.find((i) => i.code === `${d}0`) || null;
  const hits = data.items.filter((i) => i.code.startsWith(d) || d.startsWith(i.code));
  hits.sort((a, b) => {
    if (a.code.length !== b.code.length) return b.code.length - a.code.length;
    return b.title.length - a.title.length;
  });
  return hits[0] || null;
}

function confFromAlias(score: number) {
  return Math.min(94, 84 + Math.min(10, Math.floor(score / 8)));
}

function confFromTokens(score: number) {
  if (score >= TOKEN_WEAK + 8) return Math.min(88, 72 + Math.floor((score - TOKEN_WEAK) / 2));
  if (score >= TOKEN_WEAK) return Math.min(70, 58 + Math.floor((score - TOKEN_MIN) / 2));
  return 0;
}

function defaultWhy(data: TnvedData, item: TnvedItem) {
  return displayTitle(data, item);
}

function looksLikeHsCodeInput(raw: string, d: string) {
  const t = raw.trim();
  if (d.length >= 10) return true;
  if (d.length < 6) return false;
  const stripped = t.replace(/[\s.\-/]/g, "");
  if (/^\d+$/.test(stripped)) return true;
  if (/тн\s*вед|hs\s*code|код\s*тн/i.test(t) && d.length >= 4) return true;
  return false;
}

function classifyByCodeFromText(data: TnvedData, raw: string): ClassifyResult | null {
  const d = digits(raw);
  if (looksLikeHsCodeInput(raw, d)) {
    const hit = classifyByCode(data, raw);
    if (hit) return hit;
  }
  const m = raw.match(/\b(\d{4}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2})\b/);
  if (m) return classifyByCode(data, m[1]);
  return null;
}

function classifyByCode(data: TnvedData, raw: string): ClassifyResult | null {
  const d = digits(raw);
  if (d.length < 4) return null;
  const item = itemByCode(data, d);
  const code = item?.code || (d.length >= 10 ? d.slice(0, 10) : d.padEnd(10, "0").slice(0, 10));
  const codeDigits = digits(code);
  if (codeDigits.length < 6 && d.length < 10) return null;
  const alias = aliasByCode(code);
  const hs = formatHs(code);
  if (item) {
    const exact = d.length >= 10 && item.code === d.slice(0, 10);
    return {
      hs,
      why: defaultWhy(data, item),
      risk: alias?.risk || "Уточните описание товара",
      conf: exact ? 96 : item.code.length === 10 ? 94 : 92,
    };
  }
  if (alias) {
    return { hs, why: alias.why, risk: alias.risk, conf: 90 };
  }
  return null;
}

function classifyByAlias(data: TnvedData, raw: string): ClassifyResult | null {
  const title = productTitle(raw);
  const text = classificationText(raw);
  const titleHit = matchAlias(title);
  const textHit = text !== title ? matchAlias(text) : null;

  if (titleHit && !isGenericProductTitle(title)) {
    return aliasResult(data, titleHit);
  }

  if (titleHit && textHit && titleHit.alias.code !== textHit.alias.code) {
    if (titleHit.score >= textHit.score - 8) return aliasResult(data, titleHit);
    return aliasResult(data, textHit);
  }

  const hit = titleHit || textHit || matchAlias(raw);
  if (!hit) return null;
  return aliasResult(data, hit);
}

function aliasResult(_data: TnvedData, hit: { alias: HsAlias; score: number }): ClassifyResult {
  return {
    hs: formatHs(hit.alias.code),
    why: hit.alias.why,
    risk: hit.alias.risk,
    conf: confFromAlias(hit.score),
  };
}

function classifyByTokens(data: TnvedData, raw: string): ClassifyResult | null {
  if (!inverted) return null;
  const toks = queryTokens(raw);
  if (!toks.length) return null;
  const scores = new Map<string, number>();
  for (const t of toks) {
    const row = inverted.get(t);
    if (!row) continue;
    for (const [code, w] of row) {
      scores.set(code, (scores.get(code) || 0) + w);
    }
  }
  let bestCode = "";
  let bestScore = 0;
  for (const [code, score] of scores) {
    if (score > bestScore) {
      bestCode = code;
      bestScore = score;
    } else if (score === bestScore && bestCode) {
      const a = titleByCode?.get(code)?.length || 0;
      const b = titleByCode?.get(bestCode)?.length || 0;
      if (a > b) bestCode = code;
    }
  }
  if (!bestCode || bestScore < TOKEN_MIN) return null;
  const conf = confFromTokens(bestScore);
  if (!conf) return null;
  const item = itemByCode(data, bestCode) || { code: bestCode, title: titleByCode?.get(bestCode) || "" };
  const alias = aliasByCode(bestCode);
  return {
    hs: formatHs(bestCode),
    why: defaultWhy(data, item),
    risk: alias?.risk || "Уточните описание товара",
    conf,
  };
}

const EMPTY: ClassifyResult = {
  hs: "—",
  why: "По названию не хватило признаков для однозначного кода ТН ВЭД ЕАЭС. Уточните материал, назначение и состав.",
  risk: "Нужно уточнение",
  conf: 0,
};

export function classifyProduct(data: TnvedData, name: string): ClassifyResult {
  const raw = classificationText(name).trim() || (name || "").trim();
  if (!raw) return EMPTY;

  const byCode = classifyByCodeFromText(data, raw);
  if (byCode) return byCode;

  const byAlias = classifyByAlias(data, name);
  if (byAlias) return byAlias;

  if (!inverted) return EMPTY;
  return classifyByTokens(data, raw) || EMPTY;
}

export async function classifyProductAsync(data: TnvedData, name: string): Promise<ClassifyResult> {
  const raw = classificationText(name).trim() || (name || "").trim();
  if (!raw) return EMPTY;

  const byCode = classifyByCodeFromText(data, raw);
  if (byCode) return byCode;

  const byAlias = classifyByAlias(data, name);
  if (byAlias) return byAlias;

  const index = await loadTnvedIndex();
  ensureInverted(index);
  return classifyByTokens(data, raw) || EMPTY;
}

function catalogExtra(code: string) {
  return aliasByCode(code);
}

export type TnvedHit = HsRead & { code: string };

export function toHit(data: TnvedData, item: TnvedItem): TnvedHit {
  const extra = catalogExtra(item.code);
  const group = groupOf(item.code);
  const official = displayTitle(data, item);
  const hs = formatHs(item.code);
  const notes = [
    `Ориентир пошлины ${Math.round(dutyRate(hs) * 100)}%`,
    "НДС 20% считают в заявке",
    "Это позиция классификатора ТН ВЭД ЕАЭС, не решение ФТС",
  ];
  if (extra?.risk && extra.risk !== "Уточните описание товара") {
    notes.push(`Ориентир по рискам: ${extra.risk}`);
  }
  return {
    code: item.code,
    hs,
    title: official,
    group: group ? `${group[0]} — ${group[1]}` : `${item.code.slice(0, 2)} — группа ТН ВЭД`,
    why: official,
    notes,
    risk: extra?.risk || "Уточните описание товара",
    dutyPct: Math.round(dutyRate(hs) * 100),
    fromCatalog: Boolean(extra),
    score: extra ? 80 : 40,
  };
}

export function searchTnved(data: TnvedData, query: string): TnvedHit[] {
  const q = query.trim().toLowerCase().replace(/ё/g, "е");
  if (!q) return [];
  const d = digits(q);
  const scored: { item: TnvedItem; score: number }[] = [];

  if (d.length >= 2) {
    for (const item of data.items) {
      if (item.code.startsWith(d) || d.startsWith(item.code)) {
        const exact = item.code === d || item.code === `${d}0`;
        const lenClose = Math.abs(item.code.length - d.length);
        scored.push({ item, score: exact ? 1000 : 400 - lenClose * 8 - (item.code.length > 8 ? 0 : 20) });
      }
    }
  }

  if (d.length < 4) {
    for (const item of data.items) {
      const t = item.title.toLowerCase().replace(/ё/g, "е");
      if (!t.includes(q)) continue;
      const pos = t.indexOf(q);
      scored.push({ item, score: 120 - Math.min(pos, 40) + Math.min(item.title.length, 30) });
    }
  }

  const classified = classifyProduct(data, query);
  if (classified.hs !== "—") {
    const cd = digits(classified.hs);
    const item = data.items.find((i) => i.code === cd)
      || { code: cd, title: classified.why.split(".")[0] };
    scored.unshift({ item, score: 2000 });
  }

  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: TnvedHit[] = [];
  for (const row of scored) {
    if (seen.has(row.item.code)) continue;
    seen.add(row.item.code);
    out.push(toHit(data, row.item));
    if (out.length >= 40) break;
  }
  return out;
}

export function headingsInGroup(data: TnvedData, group: string) {
  return data.items.filter((i) => i.code.startsWith(group) && i.code.length === 4);
}

export function preloadClassifier() {
  return Promise.all([loadTnved(), loadTnvedIndex()]);
}
