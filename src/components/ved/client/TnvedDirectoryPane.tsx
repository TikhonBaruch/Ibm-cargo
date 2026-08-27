"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HS_EXAMPLES } from "@/lbm-bro/lib/hs-catalog";
import { TNVED_GROUPS } from "@/lbm-bro/lib/tnved-groups";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import { api } from "../VedShell";

type Hit = {
  code: string;
  codeDisplay?: string;
  titleRu?: string;
  isLeaf?: boolean;
};

type Card = {
  code: string;
  codeDisplay?: string;
  titleRu?: string;
  notes?: string | null;
  rate?: { dutyPct?: number | null } | null;
  paymentsHint?: { vatPct?: number | null; feeRule?: string };
  disclaimer?: string;
};

export function TnvedDirectoryPane({
  initialQuery = "",
  homeHref,
  newCalcHref,
}: {
  initialQuery?: string;
  homeHref: string;
  newCalcHref: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [group, setGroup] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const q = query.trim() || group;
    if (q.length < 2) {
      setHits([]);
      setLoadError("");
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      setBusy(true);
      void (async () => {
        try {
          const res = await api<{ items: Hit[] }>(
            `/api/v1/tnved/search?q=${encodeURIComponent(q)}&limit=40`,
          );
          if (cancelled) return;
          setHits(res.items || []);
          setLoadError("");
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
  }, [query, group]);

  useEffect(() => {
    if (!picked?.code) {
      setCard(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const detail = await api<Card>(`/api/v1/tnved/${encodeURIComponent(picked.code)}`);
        if (!cancelled) setCard(detail);
      } catch {
        if (!cancelled) setCard(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [picked]);

  const result = card || picked;

  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Справочник ТН ВЭД</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Поиск по коду или названию · ставки справочника (НДС 22% / сбор ПП 1637)
          </p>
        </div>
        <Link href={homeHref} className="btn btn-ghost btn-sm">
          На главную
        </Link>
      </div>

      <DesignerStub
        title="1-й код бесплатно"
        intent="В макете первый просмотр кода в справочнике бесплатный, повтор — после оплаты."
        gap="Freemium-гейта в LBM нет. Карточка ниже — directory rates (НДС 22% / сбор ПП 1637), не решение таможни. Финальный код подтверждает брокер."
        compact
      />

      <div className="two tnved-page">
        <div className="card" style={{ margin: 0 }}>
          <h3>Поиск по коду или названию</h3>
          <div className="field">
            <label>Что ищете</label>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setGroup("");
                setPicked(null);
              }}
              placeholder="Ноутбук, футболка или 8471 30 000 0"
            />
          </div>
          <div className="filter-chips" style={{ marginTop: 4 }}>
            {HS_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className={query === ex.q ? "on" : ""}
                onClick={() => {
                  setQuery(ex.q);
                  setGroup("");
                  setPicked(null);
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>

          {!query.trim() ? (
            <>
              <p className="meta" style={{ marginTop: 16, marginBottom: 8 }}>
                96 групп классификатора
              </p>
              <div className="tnved-groups">
                {TNVED_GROUPS.map(([code, title]) => (
                  <button
                    key={code}
                    type="button"
                    className={group === code ? "on" : ""}
                    onClick={() => {
                      setGroup(code);
                      setQuery("");
                      setPicked(null);
                    }}
                  >
                    <b>{code}</b>
                    <span>{title}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {busy ? <p className="meta" style={{ marginTop: 12 }}>Ищем в справочнике…</p> : null}
          {loadError ? (
            <p className="meta" style={{ marginTop: 12, color: "var(--danger)" }}>
              {loadError}
            </p>
          ) : null}

          {hits.length ? (
            <div className="tnved-hits">
              <p className="meta">
                {hits.length === 40 ? "Первые 40 совпадений" : `${hits.length} позиций`}
              </p>
              {hits.map((h) => (
                <button
                  key={h.code}
                  type="button"
                  className={picked?.code === h.code ? "on" : ""}
                  onClick={() => setPicked(h)}
                >
                  <strong>{h.codeDisplay || h.code}</strong>
                  <span>{h.titleRu || ""}</span>
                </button>
              ))}
            </div>
          ) : (query.trim() || group) && !busy ? (
            <p className="meta" style={{ marginTop: 14 }}>
              Ничего не нашли. Попробуйте 4+ цифры кода или другое название.
            </p>
          ) : null}

          <p className="meta" style={{ marginTop: 12 }}>
            Мультипозицию справочник не классифицирует — оформите заявку и приложите файл.
          </p>
        </div>

        <div className="card tnved-read" style={{ margin: 0 }}>
          {result ? (
            <>
              <h3>{card?.codeDisplay || picked?.codeDisplay || picked?.code}</h3>
              <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
                {card?.titleRu || picked?.titleRu}
              </p>
              {card?.paymentsHint ? (
                <p className="meta" style={{ marginTop: 10 }}>
                  НДС {card.paymentsHint.vatPct ?? 22}%
                  {card.rate?.dutyPct != null ? ` · пошлина ${card.rate.dutyPct}%` : ""}
                  {card.paymentsHint.feeRule ? ` · сбор ${card.paymentsHint.feeRule}` : " · сбор ПП 1637"}
                </p>
              ) : null}
              {card?.disclaimer ? (
                <p className="meta" style={{ marginTop: 10 }}>
                  {card.disclaimer}
                </p>
              ) : null}
              <Link href={newCalcHref} className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
                Оформить просчёт
              </Link>
            </>
          ) : (
            <>
              <h3>Карточка кода</h3>
              <p className="meta">
                Выберите позицию слева — покажем название и ставки справочника. Это не решение
                таможенного органа.
              </p>
              <Link href={newCalcHref} className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
                Сразу к новому просчёту
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
