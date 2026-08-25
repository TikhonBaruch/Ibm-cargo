/** Mirror of src/lib/ved/precedent-suggest/query-guard.ts */

const MAX_LEN = 120;
const MIN_LETTERS = 2;

const BLOCKED_PATTERNS = [
  /\b(select|insert|update|delete|drop|union|alter|create|truncate|declare|exec|execute|benchmark|pg_sleep|sleep\s*\(|waitfor\s+delay)\b/i,
  /\b(information_schema|pg_catalog|sqlite_master)\b/i,
  /--|#|\/\*|\*\//,
  /;\s*\w/,
  /'\s*or\s*'|"\s*or\s*"|'\s*=\s*'|1\s*=\s*1/i,
  /\bchar\s*\(|0x[0-9a-f]{4,}/i,
  /<script|javascript:|onerror\s*=|onload\s*=|<\/script>/i,
  /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/,
];

function meaningfulCharCount(s) {
  let n = 0;
  for (const ch of s) {
    if (/[\p{L}\p{N}]/u.test(ch)) n += 1;
  }
  return n;
}

export function guardSuggestQuery(raw) {
  if (raw == null) return { ok: false, reason: "empty" };
  const query = String(raw).trim().replace(/\s+/g, " ");
  if (!query) return { ok: false, reason: "empty" };
  if (query.length > MAX_LEN) return { ok: false, reason: "too_long" };
  if (meaningfulCharCount(query) < MIN_LETTERS) {
    return { ok: false, reason: "too_short" };
  }
  for (const re of BLOCKED_PATTERNS) {
    if (re.test(query)) return { ok: false, reason: "blocked" };
  }
  return { ok: true, query };
}
