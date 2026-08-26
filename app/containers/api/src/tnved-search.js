/**
 * Ranked TN VED directory search (mirrors src/lib/ved/tnved.ts searchTnvedCodes).
 * Emits { items, ranked: true } so Next dual-path accepts the domain response.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HS_ALIASES = (() => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "hs-aliases.json"),
    path.join(here, "../../../src/lbm-bro/lib/hs-aliases.json"),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      /* try next */
    }
  }
  return [];
})();

const SEARCH_EXPAND_FALLBACK = [
  { test: /ноутбук|laptop|notebook|macbook|нетбук|thinkpad/i, tokens: ["портативн", "вычислительн"], prefixes: ["847130"] },
  { test: /смартфон|телефон|iphone|android|mobile\s*phone/i, tokens: ["телефон"], prefixes: ["8517"] },
  { test: /футболка|t-?shirt|поло|майка/i, tokens: ["футболк", "майк", "нательн"], prefixes: ["6109", "6105"] },
  { test: /кроссов|кеды|sneakers|обув/i, tokens: ["обув"], prefixes: ["6404", "6402"] },
  { test: /фильтр.*(масл|oil)|oil\s*filter/i, tokens: ["фильтр"], prefixes: ["8421"] },
];

function digits(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeQuery(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[-_/\\,.;:()[\]{}+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWord(query, key) {
  return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(key)}(?:$|[^a-zа-я0-9])`, "i").test(query);
}

function keyHits(query, raw) {
  const whole = String(raw).startsWith("=");
  const key = normalizeQuery(whole ? String(raw).slice(1) : raw);
  if (!key) return false;
  if (whole || key.length <= 3) return wholeWord(query, key);
  return query.includes(key);
}

function scoreAlias(query, alias) {
  if ((alias.exclude || []).some((k) => keyHits(query, k))) return 0;
  let score = 0;
  for (const k of alias.keys || []) {
    if (!keyHits(query, k)) continue;
    const len = normalizeQuery(String(k).startsWith("=") ? String(k).slice(1) : k).length;
    score += 10 + len * 4;
    if (len >= 10) score += 8;
  }
  return score;
}

function matchAlias(query, minScore = 14) {
  const q = normalizeQuery(query);
  if (!q) return null;
  let best = null;
  let bestScore = 0;
  for (const alias of HS_ALIASES) {
    const s = scoreAlias(q, alias);
    if (s > bestScore) {
      best = alias;
      bestScore = s;
    }
  }
  if (!best || bestScore < minScore) return null;
  return { alias: best, score: bestScore };
}

function expandFromAliases(query, minScore = 10) {
  const q = normalizeQuery(query);
  const expandPrefixes = [];
  const expandTokens = [];
  const hits = [];
  if (!q) return { expandPrefixes, expandTokens, hits };
  for (const alias of HS_ALIASES) {
    const s = scoreAlias(q, alias);
    if (s < minScore) continue;
    hits.push({ alias, score: s });
    const code = digits(alias.code);
    if (code.length >= 4) expandPrefixes.push(code.slice(0, Math.min(6, code.length)));
    for (const k of alias.keys || []) {
      const tok = normalizeQuery(String(k).startsWith("=") ? String(k).slice(1) : k);
      if (tok.length >= 4) expandTokens.push(tok.slice(0, Math.min(tok.length, 12)));
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return {
    expandPrefixes: [...new Set(expandPrefixes)],
    expandTokens: [...new Set(expandTokens)].slice(0, 12),
    hits,
  };
}

function expandForQuery(q) {
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

function normalizeSearchText(s) {
  return String(s || "").toLowerCase().replace(/ё/g, "е");
}

function scoreTnvedSearchHit(row, opts) {
  const title = normalizeSearchText(row.titleRu);
  const notes = normalizeSearchText(row.notes);
  const q = normalizeSearchText(opts.q);
  let score = 0;
  const pin = opts.pinCode ? digits(opts.pinCode) : "";
  if (pin && (row.code === pin || row.code.startsWith(pin) || pin.startsWith(row.code))) {
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
  score += row.level || 0;
  return score;
}

function matchKindForHit(row, score, opts) {
  const pin = opts.pinCode ? digits(opts.pinCode) : "";
  if (pin && (row.code === pin || row.code.startsWith(pin.slice(0, 6)))) return "alias";
  if (opts.digits.length >= 2 && (row.code.startsWith(opts.digits) || opts.digits.startsWith(row.code))) {
    return "code";
  }
  if ((opts.expandPrefixes || []).some((p) => row.code.startsWith(p)) && score >= 200) return "expand";
  return "title";
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ q?: string, limit?: number, leafOnly?: boolean, codePrefix?: string, level?: number }} opts
 */
export async function searchTnvedCodesRanked(prisma, opts) {
  const q = String(opts.q || "").trim();
  const codePrefix = digits(opts.codePrefix || "");
  if (!q && !codePrefix) return { items: [], ranked: true };

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const dig = digits(q);
  const { expandPrefixes, expandTokens, aliasHits } = expandForQuery(q);
  const pinHit = matchAlias(q);
  const pinCode = pinHit?.alias?.code || null;

  const or = [];
  if (q) {
    or.push({ titleRu: { contains: q, mode: "insensitive" } });
    or.push({ notes: { contains: q, mode: "insensitive" } });
  }
  if (dig.length >= 2) or.push({ code: { startsWith: dig } });
  if (pinCode) {
    or.push({ code: { startsWith: pinCode.slice(0, Math.min(6, pinCode.length)) } });
    or.push({ code: pinCode });
  }
  for (const p of expandPrefixes) or.push({ code: { startsWith: p } });
  for (const tok of expandTokens) or.push({ titleRu: { contains: tok, mode: "insensitive" } });

  const where = {
    isActive: true,
    ...(opts.leafOnly ? { isLeaf: true } : {}),
    ...(opts.level ? { level: opts.level } : {}),
    ...(codePrefix ? { code: { startsWith: codePrefix } } : {}),
  };
  if (or.length) where.OR = or;

  const pool = Math.min(Math.max(limit * 4, 40), 120);
  let rows = await prisma.tnvedCode.findMany({
    where,
    take: pool,
    orderBy: [{ level: "desc" }, { code: "asc" }],
  });

  if (pinCode && !rows.some((r) => r.code === pinCode || r.code.startsWith(pinCode.slice(0, 6)))) {
    const pinned = await prisma.tnvedCode.findMany({
      where: {
        isActive: true,
        OR: [{ code: pinCode }, { code: { startsWith: pinCode.slice(0, 6) } }],
        ...(opts.leafOnly ? { isLeaf: true } : {}),
      },
      take: 8,
      orderBy: [{ level: "desc" }, { code: "asc" }],
    });
    const seen = new Set(rows.map((r) => r.code));
    rows = [...rows, ...pinned.filter((r) => !seen.has(r.code))];
  }

  const scoreOpts = { q, digits: dig, expandPrefixes, expandTokens, pinCode };
  const ranked = rows
    .map((row) => ({ row, score: scoreTnvedSearchHit(row, scoreOpts) }))
    .sort((a, b) => b.score - a.score || b.row.level - a.row.level || a.row.code.localeCompare(b.row.code));

  const topAlias = pinHit?.alias || aliasHits[0]?.alias || null;
  const items = ranked.slice(0, limit).map((r) => {
    const kind = matchKindForHit(r.row, r.score, {
      digits: dig,
      pinCode,
      expandPrefixes,
    });
    const matchMeta = {
      score: r.score,
      kind,
      ...(kind === "alias" && topAlias ? { why: topAlias.why, risk: topAlias.risk } : {}),
    };
    return {
      code: r.row.code,
      codeDisplay: r.row.codeDisplay,
      titleRu: r.row.titleRu,
      notes: r.row.notes,
      level: r.row.level,
      isLeaf: r.row.isLeaf,
      matchMeta,
    };
  });

  return { items, ranked: true };
}

export async function listTnvedChapters(prisma) {
  const items = await prisma.tnvedCode.findMany({
    where: { isActive: true, level: 2 },
    orderBy: { code: "asc" },
    select: { code: true, codeDisplay: true, titleRu: true },
  });
  return { items, count: items.length };
}
