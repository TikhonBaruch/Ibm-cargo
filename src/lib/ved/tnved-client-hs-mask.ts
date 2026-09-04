/**
 * Client cabinet: mask 10-digit HS after the first 3 digits (UI blur + • in DOM).
 * Canon: docs/knowledge/plan-tnved-client-hs-blur.md
 */
import { formatHsCode } from "./tnved";

export type ClientHsMaskParts = {
  /** Readable prefix including spacing up through digit 3 (e.g. "847"). */
  head: string;
  /** Tail with digits replaced by • (safe to put in DOM). */
  tail: string;
  digits: string;
};

/** Split a 10-digit HS for client display; null → show plain formatHsCode. */
export function maskHsCodeForClient(code: string | null | undefined): ClientHsMaskParts | null {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length !== 10) return null;
  const formatted = formatHsCode(digits) || digits;
  let seen = 0;
  let splitAt = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      seen += 1;
      if (seen === 3) {
        splitAt = i + 1;
        break;
      }
    }
  }
  if (seen < 3) return null;
  const head = formatted.slice(0, splitAt);
  const rawTail = formatted.slice(splitAt);
  const tail = rawTail.replace(/\d/g, "•");
  return { head, tail, digits };
}

/** Plain string form when JSX is unavailable (tests / a11y text). */
export function formatHsCodeMaskedForClient(code: string | null | undefined): string {
  const parts = maskHsCodeForClient(code);
  if (!parts) return formatHsCode(String(code || "")) || String(code || "");
  return `${parts.head}${parts.tail}`;
}
