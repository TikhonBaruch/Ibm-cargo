"use client";

import { useEffect, useMemo, useState } from "react";
import { ClientMaskedHsCode } from "./ClientMaskedHsCode";
import { api } from "../VedShell";
import {
  directoryReadFromCard,
  isStubTnvedTitle,
  type DirectoryCardLike,
} from "@/lib/ved/tnved-directory-read";
import {
  DIRECTORY_HINTS_LIMIT,
  directoryHintsQuery,
  isSameDirectoryHint,
} from "./new-calc-directory-hints";

type Hit = {
  code: string;
  titleRu?: string;
};

export function NewCalcDirectoryHints({
  query,
  enabled,
  appliedHsHint,
  onApply,
}: {
  query: string;
  enabled: boolean;
  appliedHsHint?: string;
  onApply: (input: { code: string; titleRu: string }) => void;
}) {
  const q = enabled ? directoryHintsQuery(query) : null;
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [picked, setPicked] = useState<Hit | null>(null);
  const [card, setCard] = useState<DirectoryCardLike | null>(null);

  useEffect(() => {
    if (!q) {
      setHits([]);
      setLoadError("");
      setBusy(false);
      setPicked(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api<{ items: Hit[] }>(
            `/api/v1/tnved/search?q=${encodeURIComponent(q)}&limit=${DIRECTORY_HINTS_LIMIT}&leafOnly=1`,
          );
          if (cancelled) return;
          const items = (res.items || []).filter(
            (h) => String(h.code || "").replace(/\D/g, "").length === 10,
          );
          setHits(items);
          setLoadError("");
          setPicked((prev) => (prev && items.some((h) => h.code === prev.code) ? prev : null));
        } catch (e) {
          if (cancelled) return;
          setHits([]);
          setLoadError(e instanceof Error ? e.message : "Ошибка поиска");
        } finally {
          if (!cancelled) setBusy(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    if (!picked?.code) {
      setCard(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const detail = await api<DirectoryCardLike>(
          `/api/v1/tnved/${encodeURIComponent(picked.code)}`,
        );
        if (!cancelled) setCard(detail);
      } catch {
        if (!cancelled) setCard(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [picked]);

  const read = useMemo(
    () => (picked ? directoryReadFromCard(card || {}, picked) : null),
    [card, picked],
  );

  if (!q) return null;

  const applied = picked ? isSameDirectoryHint(appliedHsHint, picked.code) : false;

  return (
    <div className="card wiz-dir-hints" style={{ margin: 0 }}>
      <h3>Подсказки справочника</h3>
      <p className="meta" style={{ marginTop: 6 }}>
        Черновик 10-значного кода. Финал подтвердит брокер после оплаты.
      </p>
      {busy ? <p className="meta" style={{ marginTop: 10 }}>Ищем в справочнике…</p> : null}
      {loadError ? (
        <p className="meta" style={{ marginTop: 10, color: "var(--danger)" }}>
          {loadError}
        </p>
      ) : null}
      {hits.length ? (
        <div className="tnved-hits">
          {hits.map((h) => (
            <button
              key={h.code}
              type="button"
              className={picked?.code === h.code ? "on" : ""}
              onClick={() => setPicked(h)}
            >
              <strong>
                <ClientMaskedHsCode code={h.code} />
              </strong>
              <span>
                {isStubTnvedTitle(h.titleRu)
                  ? "Общее обозначение — откройте карточку"
                  : h.titleRu || ""}
              </span>
            </button>
          ))}
        </div>
      ) : !busy && !loadError ? (
        <p className="meta" style={{ marginTop: 10 }}>
          Ничего не нашли. Уточните название — или оформите заявку, код проставит брокер.
        </p>
      ) : null}
      {picked && read ? (
        <div className="tnved-read wiz-dir-card">
          <div className="tnved-code">
            <ClientMaskedHsCode code={picked.code} />
          </div>
          <h3 style={{ marginTop: 8 }}>{read.title}</h3>
          <p className="meta" style={{ marginTop: 8, lineHeight: 1.45 }}>
            {read.why}
          </p>
          <div className="metric-row" style={{ marginTop: 12 }}>
            <div className="metric">
              <div className="k">Пошлина, ориентир</div>
              <div className="v">{read.dutyLabel}</div>
            </div>
            <div className="metric">
              <div className="k">НДС</div>
              <div className="v">{read.vatPct}%</div>
            </div>
          </div>
          <p className="meta" style={{ marginTop: 10 }}>
            Рекомендация справочника, не решение таможенного органа.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 12, justifyContent: "center" }}
            disabled={applied}
            onClick={() =>
              onApply({
                code: picked.code,
                titleRu: card?.titleRu || picked.titleRu || read.title,
              })
            }
          >
            {applied ? "Код взят в заявку" : "Взять этот код в заявку"}
          </button>
          <p className="meta" style={{ marginTop: 8 }}>
            Уточнения слева не заменят этот черновик, если код уже взят.
          </p>
        </div>
      ) : null}
    </div>
  );
}
