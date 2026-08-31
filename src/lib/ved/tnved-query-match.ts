/**
 * Shared TN VED query matching (H1–H2): household RU stems + false-friend guards.
 * Consumers: directory search, C21 packs (triggers), cascade (later).
 * Canon: docs/knowledge/plan-tnved-hint-chains-audit.md
 */

export const TNVED_SEARCH_STOP = new Set([
  "для",
  "или",
  "без",
  "the",
  "and",
  "for",
  "with",
  "from",
]);

/** Fixture-driven denylist: short produce stem must not hitchhike dairy notes. */
export const TNVED_FALSE_FRIEND_PAIRS: ReadonlyArray<{ query: string; block: string }> = [
  { query: "огур", block: "йогурт" },
  { query: "огур", block: "yogurt" },
  { query: "огур", block: "yoghurt" },
  { query: "огур", block: "кефир" },
];

/**
 * Coverage P0: plant-based «молоко/йогурт» must not map to dairy 04 / milk pack.
 * Canon: docs/knowledge/plan-hint-coverage-p0.md
 */
const PLANT_DAIRY_RE =
  /соев\w*|овсян\w*|миндальн\w*|кокосов\w*|рисов\w*|растительн\w*|plant[- ]?based|soy\s*(?:milk|yogurt|yoghurt)|oat\s*(?:milk|yogurt)|almond\s*(?:milk|yogurt)|coconut\s*(?:milk|yogurt)|rice\s*milk/i;

/** Input device «мышь», not PC — blocks computers pack / laptop attr. */
const POINTER_DEVICE_RE =
  /(?:^|[^a-zа-я0-9])мышь(?:$|[^a-zа-я0-9])|(?:^|[^a-zа-я0-9])mouse(?:$|[^a-zа-я0-9])/i;

export function isPlantDairyQuery(query: string): boolean {
  return PLANT_DAIRY_RE.test(normalizeTnvedQueryText(query));
}

export function isPointerDeviceQuery(query: string): boolean {
  return POINTER_DEVICE_RE.test(normalizeTnvedQueryText(query));
}

export function normalizeTnvedQueryText(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
}

/** RU household stem expansions — not a full morphological stemmer. */
export function householdStemVariants(token: string): string[] {
  const t = normalizeTnvedQueryText(token);
  if (t.length < 2) return [];
  const out: string[] = [t];

  // огурец → огурц (slice(-1) would wrongly yield «огуре»)
  if (t.endsWith("ец") && t.length >= 5) {
    out.push(`${t.slice(0, -2)}ц`);
  } else if (t.length >= 5) {
    // кепка → кепк; огурцы → огурц; помидоры → помидор
    out.push(t.slice(0, -1));
  }

  // носок → носк
  if (t.endsWith("ок") && t.length >= 5) {
    out.push(`${t.slice(0, -2)}к`);
  }
  // носки already covered by slice(-1) → носк

  if ((t.endsWith("ия") || t.endsWith("ие")) && t.length >= 5) {
    out.push(t.slice(0, -1));
  }

  if (t.length >= 8) {
    out.push(t.slice(0, -2));
  }

  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const v of out) {
    if (v.length < 2 || seen.has(v)) continue;
    seen.add(v);
    uniq.push(v);
  }
  return uniq;
}

export function tnvedQueryTokens(query: string): string[] {
  const q = normalizeTnvedQueryText(query);
  if (!q) return [];
  const words = q
    .replace(/[-_/\\,.;:()[\]{}+]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !TNVED_SEARCH_STOP.has(w));
  if (words.length) return words;
  if (q.length >= 2 && !TNVED_SEARCH_STOP.has(q)) return [q];
  return [];
}

/** Stems for SQL contains + scoring (H1). */
export function tnvedQueryStems(query: string): string[] {
  const tokens = tnvedQueryTokens(query);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    for (const v of householdStemVariants(t)) {
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `stem` appears as a whole token / word-boundary in text. */
export function hasTokenBoundary(text: string, stem: string): boolean {
  const hay = normalizeTnvedQueryText(text);
  const s = normalizeTnvedQueryText(stem);
  if (!hay || !s) return false;
  return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(s)}(?:$|[^a-zа-я0-9])`, "i").test(hay);
}

/** Token boundary or prefix of a token (stem «огурц» ↔ title «Огурцы»). */
export function hasTokenOrPrefix(text: string, stem: string): boolean {
  const hay = normalizeTnvedQueryText(text);
  const s = normalizeTnvedQueryText(stem);
  if (!hay || !s) return false;
  if (hasTokenBoundary(hay, s)) return true;
  return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(s)}[a-zа-я0-9]*`, "i").test(hay);
}

export function isFalseFriendPair(query: string, hitText: string): boolean {
  const q = normalizeTnvedQueryText(query);
  const hit = normalizeTnvedQueryText(hitText);
  if (!q || !hit) return false;
  for (const { query: qq, block } of TNVED_FALSE_FRIEND_PAIRS) {
    // Query must look like the short produce family — not «йогурт» itself containing «огур».
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

/**
 * Notes match quality for one stem.
 * Short stems (<5): substring-only hit does not count (false-friend class).
 */
export function notesStemMatchKind(
  notes: string,
  stem: string
): "token" | "substring" | null {
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
