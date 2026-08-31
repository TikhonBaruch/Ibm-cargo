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
  const lead = notes.split(/\n+/)[0] || "";
  const full = String(phrase || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
  const queryForFriends = full || (stems || []).join(" ");

  if (isFalseFriendPair(queryForFriends, `${notes}\n${title}`)) {
    let score = 0;
    if (digits && digits.length >= 2 && String(row.code || "").startsWith(digits)) {
      score += 100;
      if (row.code === digits) score += 50;
    }
    if (row.isLeaf) score += 15;
    score += Number(row.level || 0);
    return score;
  }

  let score = 0;
  if (/[.!?]/.test(lead) && lead.length >= 24) score += 40;
  if (full.length >= 5 && notes.includes(full)) score += 90;
  else if (full.length >= 2 && full.length < 5 && /[\u4e00-\u9fff]/.test(full) && notes.includes(full)) {
    score += 90;
  }
  for (const s of stems || []) {
    if (!s) continue;
    const kind = notesStemMatchKind(notes, s);
    if (kind === "token") score += 80;
    else if (kind === "substring") score += 25;
    if (title.includes(s)) {
      score += hasTokenOrPrefix(title, s) ? 35 : 8;
    }
  }
  if (digits && digits.length >= 2 && String(row.code || "").startsWith(digits)) {
    score += 100;
    if (row.code === digits) score += 50;
  }
  if (row.isLeaf) score += 15;
  score += Number(row.level || 0);
  return score;
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
  const stems = codeOnly ? [digits] : tnvedSearchStems(q);
  const or = [];
  if (digits.length >= 2) or.push({ code: { startsWith: digits } });
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
