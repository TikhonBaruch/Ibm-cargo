"use client";

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  filterFieldSuggestions,
  fieldSuggestDisplay,
  type FieldSuggestKind,
} from "@/lib/ved/field-suggest";
import { api } from "@/components/ved/VedShell";

type PrecedentSuggestHit = {
  value: string;
  label?: string;
  source: "precedent" | "past_calc" | "local";
};

type SuggestRow =
  | { type: "header"; label: string }
  | { type: "hit"; value: string; display: string; key: string };

/**
 * D32 combobox: precedent typeahead + local dictionary fail-open.
 * Free text always allowed; pick is optional.
 */
export function FieldSuggest({
  kind,
  value,
  onChange,
  className,
  placeholder,
  disabled,
  maxLength,
  resolveBlur,
  multiline = false,
  rows = 3,
  precedents = true,
}: {
  kind: FieldSuggestKind;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Soft cap while typing (avoid for originCountry — blocks «Китай»). */
  maxLength?: number;
  /** Normalize free text on blur (e.g. alias → ISO-2). */
  resolveBlur?: (raw: string) => string;
  /** Party description etc. */
  multiline?: boolean;
  rows?: number;
  /** Fetch «Прецеденты из прошлых заявок» via session API (fail-open). */
  precedents?: boolean;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [remoteHits, setRemoteHits] = useState<PrecedentSuggestHit[]>([]);

  const localHits = filterFieldSuggestions(kind, value, 8);

  useEffect(() => {
    if (!precedents || disabled) {
      setRemoteHits([]);
      return;
    }

    const q = value.trim();
    if (q.length < 2) {
      setRemoteHits([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void api<{ items: PrecedentSuggestHit[] }>("/api/v1/suggest/query", {
        method: "POST",
        body: JSON.stringify({ kind, q: value, limit: 8 }),
      })
        .then((res) => setRemoteHits(res.items.filter((h) => h.source !== "local")))
        .catch(() => setRemoteHits([]));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [kind, value, precedents, disabled]);

  const rowsToShow = useMemo((): SuggestRow[] => {
    const seen = new Set<string>();
    const out: SuggestRow[] = [];

    const precedentRows = remoteHits.filter((h) => h.source === "precedent" || h.source === "past_calc");
    if (precedentRows.length > 0) {
      out.push({ type: "header", label: "Прецеденты из прошлых заявок" });
      for (const h of precedentRows) {
        const key = h.value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          type: "hit",
          value: h.value,
          display: h.label || h.value,
          key: `precedent-${key}`,
        });
        if (out.filter((r) => r.type === "hit").length >= 8) return out;
      }
    }

    const localOnly = localHits.filter((h) => !seen.has(h.value.toLowerCase()));
    if (localOnly.length > 0) {
      if (precedentRows.length > 0) {
        out.push({ type: "header", label: "Справочник" });
      }
      for (const h of localOnly) {
        const key = h.value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          type: "hit",
          value: h.value,
          display: fieldSuggestDisplay(h),
          key: `local-${key}`,
        });
        if (out.filter((r) => r.type === "hit").length >= 8) break;
      }
    }

    return out;
  }, [remoteHits, localHits, precedents]);

  const showList = open && rowsToShow.some((r) => r.type === "hit");

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const applyTyped = (raw: string) => {
    onChange(maxLength != null ? raw.slice(0, maxLength) : raw);
  };

  const pick = (raw: string) => {
    onChange(raw);
    setOpen(false);
  };

  const sharedProps = {
    className,
    placeholder,
    value,
    disabled,
    maxLength,
    autoComplete: "off" as const,
    role: "combobox" as const,
    "aria-expanded": showList,
    "aria-autocomplete": "list" as const,
    "aria-controls": listId,
    onFocus: () => setOpen(true),
    onBlur: () => {
      window.setTimeout(() => {
        if (resolveBlur) {
          const next = resolveBlur(value);
          if (next !== value) onChange(next);
        }
        setOpen(false);
      }, 150);
    },
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      applyTyped(e.target.value);
      setOpen(true);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    },
  };

  return (
    <div ref={wrapRef} className="relative">
      {multiline ? <textarea {...sharedProps} rows={rows} /> : <input {...sharedProps} />}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-0.5 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {rowsToShow.map((row) =>
            row.type === "header" ? (
              <li
                key={row.label}
                className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                aria-hidden
              >
                {row.label}
              </li>
            ) : (
              <li key={row.key} role="option">
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(row.value)}
                >
                  {row.display}
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
