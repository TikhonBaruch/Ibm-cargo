"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HS_EXAMPLES } from "@/lbm-bro/lib/hs-catalog";
import { TNVED_GROUPS } from "@/lbm-bro/lib/tnved-groups";
import { useDemo } from "@/lbm-bro/lib/store";
import type { TnvedCard, TnvedMatchMeta } from "@/lib/ved/tnved";

type BrowseHit = {
  code: string;
  codeDisplay: string;
  titleRu: string;
  level?: number;
  isLeaf?: boolean;
  matchMeta?: TnvedMatchMeta;
};

type Chapter = { code: string; codeDisplay: string; titleRu: string };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Войдите в кабинет, чтобы открыть справочник Postgres");
    throw new Error(`Ошибка загрузки (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function ClientTnved({ initialQuery = "" }: { initialQuery?: string }) {
  const { prepareWizard, beginNewCalculation, freeHsUsed, consumeFreeHs } = useDemo();
  const [query, setQuery] = useState(initialQuery);
  const [group, setGroup] = useState("");
  const [hits, setHits] = useState<BrowseHit[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [card, setCard] = useState<TnvedCard | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searching, setSearching] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const [freePreviewHs, setFreePreviewHs] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchJson<{ items: Chapter[]; count: number }>("/api/v1/tnved/chapters")
      .then((data) => {
        if (!alive) return;
        setChapters(data.items?.length ? data.items : TNVED_GROUPS.map(([code, titleRu]) => ({
          code, codeDisplay: code, titleRu,
        })));
        setCatalogReady(true);
      })
      .catch((e) => {
        if (!alive) return;
        setChapters(TNVED_GROUPS.map(([code, titleRu]) => ({ code, codeDisplay: code, titleRu })));
        setLoadError(e instanceof Error ? e.message : "Справочник недоступен");
        setCatalogReady(true);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const q = query.trim();
    let alive = true;
    if (!q && !group) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ limit: "40" });
          if (q) params.set("q", q);
          if (group && !q) {
            params.set("codePrefix", group);
            params.set("level", "4");
          } else if (group && q) {
            params.set("codePrefix", group);
          }
          const data = await fetchJson<{ items: BrowseHit[] }>(`/api/v1/tnved/search?${params}`);
          if (!alive) return;
          const items = data.items || [];
          setHits(items);
          setLoadError("");
          // lbm-bro: first ranked hit (alias pin) is the optimal answer
          if (q && items[0]) setSelectedCode(items[0].code);
          else if (!q && group && items[0]) setSelectedCode(null);
        } catch (e) {
          if (!alive) return;
          setHits([]);
          setLoadError(e instanceof Error ? e.message : "Ошибка поиска");
        } finally {
          if (alive) setSearching(false);
        }
      })();
    }, 280);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedCode only for auto-pick first hit
  }, [query, group]);

  const picked = useMemo(() => {
    if (!hits.length) return null;
    if (selectedCode) return hits.find((h) => h.code === selectedCode) ?? hits[0];
    if (query.trim()) return hits[0];
    return null;
  }, [hits, selectedCode, query]);

  const autoFreeKey = query.trim() && picked ? (picked.codeDisplay || picked.code) : "";

  useEffect(() => {
    if (!autoFreeKey || freeHsUsed || freePreviewHs) return;
    setFreePreviewHs(autoFreeKey);
    consumeFreeHs();
  }, [autoFreeKey, freeHsUsed, freePreviewHs, consumeFreeHs]);

  useEffect(() => {
    const code = picked?.code;
    if (!code) {
      setCard(null);
      return;
    }
    let alive = true;
    setCardLoading(true);
    fetchJson<TnvedCard>(`/api/v1/tnved/${encodeURIComponent(code)}`)
      .then((row) => {
        if (!alive) return;
        setCard(row);
      })
      .catch(() => {
        if (!alive) return;
        setCard(null);
      })
      .finally(() => {
        if (alive) setCardLoading(false);
      });
    return () => { alive = false; };
  }, [picked?.code]);

  const displayHs = card?.codeDisplay || picked?.codeDisplay || picked?.code || "";
  const canRead = Boolean(picked) && (!freeHsUsed || freePreviewHs === displayHs || freePreviewHs === picked?.codeDisplay);

  function selectHit(h: BrowseHit) {
    setSelectedCode(h.code);
    if (!freeHsUsed && !freePreviewHs) {
      setFreePreviewHs(h.codeDisplay || h.code);
      consumeFreeHs();
    }
  }

  function startApplication() {
    const desc = card
      ? `${card.titleRu}\nКод ТН ВЭД: ${card.codeDisplay}`
      : picked
        ? `${picked.titleRu}\nКод ТН ВЭД: ${picked.codeDisplay}`
        : query;
    prepareWizard({ desc, tariff: "Код", packMode: "single", packSize: 0, lines: [], codePack: "one" });
    beginNewCalculation({ keepSeed: true });
  }

  const chapterAncestor = card?.ancestors?.find((a) => a.level === 2);
  const chapterFromList = picked ? chapters.find((c) => picked.code.startsWith(c.code)) : undefined;
  const groupTitle = chapterAncestor?.titleRu || chapterFromList?.titleRu;
  const groupMeta = chapterAncestor
    ? `${chapterAncestor.codeDisplay} — ${chapterAncestor.titleRu}`
    : chapterFromList
      ? `${chapterFromList.code} — ${chapterFromList.titleRu}`
      : `Уровень ${card?.level ?? picked?.level ?? "—"}`;

  const dutyLabel = card?.rate?.dutyPct != null
    ? `${card.rate.dutyPct}%`
    : card
      ? "нет в ЕТТ"
      : "—";
  const vatLabel = card ? `${card.paymentsHint.vatPct}%` : "—";
  const riskBits = [
    card?.measuresHint.excisePossible ? "акциз возможен" : null,
    card?.measuresHint.utilSborPossible ? "утиль возможен" : null,
    card?.measuresHint.ntmPossible ? "НТМ возможны" : null,
  ].filter(Boolean);
  const aliasRisk = picked?.matchMeta?.kind === "alias" ? picked.matchMeta.risk : undefined;
  const aliasWhy = picked?.matchMeta?.kind === "alias" ? picked.matchMeta.why : undefined;
  const riskText = riskBits.length
    ? riskBits.join(" · ")
    : aliasRisk && aliasRisk !== "Уточните описание товара"
      ? aliasRisk
      : "Уточните описание товара";

  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Справочник ТН ВЭД</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            {catalogReady
              ? `${(chapters.length || 96).toLocaleString("ru-RU")} групп · поиск через /api/v1/tnved (Postgres)`
              : "Подключаем справочник Postgres…"}
          </p>
        </div>
        <Link href="/client" className="btn btn-ghost btn-sm">На главную</Link>
      </div>

      <div className="two tnved-page">
        <div className="card" style={{ margin: 0 }}>
          <h3>Поиск по коду или названию</h3>
          <div className="field">
            <label>Что ищете</label>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setGroup(""); setSelectedCode(null); }}
              placeholder="Ноутбук, футболка или 8471 30 000 0"
            />
          </div>
          <div className="filter-chips" style={{ marginTop: 4 }}>
            {HS_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className={query === ex.q ? "on" : ""}
                onClick={() => { setQuery(ex.q); setGroup(""); setSelectedCode(null); }}
              >
                {ex.label}
              </button>
            ))}
          </div>

          {!query.trim() ? (
            <>
              <p className="meta" style={{ marginTop: 16, marginBottom: 8 }}>
                {chapters.length || 96} групп классификатора
              </p>
              <div className="tnved-groups">
                {chapters.map((ch) => (
                  <button
                    key={ch.code}
                    type="button"
                    className={group === ch.code ? "on" : ""}
                    onClick={() => { setGroup(ch.code); setQuery(""); setSelectedCode(null); }}
                  >
                    <b>{ch.codeDisplay || ch.code}</b>
                    <span>{ch.titleRu}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {loadError ? <p className="meta" style={{ marginTop: 12, color: "var(--danger)" }}>{loadError}</p> : null}
          {searching ? <p className="meta" style={{ marginTop: 12 }}>Ищем…</p> : null}

          {hits.length ? (
            <div className="tnved-hits">
              <p className="meta">
                {hits.length >= 40 ? "Первые 40 совпадений" : `${hits.length} позиций`}
              </p>
              {hits.map((h) => (
                <button
                  key={h.code}
                  type="button"
                  className={picked?.code === h.code ? "on" : ""}
                  onClick={() => selectHit(h)}
                >
                  <strong>{h.codeDisplay || h.code}</strong>
                  <span>{h.titleRu}</span>
                </button>
              ))}
            </div>
          ) : (query.trim() || group) && catalogReady && !searching ? (
            <p className="meta" style={{ marginTop: 14 }}>
              Ничего не нашли. Попробуйте 4+ цифры кода или другое название.
            </p>
          ) : null}

          <p className="meta" style={{ marginTop: 12 }}>
            Мультипозицию справочник не классифицирует — для пакета оформите заявку и приложите файл.
          </p>
        </div>

        <div className="card tnved-read" style={{ margin: 0 }}>
          {canRead && picked ? (
            <>
              <span className="pill ok">Первый раз бесплатно</span>
              <div className="meta" style={{ marginTop: 10 }}>{groupMeta}</div>
              <div className="tnved-code">{displayHs}</div>
              <h3 style={{ marginTop: 8 }}>{card?.titleRu || picked.titleRu}</h3>
              {aliasWhy ? (
                <p className="meta" style={{ marginTop: 8, lineHeight: 1.45 }}>{aliasWhy}</p>
              ) : null}
              {cardLoading ? <p className="meta" style={{ marginTop: 8 }}>Загружаем карточку…</p> : null}
              {card?.ancestors?.length ? (
                <p className="meta" style={{ marginTop: 8, lineHeight: 1.45 }}>
                  {card.ancestors.map((a) => a.codeDisplay).join(" → ")} → {card.codeDisplay}
                </p>
              ) : null}
              <div className="metric-row" style={{ marginTop: 14 }}>
                <div className="metric"><div className="k">Пошлина, ориентир</div><div className="v">{dutyLabel}</div></div>
                <div className="metric"><div className="k">НДС</div><div className="v">{vatLabel}</div></div>
              </div>
              <ul className="tnved-notes">
                <li>Рекомендация справочника, не решение ФТС</li>
                {card?.paymentsHint.feeRule ? <li>Сбор: {card.paymentsHint.feeRule}</li> : null}
                {card?.rate?.source ? <li>Источник ставки: {card.rate.source}</li> : null}
              </ul>
              <div className={`alert-box ${riskBits.length ? "warn-box" : "ok-box"}`} style={{ marginTop: 12 }}>
                <strong>Риск</strong>{riskText}
              </div>
              <p className="meta" style={{ marginTop: 10 }}>
                {card?.disclaimer
                  || "Следующее чтение ставки и рисков — в оплаченной заявке. Сам классификатор можно листать дальше."}
              </p>
              <Link href="/client/new" className="btn btn-primary" style={{ width: "100%", marginTop: 14, justifyContent: "center" }} onClick={startApplication}>
                Оформить заявку по этому коду
              </Link>
            </>
          ) : picked && !canRead ? (
            <>
              <span className="pill warn">Нужна оплата</span>
              <div className="meta" style={{ marginTop: 10 }}>
                {groupTitle || "Код классификатора"}
              </div>
              <div className="tnved-code">{displayHs}</div>
              <h3 style={{ marginTop: 10 }}>{picked.titleRu}</h3>
              <p className="meta" style={{ marginTop: 8, lineHeight: 1.45 }}>
                Один бесплатный просмотр ставки и рисков использован. Код классификатора виден — полный разбор откроется в заявке.
              </p>
              <Link href="/client/new" className="btn btn-primary" style={{ width: "100%", marginTop: 14, justifyContent: "center" }} onClick={startApplication}>
                Оплатить и открыть код
              </Link>
            </>
          ) : (
            <>
              <span className="pill muted">Справочник</span>
              <h3 style={{ marginTop: 10 }}>{catalogReady ? "Выберите группу или введите запрос" : "Загрузка классификатора"}</h3>
              <p className="meta" style={{ marginTop: 8 }}>
                {catalogReady
                  ? "Поиск идёт по Postgres TnvedCode (полный корпус). Это не официальное решение ФТС."
                  : "Подключаем номенклатуру…"}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
