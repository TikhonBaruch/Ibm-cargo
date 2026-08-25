"use client";

import { useEffect, useState } from "react";
import { api } from "./VedShell";
import { VedDetailDrawer } from "./VedDetailDrawer";
import { TnvedCodeCard } from "./TnvedCodeCard";
import type { TnvedCard } from "@/lib/ved/tnved";

/** Shared HS card drawer for client / broker / admin. */
export function TnvedCardDrawer({
  code,
  onClose,
}: {
  code: string | null;
  onClose: () => void;
}) {
  const [card, setCard] = useState<TnvedCard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) {
      setCard(null);
      setError("");
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError("");
    api<TnvedCard>(`/api/v1/tnved/${encodeURIComponent(code)}`)
      .then((row) => {
        if (!cancelled) setCard(row);
      })
      .catch(() => {
        if (!cancelled) {
          setCard(null);
          setError("Кода нет в справочнике");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <VedDetailDrawer
      open={Boolean(code)}
      title={card?.codeDisplay || "ТН ВЭД"}
      subtitle="Карточка кода"
      onClose={onClose}
    >
      {busy && !card ? (
        <p className="text-sm text-[var(--kb-muted)]">Загрузка…</p>
      ) : null}
      {error ? <p className="text-sm text-amber-700">{error}</p> : null}
      {card ? <TnvedCodeCard card={card} /> : null}
    </VedDetailDrawer>
  );
}
