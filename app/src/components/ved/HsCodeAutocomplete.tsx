"use client";

import { useEffect, useId, useState } from "react";
import { api } from "./VedShell";

type TnvedHit = {
  code: string;
  codeDisplay: string;
  titleRu: string;
  isLeaf?: boolean;
};

type TnvedDetail = TnvedHit & {
  rates?: Array<{
    dutyPct?: number | null;
    vatPct?: number | null;
    feeHintRub?: number | null;
    dutyKind?: string;
  }>;
  rate?: { dutyPct?: number | null } | null;
  paymentsHint?: { vatPct?: number | null };
};

/**
 * D32 combobox: TN VED directory search (`GET /api/v1/tnved/search`).
 * Shared by broker WorkMapping and client NewCalc — do not fork a second dropdown.
 */
export function HsCodeAutocomplete({
  value,
  onChange,
  onHint,
  onOpenCard,
  className,
  leafOnly = false,
  placeholder,
  searchBoost,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Optional duty/VAT/fee hints from directory rates (soft, broker may edit). */
  onHint?: (hint: { dutyPct?: number | null; vatPct?: number | null; feeHintRub?: number | null }) => void;
  /** Open the shared HS card drawer (VedDetailDrawer). */
  onOpenCard?: (code: string) => void;
  className?: string;
  /** Client NewCalc: 10-digit leaves only. Broker omits (chapters allowed). */
  leafOnly?: boolean;
  placeholder?: string;
  /** Clarify tokens appended to text searches (not digit-only codes). */
  searchBoost?: string;
}) {
  const listId = useId();
  const [hits, setHits] = useState<TnvedHit[]>([]);
  const [warn, setWarn] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raw = value.trim();
    if (raw.length < 2) {
      setHits([]);
      setWarn("");
      return;
    }
    const digitsOnly = /^\d[\d\s.]*$/.test(raw);
    const boost = (!digitsOnly && searchBoost?.trim()) || "";
    const q = boost ? `${raw} ${boost}`.replace(/\s+/g, " ").trim() : raw;
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const leafQ = leafOnly ? "&leafOnly=1" : "";
          let res = await api<{ items: TnvedHit[] }>(
            `/api/v1/tnved/search?q=${encodeURIComponent(q)}&limit=8${leafQ}`
          );
          let items = res.items || [];
          // Client NewCalc uses leafOnly; demo corpus often matches only chapters/headings.
          // Fall back to broader search so the combobox is not empty for common words.
          if (leafOnly && items.length === 0) {
            res = await api<{ items: TnvedHit[] }>(
              `/api/v1/tnved/search?q=${encodeURIComponent(q)}&limit=8`
            );
            items = res.items || [];
          }
          if (cancelled) return;
          setHits(items);
          const digits = raw.replace(/\D/g, "");
          const exact = items.some((h) => h.code === digits || h.codeDisplay === raw);
          if (items.length === 0) {
            setWarn(
              leafOnly
                ? "В справочнике нет. Уточните описание — брокер разберёт"
                : digits.length >= 4 && !exact
                  ? "Кода нет в справочнике — можно сохранить вручную"
                  : ""
            );
          } else {
            setWarn("");
          }
        } catch {
          if (!cancelled) {
            setHits([]);
            setWarn("");
          }
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, leafOnly, searchBoost]);

  const pick = async (hit: TnvedHit) => {
    onChange(hit.codeDisplay || hit.code);
    setOpen(false);
    setWarn("");
    if (!onHint) return;
    try {
      const detail = await api<TnvedDetail>(`/api/v1/tnved/${encodeURIComponent(hit.code)}`);
      const dutyPct = detail.rate?.dutyPct ?? detail.rates?.[0]?.dutyPct ?? null;
      const vatPct = detail.paymentsHint?.vatPct ?? detail.rates?.[0]?.vatPct ?? null;
      onHint({ dutyPct, vatPct, feeHintRub: detail.rates?.[0]?.feeHintRub ?? null });
    } catch {
      /* soft */
    }
  };

  const showList = open && hits.length > 0;
  const digits = value.replace(/\D/g, "");
  const canOpenCard = Boolean(onOpenCard) && [2, 4, 6, 8, 10].includes(digits.length);

  return (
    <div className="relative">
      <input
        className={className || "w-full rounded border px-1 py-0.5"}
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-controls={listId}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        autoComplete="off"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-0.5 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-lg"
        >
          {hits.map((h) => (
            <li key={h.code} role="option">
              <button
                type="button"
                className="block w-full px-2 py-1.5 text-left hover:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(h)}
              >
                <span className="font-medium">{h.codeDisplay}</span>
                <span className="ml-1 text-[var(--kb-muted)] line-clamp-1">{h.titleRu}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {canOpenCard && (
        <button
          type="button"
          className="mt-0.5 text-[11px] font-semibold text-[#2b72f4]"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onOpenCard?.(digits)}
        >
          Карточка кода
        </button>
      )}
      {warn && <p className="mt-0.5 text-[10px] text-amber-700">{warn}</p>}
    </div>
  );
}
