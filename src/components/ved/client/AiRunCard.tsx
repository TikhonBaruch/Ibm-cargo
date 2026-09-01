"use client";

import { useEffect, useState } from "react";
import { HsLinesTable } from "@/lbm-bro/components/hs-lines";
import type { HsLine } from "@/lbm-bro/lib/types";
import { AI_DRAIN_STATUS_MSGS } from "@/lib/ved/ai-classification-copy";

type Props = {
  title?: string;
  lines?: HsLine[];
  compactTable?: boolean;
  rotateMs?: number;
  statusMessages?: readonly string[];
};

export function AiRunCard({
  title = "AI подбирает код",
  lines,
  compactTable = false,
  rotateMs = 2400,
  statusMessages = AI_DRAIN_STATUS_MSGS,
}: Props) {
  const msgs = statusMessages.length ? statusMessages : AI_DRAIN_STATUS_MSGS;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % msgs.length);
    }, rotateMs);
    return () => window.clearInterval(t);
  }, [msgs, rotateMs]);

  return (
    <div className="ai-run card" style={{ margin: 0 }} role="status" aria-live="polite">
      <div className="ring" />
      <h3 style={{ fontFamily: "var(--display)", fontSize: "1.6rem" }}>{title}</h3>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>{msgs[idx] ?? msgs[0]}</p>
      {lines && lines.length >= 2 ? <HsLinesTable lines={lines} compact={compactTable} /> : null}
    </div>
  );
}
