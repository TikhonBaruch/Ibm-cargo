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
