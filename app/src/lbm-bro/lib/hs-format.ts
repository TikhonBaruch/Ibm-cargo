function digits(v: string) {
  return (v || "").replace(/\D/g, "");
}

export function normalizeQuery(v: string) {
  return (v || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[-_/\\,.;:()[\]{}+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatHs(raw: string) {
  const d = digits(raw).slice(0, 10);
  if (d.length < 4) return raw.trim();
  const a = d.slice(0, 4);
  const b = d.slice(4, 6);
  const c = d.slice(6, 9);
  const e = d.slice(9, 10);
  return [a, b, c, e].filter(Boolean).join(" ");
}
