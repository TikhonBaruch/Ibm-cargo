/** Mirror of src/lib/ved/verified-determinations.ts lexical helpers */

export function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9]+/i)
    .filter((t) => t.length >= 3);
}

export function lexicalScore(query, candidate) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const cSet = new Set(tokenize(candidate));
  let hits = 0;
  for (const t of qTokens) {
    if (cSet.has(t)) hits += 1;
  }
  return hits / qTokens.length;
}
