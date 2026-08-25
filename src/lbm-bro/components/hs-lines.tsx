"use client";

import type { HsLine } from "@/lbm-bro/lib/types";

export function HsLinesTable({
  lines,
  compact,
  editable,
  onChange,
}: {
  lines: HsLine[];
  compact?: boolean;
  editable?: boolean;
  onChange?: (next: HsLine[]) => void;
}) {
  if (!lines.length) return null;

  function patch(id: string, field: "name" | "qty" | "price", value: string) {
    onChange?.(lines.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  return (
    <div className="hs-lines">
      {lines.map((l) => (
        <div key={l.id} className={`hs-line${l.status === "run" ? " run" : l.status === "ok" ? " ok" : ""}${editable ? " edit" : ""}`}>
          <div className="hs-n">{l.n}</div>
          <div className="hs-body">
            {editable ? (
              <>
                <input
                  value={l.name}
                  placeholder="Наименование"
                  onChange={(e) => patch(l.id, "name", e.target.value)}
                />
                <div className="hs-edit-row">
                  <input
                    value={l.qty}
                    placeholder="Кол-во"
                    onChange={(e) => patch(l.id, "qty", e.target.value)}
                  />
                  <input
                    value={l.price}
                    placeholder="Цена"
                    onChange={(e) => patch(l.id, "price", e.target.value)}
                  />
                  <span className="meta">{l.currency}</span>
                </div>
              </>
            ) : (
              <>
                <strong>{l.name}</strong>
                <div className="meta">
                  {[l.qty && `${l.qty} шт`, l.price && `${l.price} ${l.currency || ""}`].filter(Boolean).join(" · ") || "позиция инвойса"}
                </div>
                {!compact && l.why ? <div className="meta">{l.why}</div> : null}
              </>
            )}
          </div>
          <div className="hs-code">
            {l.status === "wait" ? "ожидает" : l.status === "run" ? "считаем…" : l.hs}
            {l.status === "ok" && l.conf ? <small>{l.conf}%</small> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
