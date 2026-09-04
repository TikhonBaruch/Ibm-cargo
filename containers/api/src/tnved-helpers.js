/** HS helpers — keep in sync with src/lib/ved/tnved.ts + tnved-query-match.ts */

export function normalizeHsCode(input) {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (![2, 4, 6, 8, 10].includes(digits.length)) return null;
  return digits;
}

export function formatHsCode(code) {
  const digits = normalizeHsCode(code);
  if (!digits) return null;
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  const parts = [];
  for (let i = 0; i < digits.length; i += 2) {
    parts.push(digits.slice(i, i + 2));
  }
  return parts.join(" ");
}

const TNVED_SEARCH_STOP = new Set(["для", "или", "без", "the", "and", "for", "with", "from"]);
const TNVED_FALSE_FRIEND_PAIRS = [
  { query: "огур", block: "йогурт" },
  { query: "огур", block: "yogurt" },
  { query: "огур", block: "yoghurt" },
  { query: "огур", block: "кефир" },
];

/** Keep in sync with src/lib/ved/tnved-query-match.ts TNVED_SEARCH_ALIASES */
const TNVED_SEARCH_ALIASES = [
  {
    id: "mors-drink",
    test: /(?:^|[^\p{L}\p{N}])морс(?:ы|а|ом|у)?(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "2202",
    expandStems: ["морс", "напитк"],
    blockHit: /морск/i,
  },
  {
    id: "hdd",
    test: /(?:^|[^\p{L}\p{N}])hdd(?:$|[^\p{L}\p{N}])|ж[её]стк[а-яё]*\s+диск|винчестер|hard\s*disk|hard\s*drive/iu,
    codePrefix: "8471",
    expandStems: ["жестк", "накопител", "винчестер"],
  },
  {
    id: "laptop",
    test: /ноутбук|laptop|notebook|macbook|портативн\w*\s+вычисл/iu,
    codePrefix: "847130",
    expandStems: ["ноутбук", "laptop", "notebook", "портативн"],
  },
];

export function resolveTnvedSearchAlias(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  return TNVED_SEARCH_ALIASES.find((a) => a.test.test(q)) || null;
}

function normalizeTnvedQueryText(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function householdStemVariants(token) {
  const t = normalizeTnvedQueryText(token);
  if (t.length < 2) return [];
  const out = [t];
  if (t.endsWith("ец") && t.length >= 5) {
    out.push(`${t.slice(0, -2)}ц`);
  } else if (t.length >= 5) {
    out.push(t.slice(0, -1));
  }
  if (t.endsWith("ок") && t.length >= 5) {
    out.push(`${t.slice(0, -2)}к`);
  }
  if ((t.endsWith("ия") || t.endsWith("ие")) && t.length >= 5) {
    out.push(t.slice(0, -1));
  }
  if (t.length >= 8) out.push(t.slice(0, -2));
  const seen = new Set();
  const uniq = [];
  for (const v of out) {
    if (v.length < 2 || seen.has(v)) continue;
    seen.add(v);
    uniq.push(v);
  }
  return uniq;
}

export function tnvedSearchStems(query) {
  const q = normalizeTnvedQueryText(query);
  if (!q) return [];
  const words = q
    .replace(/[-_/\\,.;:()[\]{}+]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !TNVED_SEARCH_STOP.has(w));
  const tokens = words.length ? words : q.length >= 2 && !TNVED_SEARCH_STOP.has(q) ? [q] : [];
  const out = [];
  const seen = new Set();
  for (const t of tokens) {
    for (const v of householdStemVariants(t)) {
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function hasTokenBoundary(text, stem) {
  const hay = normalizeTnvedQueryText(text);
  const s = normalizeTnvedQueryText(stem);
  if (!hay || !s) return false;
  return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(s)}(?:$|[^a-zа-я0-9])`, "i").test(hay);
}

function hasTokenOrPrefix(text, stem) {
  const hay = normalizeTnvedQueryText(text);
  const s = normalizeTnvedQueryText(stem);
  if (!hay || !s) return false;
  if (hasTokenBoundary(hay, s)) return true;
  return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(s)}[a-zа-я0-9]*`, "i").test(hay);
}

function isFalseFriendPair(query, hitText) {
  const q = normalizeTnvedQueryText(query);
  const hit = normalizeTnvedQueryText(hitText);
  if (!q || !hit) return false;
  for (const { query: qq, block } of TNVED_FALSE_FRIEND_PAIRS) {
    const queryIsFamily =
      hasTokenOrPrefix(q, qq) || q.includes("огурец") || q.includes("огурц") || q === qq;
    if (!queryIsFamily) continue;
    if (!hit.includes(block)) continue;
    if (!hasTokenOrPrefix(hit, qq) && !hit.includes("огурец") && !hit.includes("огурц")) {
      return true;
    }
  }
  return false;
}

function notesStemMatchKind(notes, stem) {
  const n = normalizeTnvedQueryText(notes);
  const s = normalizeTnvedQueryText(stem);
  if (!n || !s) return null;
  const noteParts = n.split(/[,\n;]+/).map((p) => p.trim()).filter(Boolean);
  if (
    noteParts.some(
      (p) => p === s || p.startsWith(`${s} `) || p.startsWith(`${s},`) || hasTokenOrPrefix(p, s)
    ) ||
    hasTokenOrPrefix(n, s)
  ) {
    return "token";
  }
  if (n.includes(s)) {
    if (s.length < 5) return null;
    return "substring";
  }
  return null;
}

export function scoreTnvedSearchHit(row, { stems, digits, phrase }) {
  const notes = String(row.notes || "")
    .toLowerCase()
    .replace(/ё/g, "е");
  const title = String(row.titleRu || "")
    .toLowerCase()
    .replace(/ё/g, "е");
  const hitText = `${notes}\n${title}`;
  const lead = notes.split(/\n+/)[0] || "";
  const full = String(phrase || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
  const queryForFriends = full || (stems || []).join(" ");
  const alias = resolveTnvedSearchAlias(phrase || queryForFriends);
  const aliasBlocked = Boolean(alias?.blockHit?.test(hitText));

  if (isFalseFriendPair(queryForFriends, hitText) || aliasBlocked) {
    let score = 0;
    if (digits && digits.length >= 2 && String(row.code || "").startsWith(digits)) {
      score += 100;
      if (row.code === digits) score += 50;
    }
    if (alias && String(row.code || "").startsWith(alias.codePrefix)) score += 120;
    if (row.isLeaf) score += 15;
    score += Number(row.level || 0);
    return score;
  }

  let score = 0;
  if (/[.!?]/.test(lead) && lead.length >= 24) score += 8;
  if (full.length >= 5 && notes.includes(full) && hasTokenOrPrefix(notes, full)) {
    score += 35;
  } else if (full.length >= 2 && full.length < 5 && /[\u4e00-\u9fff]/.test(full) && notes.includes(full)) {
    score += 35;
  }
  for (const s of stems || []) {
    if (!s) continue;
    if (s.length <= 4 ? hasTokenBoundary(title, s) : hasTokenOrPrefix(title, s)) score += 55;
    if (s.length <= 4 ? hasTokenBoundary(notes, s) : notesStemMatchKind(notes, s) === "token") {
      score += 18;
    }
  }
  if (digits && digits.length >= 2 && String(row.code || "").startsWith(digits)) {
    score += 100;
    if (row.code === digits) score += 50;
  }
  if (alias && String(row.code || "").startsWith(alias.codePrefix)) score += 120;
  if (row.isLeaf) score += 15;
  score += Number(row.level || 0);
  return score;
}

export function tnvedSearchRowHasWholeWordHit(row, { stems, digits, phrase, aliasPrefix }) {
  if (digits && digits.length >= 2 && String(row.code || "").startsWith(digits)) return true;
  if (aliasPrefix && String(row.code || "").startsWith(aliasPrefix)) return true;
  const title = String(row.titleRu || "");
  const notes = String(row.notes || "");
  const full = String(phrase || "").trim();
  if (full.length >= 2 && /[\u4e00-\u9fff]/.test(full) && notes.toLowerCase().includes(full.toLowerCase())) {
    return true;
  }
  if (full.length >= 4) {
    if (hasTokenOrPrefix(title, full) || hasTokenOrPrefix(notes, full)) return true;
  }
  for (const s of stems || []) {
    if (!s) continue;
    if (s.length <= 4 ? hasTokenBoundary(title, s) : hasTokenOrPrefix(title, s)) return true;
    if (s.length <= 4 ? hasTokenBoundary(notes, s) : notesStemMatchKind(notes, s) === "token") {
      return true;
    }
  }
  return false;
}

export function tnvedSearchWhere(q, { leafOnly = false, headingOnly = false } = {}) {
  const digits = String(q || "").replace(/\D/g, "");
  const codeOnly = digits.length >= 2 && /^[\d\s./-]+$/.test(String(q || "").trim());
  if (headingOnly && digits.length >= 2) {
    return {
      isActive: true,
      level: 4,
      code: { startsWith: digits.slice(0, 2) },
    };
  }
  const stemsRaw = codeOnly ? [digits] : tnvedSearchStems(q);
  const alias = codeOnly ? null : resolveTnvedSearchAlias(q);
  const stems = [...stemsRaw];
  if (alias?.expandStems) {
    for (const s of alias.expandStems) {
      if (s && !stems.includes(s)) stems.push(s);
    }
  }
  const or = [];
  if (digits.length >= 2) or.push({ code: { startsWith: digits } });
  if (alias?.codePrefix) or.push({ code: { startsWith: alias.codePrefix } });
  for (const stem of stems.length ? stems : [q]) {
    or.push({ titleRu: { contains: stem, mode: "insensitive" } });
    or.push({ notes: { contains: stem, mode: "insensitive" } });
  }
  if (!codeOnly && String(q || "").trim().length >= 4) {
    or.push({ notes: { contains: q, mode: "insensitive" } });
    or.push({ titleRu: { contains: q, mode: "insensitive" } });
  }
  return {
    isActive: true,
    OR: or,
    ...(leafOnly ? { isLeaf: true } : {}),
  };
}

/** Stems used for ranking — same expand as tnvedSearchWhere. */
export function tnvedSearchStemsForRank(q) {
  const digits = String(q || "").replace(/\D/g, "");
  const codeOnly = digits.length >= 2 && /^[\d\s./-]+$/.test(String(q || "").trim());
  if (codeOnly) return [digits];
  const stems = [...tnvedSearchStems(q)];
  const alias = resolveTnvedSearchAlias(q);
  if (alias?.expandStems) {
    for (const s of alias.expandStems) {
      if (s && !stems.includes(s)) stems.push(s);
    }
  }
  return stems;
}
