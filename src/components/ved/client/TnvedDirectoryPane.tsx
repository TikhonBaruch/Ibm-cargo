"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HS_EXAMPLES } from "@/lbm-bro/lib/hs-catalog";
import { TNVED_GROUPS } from "@/lbm-bro/lib/tnved-groups";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import { ClientMaskedHsCode } from "./ClientMaskedHsCode";
import { formatHsCode } from "@/lib/ved/tnved";
import {
  directoryReadFromCard,
  directoryWizardHref,
  isStubTnvedTitle,
  type DirectoryCardLike,
} from "@/lib/ved/tnved-directory-read";
import { TNVED_RELATION_KIND_LABEL, type TnvedRelationKind } from "@/lib/ved/tnved-relations";
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
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [catalogLeaves, setCatalogLeaves] = useState<number | null>(null);
  const [catalogVariations, setCatalogVariations] = useState<number | null>(null);

  function applyStats(res: { total?: number; leaves?: number; variations?: number }) {
    if (typeof res.total === "number") setCatalogTotal(res.total);
    if (typeof res.leaves === "number") setCatalogLeaves(res.leaves);
    if (typeof res.variations === "number") setCatalogVariations(res.variations);
  }

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    let cancelled = false;
    void api<{ total?: number; leaves?: number; variations?: number }>("/api/v1/tnved/search?limit=1")
      .then((res) => {
        if (!cancelled) applyStats(res);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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
          // Directory UX: only 10-digit leaves (not 4/6/8 headings).
          const limit = 40;
          const res = await api<{ items: Hit[]; total?: number; leaves?: number; variations?: number }>(
            `/api/v1/tnved/search?q=${encodeURIComponent(q)}&limit=${limit}&leafOnly=1`,
          );
          if (cancelled) return;
          const items = (res.items || []).filter(
            (h) => String(h.code || "").replace(/\D/g, "").length === 10,
          );
          setHits(items);
          applyStats(res);
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

  function openLinkedCode(code: string, titleRu?: string | null) {
    setGroup("");
    setQuery(code);
    setPicked({ code, titleRu: titleRu || "" });
  }

  const related = card?.related || [];
  const children = card?.children || [];

  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Справочник ТН ВЭД</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            {catalogTotal == null && busy && !hits.length
              ? "Ищем в справочнике…"
              : catalogTotal != null
                ? [
                    `${catalogTotal.toLocaleString("ru-RU")} кодов`,
                    catalogLeaves != null ? `${catalogLeaves.toLocaleString("ru-RU")} листьев` : null,
                    catalogVariations != null
                      ? `${catalogVariations.toLocaleString("ru-RU")} вариаций`
                      : null,
                    "НДС 22% / сбор ПП 1637",
                  ]
                    .filter(Boolean)
                    .join(" · ")
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
          <p className="meta" style={{ marginTop: 6, marginBottom: 10, lineHeight: 1.45 }}>
            Уточнения в запросе (материал, назначение, бренд, модель) помогают найти самый точный
            10-значный код.
          </p>
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
              <div className="tnved-code">
                <ClientMaskedHsCode code={picked.code} />
              </div>
              {read.titleIsGeneralDesignation ? (
                <p className="meta" style={{ marginTop: 8 }}>
                  Общее обозначение
                  {read.generalDesignationCode ? ` · ${read.generalDesignationCode}` : ""}
                </p>
              ) : null}
              <h3 style={{ marginTop: read.titleIsGeneralDesignation ? 4 : 8 }}>{read.title}</h3>
              <p className="meta" style={{ marginTop: 8, lineHeight: 1.45 }}>
                {read.why}
              </p>
              {related.length ? (
                <div style={{ marginTop: 12 }}>
                  <p className="meta" style={{ marginBottom: 6 }}>
                    Связанные коды
                  </p>
                  <div className="filter-chips">
                    {related.map((rel) => (
                      <button
                        key={`${rel.kind}-${rel.code}`}
                        type="button"
                        onClick={() => openLinkedCode(rel.code)}
                        title={rel.why || ""}
                      >
                        {TNVED_RELATION_KIND_LABEL[rel.kind as TnvedRelationKind] || "Связь"}{" "}
                        {formatHsCode(rel.code) || rel.code}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {children.length ? (
                <div style={{ marginTop: 12 }}>
                  <p className="meta" style={{ marginBottom: 6 }}>
                    Внутри позиции
                  </p>
                  <div className="filter-chips">
                    {children
                      .filter((c) => c.code)
                      .map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => openLinkedCode(c.code!, c.titleRu)}
                          title={c.titleRu || ""}
                        >
                          {c.codeDisplay || formatHsCode(c.code) || c.code}
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
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
              {read.explanation ? (
                <div style={{ marginTop: 14 }}>
                  <p className="meta" style={{ marginBottom: 6 }}>
                    Пояснения ЕЭК (PSN)
                  </p>
                  <strong style={{ display: "block", fontSize: "0.9rem" }}>
                    {read.explanation.heading}
                  </strong>
                  <p className="meta" style={{ marginTop: 6, lineHeight: 1.45 }}>
                    {read.explanation.excerpt}
                  </p>
                </div>
              ) : null}
              {read.classificationDecisions.length ? (
                <div style={{ marginTop: 14 }}>
                  <p className="meta" style={{ marginBottom: 6 }}>
                    Решения ЕЭК о классификации
                  </p>
                  <ul className="tnved-notes">
                    {read.classificationDecisions.map((d) => (
                      <li key={`${d.code}-${d.title}`}>
                        {d.url ? (
                          <a href={d.url} target="_blank" rel="noreferrer">
                            {d.title}
                          </a>
                        ) : (
                          d.title
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
