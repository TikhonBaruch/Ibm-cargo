import { formatHsCode } from "@/lib/ved/tnved";

export const DIRECTORY_HINTS_MIN_Q = 2;
export const DIRECTORY_HINTS_LIMIT = 5;

/** First line of the goods field, or null if too short for directory search. */
export function directoryHintsQuery(raw: string): string | null {
  const first =
    String(raw || "")
      .split("\n")[0]
      ?.trim()
      .replace(/\s+/g, " ") || "";
  if (first.length < DIRECTORY_HINTS_MIN_Q) return null;
  return first.slice(0, 120);
}

export function shouldShowDirectoryHints(input: {
  enabled: boolean;
  query: string;
}): boolean {
  return Boolean(input.enabled && directoryHintsQuery(input.query));
}

/** Persist the same display form as directory → new calc (`8471 30 000 0`). */
export function directoryHintHsHint(code: string): string {
  const trimmed = String(code || "").trim();
  return formatHsCode(trimmed) || trimmed;
}

export function isSameDirectoryHint(applied: string | undefined, code: string): boolean {
  const a = String(applied || "").replace(/\D/g, "");
  const b = String(code || "").replace(/\D/g, "");
  return Boolean(a && b && a === b);
}
