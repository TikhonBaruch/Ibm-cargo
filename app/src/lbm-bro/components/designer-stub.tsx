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
 * Marks UI that exists in the lbm-bro design but is not wired to taurus domain.
 * Visible to reviewers: do not hide missing product behind silent no-ops.
 */
export function DesignerStub({
  title,
  intent,
  gap = "Нет в domain MVP (taurus D27) — только визуал ibm-cargo.",
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
