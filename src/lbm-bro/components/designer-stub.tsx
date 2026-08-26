"use client";

import type { ReactNode } from "react";

export type DesignerStubProps = {
  /** Short product name from the design brief */
  title: string;
  /** What the designer planned (1–3 sentences) */
  intent: string;
  /** Why it is not live on domain yet */
  gap?: string;
  /** Optional visual children (disabled controls, mock UI) */
  children?: ReactNode;
  className?: string;
  compact?: boolean;
};

/**
 * Honest hold-slot: same place as the designer module, not a silent no-op (C8).
 * C5 had `return null`; restore that only if badges must be hidden again.
 */
export function DesignerStub({
  title,
  intent,
  gap = "Нет в domain MVP (LBM D27) — только визуал ibm-cargo.",
  children,
  className = "",
  compact = false,
}: DesignerStubProps) {
  return (
    <aside
      className={`designer-stub${compact ? " compact" : ""} ${className}`.trim()}
      role="note"
      aria-label={`Замысел дизайнера: ${title}`}
    >
      <div className="designer-stub-head">
        <span className="designer-stub-badge">Замысел дизайнера</span>
        <strong>{title}</strong>
      </div>
      <p className="designer-stub-intent">{intent}</p>
      <p className="designer-stub-gap">{gap}</p>
      {children ? <div className="designer-stub-body">{children}</div> : null}
    </aside>
  );
}
