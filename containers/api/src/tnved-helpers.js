/** HS helpers — keep in sync with src/lib/ved/tnved.ts */

export function normalizeHsCode(input) {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (![2, 4, 6, 8, 10].includes(digits.length)) return null;
  return digits;
}

export function tnvedSearchStems(query) {
  const q = String(query || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
  if (!q) return [];
  const words = q
    .replace(/[-_/\\,.;:()[\]{}+]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const tokens = words.length ? words : q.length >= 2 ? [q] : [];
  const out = [];
  const seen = new Set();
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

export function scoreTnvedSearchHit(row, { stems, digits }) {
  const notes = String(row.notes || "")
    .toLowerCase()
    .replace(/ё/g, "е");
  const title = String(row.titleRu || "")
    .toLowerCase()
    .replace(/ё/g, "е");
  const lead = notes.split(/\n+/)[0] || "";
  const noteParts = notes.split(/[,\n;]+/).map((p) => p.trim()).filter(Boolean);
  let score = 0;
  if (/[.!?]/.test(lead) && lead.length >= 24) score += 40;
  for (const s of stems || []) {
    if (!s) continue;
    if (noteParts.some((p) => p === s || p.startsWith(`${s} `) || p.startsWith(`${s},`))) score += 80;
    else if (notes.includes(s)) score += 25;
    if (title.includes(s)) {
      const word = new RegExp(`(?:^|[^а-яa-z0-9])${s}(?:[^а-яa-z0-9]|$)`, "i");
      score += word.test(title) ? 35 : 8;
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
  return {
    isActive: true,
    OR: or,
    ...(leafOnly ? { isLeaf: true } : {}),
  };
}
