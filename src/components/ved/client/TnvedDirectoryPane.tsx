"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HS_EXAMPLES } from "@/lbm-bro/lib/hs-catalog";
import { TNVED_GROUPS } from "@/lbm-bro/lib/tnved-groups";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import { formatHsCode } from "@/lib/ved/tnved";
import {
  directoryReadFromCard,
  directoryWizardHref,
  type DirectoryCardLike,
} from "@/lib/ved/tnved-directory-read";
import { api } from "../VedShell";

/** Same labels as lab chips; queries are short tokens for live Postgres contains-search. */
const LIVE_HS_EXAMPLES = HS_EXAMPLES.map((ex) => {
  if (ex.label === "Ноутбук") return { ...ex, q: "ноутбук" };
  if (ex.label === "Футболка") return { ...ex, q: "футболка" };
  if (ex.label === "Поло") return { ...ex, q: "поло" };
  if (ex.label === "Фильтр") return { ...ex, q: "фильтр" };
  if (ex.label === "8471") return { ...ex, q: "8471" };
  return ex;
});

type Hit = {
  code: string;
  codeDisplay?: string;
  titleRu?: string;
  isLeaf?: boolean;
};

function groupLabel(code: string) {
  const d = String(code || "").replace(/\D/g, "").slice(0, 2);
  const g = TNVED_GROUPS.find((row) => row[0] === d);
  return g ? `${g[0]} — ${g[1]}` : d ? `${d} — группа ТН ВЭД` : "";
}

function hitHs(h: Hit) {
  return h.codeDisplay || formatHsCode(h.code) || h.code;
}

export function TnvedDirectoryPane({
  initialQuery = "",
  homeHref,
  newCalcHref,
  onApplyCode,
}: {
  initialQuery?: string;
  homeHref: string;
  newCalcHref: string;
  onApplyCode?: (input: { code: string; titleRu: string }) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [group, setGroup] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [card, setCard] = useState<DirectoryCardLike | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const q = query.trim() || group;
    if (q.length < 2) {
      setHits([]);
      setLoadError("");
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const t = window.setTimeout(() => {
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
    if (!query.trim() || busy) return;
    if (!hits.length) {
      setPicked(null);
      return;
    }
    setPicked((prev) => (prev && hits.some((h) => h.code === prev.code) ? prev : hits[0]));
  }, [hits, query, busy]);

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
  const wizardHref = picked
    ? directoryWizardHref(newCalcHref, {
        code: picked.code,
        titleRu: card?.titleRu || picked.titleRu,
      })
    : newCalcHref;

  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Справочник ТН ВЭД</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            {busy && !hits.length
              ? "Ищем в справочнике…"
              : "Живой справочник · НДС 22% / сбор ПП 1637"}
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
            {LIVE_HS_EXAMPLES.map((ex) => (
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
                  <strong>{hitHs(h)}</strong>
                  <span>{h.titleRu || ""}</span>
                </button>
              ))}
            </div>
          ) : query.trim() && !busy ? (
            <p className="meta" style={{ marginTop: 14 }}>
              Ничего не нашли. Попробуйте 4+ цифры кода или другое название.
            </p>
          ) : null}

          <p className="meta" style={{ marginTop: 12 }}>
            Мультипозицию справочник не классифицирует — оформите заявку и приложите файл.
          </p>
        </div>

        <div className="card tnved-read" style={{ margin: 0 }}>
          {picked && read ? (
            <>
              <span className="pill muted">Справочник</span>
              <div className="meta" style={{ marginTop: 10 }}>
                {groupLabel(picked.code)}
              </div>
              <div className="tnved-code">{read.hs}</div>
              <h3 style={{ marginTop: 8 }}>{read.title}</h3>
              <p className="meta" style={{ marginTop: 8, lineHeight: 1.45 }}>
                {read.why}
              </p>
              <div className="metric-row" style={{ marginTop: 14 }}>
                <div className="metric">
                  <div className="k">Пошлина, ориентир</div>
                  <div className="v">{read.dutyLabel}</div>
                </div>
                <div className="metric">
                  <div className="k">НДС</div>
                  <div className="v">{read.vatPct}%</div>
                </div>
              </div>
              <ul className="tnved-notes">
                {read.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <div
                className={`alert-box ${read.riskKind === "ok" ? "ok-box" : "warn-box"}`}
                style={{ marginTop: 12 }}
              >
                <strong>Риск</strong>
                {read.riskLabel}
              </div>
              <p className="meta" style={{ marginTop: 10 }}>
                Рекомендация справочника, не решение таможенного органа. Финальный код подтверждает
                брокер.
              </p>
              <Link
                href={wizardHref}
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 14, justifyContent: "center" }}
                onClick={() => {
                  onApplyCode?.({
                    code: picked.code,
                    titleRu: card?.titleRu || picked.titleRu || read.title,
                  });
                }}
              >
                Оформить заявку по этому коду
              </Link>
            </>
          ) : (
            <>
              <span className="pill muted">Справочник</span>
              <h3 style={{ marginTop: 10 }}>Выберите группу или введите запрос</h3>
              <p className="meta" style={{ marginTop: 8 }}>
                96 товарных групп ТН ВЭД ЕАЭС. Это не официальное решение ФТС.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
