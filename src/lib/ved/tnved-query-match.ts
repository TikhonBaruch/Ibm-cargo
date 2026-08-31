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
 * P7: short C21 pack triggers (len ≤4) must not hitchhike longer unrelated tokens.
 * Canon: plan-hint-chains-precision-audit.md §P7.
 */
export const SHORT_TRIGGER_FALSE_FRIENDS: ReadonlyArray<{ stem: string; block: string }> = [
  { stem: "поло", block: "полотенц" },
  { stem: "кофе", block: "кофеин" },
  { stem: "крем", block: "брюле" },
  { stem: "крем", block: "brulee" },
  { stem: "pod", block: "ipod" },
  { stem: "pod", block: "airpod" },
];

/** Bare «перец» is spice/veg ambiguous (0904 vs 0709) — require sweet/bell qualifiers. */
export const PRODUCE_PEPPER_REQUIRE_QUALIFIER = true;

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

/** True when a short pack stem should be ignored because the query is a known hitchhike. */
export function isShortTriggerFalseFriend(stem: string, desc: string): boolean {
  const s = normalizeTnvedQueryText(stem);
  const q = normalizeTnvedQueryText(desc);
  if (!s || !q) return false;
  for (const { stem: st, block } of SHORT_TRIGGER_FALSE_FRIENDS) {
    if (s !== st) continue;
    if (q.includes(block) || hasTokenOrPrefix(q, block)) return true;
  }
  return false;
}

/**
 * P7 pack-trigger match policy:
 * - multi-word keys → substring (order as authored, e.g. «перец слад»)
 * - len ≤ 3 → exact token boundary only («лук», «чай»; no «луковица» via bare лук — use «луков»)
 * - len === 4 → token or prefix, minus SHORT_TRIGGER_FALSE_FRIENDS («поло»≠«полотенце»)
 * - len ≥ 5 → substring (existing C21 stems: огурц, помидор, …)
 */
export function packTriggerMatches(desc: string, raw: string): boolean {
  const q = normalizeTnvedQueryText(desc);
  const p = normalizeTnvedQueryText(raw).trim();
  if (!q || !p) return false;
  if (/\s/.test(p)) return q.includes(p);
  if (p.length <= 3) return hasTokenBoundary(q, p);
  if (p.length === 4) {
    if (isShortTriggerFalseFriend(p, q)) return false;
    return hasTokenBoundary(q, p) || hasTokenOrPrefix(q, p);
  }
  return q.includes(p);
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
