"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HS_EXAMPLES } from "@/lbm-bro/lib/hs-catalog";
import { TNVED_GROUPS } from "@/lbm-bro/lib/tnved-groups";
import {
  headingsInGroup, loadTnved, searchTnved, toHit, type TnvedData, type TnvedHit,
} from "@/lbm-bro/lib/tnved-lookup";
import { useDemo } from "@/lbm-bro/lib/store";

export function ClientTnved({ initialQuery = "" }: { initialQuery?: string }) {
  const { prepareWizard, beginNewCalculation, freeHsUsed, consumeFreeHs } = useDemo();
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<TnvedData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [group, setGroup] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [freePreviewHs, setFreePreviewHs] = useState<string | null>(null);

  useEffect(() => {
    loadTnved().then(setData).catch((e) => setLoadError(e instanceof Error ? e.message : "Ошибка загрузки"));
  }, []);

  const hits = useMemo(() => {
    if (!data) return [];
    if (query.trim()) return searchTnved(data, query);
    if (group) return headingsInGroup(data, group).map((item) => toHit(data, item));
    return [];
  }, [data, query, group]);

  const picked = useMemo(() => {
    if (!hits.length) return null;
    if (query.trim()) return hits[0];
    if (selectedCode) return hits.find((h) => h.code === selectedCode) ?? null;
    return null;
  }, [hits, query, selectedCode]);

  const result = picked;
  const autoFreeKey = query.trim() ? hits[0]?.hs ?? "" : "";
  const [autoConsumedKey, setAutoConsumedKey] = useState("");
  if (autoFreeKey && !freeHsUsed && !freePreviewHs && autoConsumedKey !== autoFreeKey) {
    setAutoConsumedKey(autoFreeKey);
    setFreePreviewHs(hits[0]!.hs);
    consumeFreeHs();
  }
  const canRead = Boolean(result) && (!freeHsUsed || freePreviewHs === result?.hs);

  function selectHit(h: TnvedHit) {
    setSelectedCode(h.code);
    if (!freeHsUsed && !freePreviewHs) {
      setFreePreviewHs(h.hs);
      consumeFreeHs();
    }
  }

  function startApplication() {
    const desc = result
      ? `${result.title}\nКод ТН ВЭД: ${result.hs}`
      : query;
    prepareWizard({ desc, tariff: "Код", packMode: "single", packSize: 0, lines: [], codePack: "one" });
    beginNewCalculation({ keepSeed: true });
  }

  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Справочник ТН ВЭД</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            {data
              ? `${data.items.length.toLocaleString("ru-RU")} позиций · ${data.source}`
              : "Загружаем классификатор ТН ВЭД ЕАЭС…"}
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
              onChange={(e) => { setQuery(e.target.value); setGroup(""); }}
              placeholder="Ноутбук, футболка или 8471 30 000 0"
            />
          </div>
          <div className="filter-chips" style={{ marginTop: 4 }}>
            {HS_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className={query === ex.q ? "on" : ""}
                onClick={() => { setQuery(ex.q); setGroup(""); }}
              >
                {ex.label}
              </button>
            ))}
          </div>

          {!query.trim() ? (
            <>
              <p className="meta" style={{ marginTop: 16, marginBottom: 8 }}>96 групп классификатора</p>
              <div className="tnved-groups">
                {TNVED_GROUPS.map(([code, title]) => (
                  <button
                    key={code}
                    type="button"
                    className={group === code ? "on" : ""}
                    onClick={() => { setGroup(code); setQuery(""); }}
                  >
                    <b>{code}</b>
                    <span>{title}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {loadError ? <p className="meta" style={{ marginTop: 12, color: "var(--danger)" }}>{loadError}</p> : null}

          {hits.length ? (
            <div className="tnved-hits">
              <p className="meta">{hits.length === 40 ? "Первые 40 совпадений" : `${hits.length} позиций`}</p>
              {hits.map((h) => (
                <button
                  key={h.code}
                  type="button"
                  className={picked?.code === h.code ? "on" : ""}
                  onClick={() => selectHit(h)}
                >
                  <strong>{h.hs}</strong>
                  <span>{h.title}</span>
                </button>
              ))}
            </div>
          ) : query.trim() && data ? (
            <p className="meta" style={{ marginTop: 14 }}>Ничего не нашли. Попробуйте 4+ цифры кода или другое название.</p>
          ) : null}

          <p className="meta" style={{ marginTop: 12 }}>
            Мультипозицию справочник не классифицирует — для пакета оформите заявку и приложите файл.
          </p>
        </div>

        <div className="card tnved-read" style={{ margin: 0 }}>
          {canRead && result ? (
            <>
              <span className="pill ok">Первый раз бесплатно</span>
              <div className="meta" style={{ marginTop: 10 }}>{result.group}</div>
              <div className="tnved-code">{result.hs}</div>
              <h3 style={{ marginTop: 8 }}>{result.title}</h3>
              <p className="meta" style={{ marginTop: 8, lineHeight: 1.45 }}>{result.why}</p>
              <div className="metric-row" style={{ marginTop: 14 }}>
                <div className="metric"><div className="k">Пошлина, ориентир</div><div className="v">{result.dutyPct}%</div></div>
                <div className="metric"><div className="k">НДС</div><div className="v">20%</div></div>
              </div>
              <ul className="tnved-notes">
                {result.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
              <div className={`alert-box ${result.risk === "Низкий" ? "ok-box" : "warn-box"}`} style={{ marginTop: 12 }}>
                <strong>Риск</strong>{result.risk}
              </div>
              <p className="meta" style={{ marginTop: 10 }}>
                Следующее чтение ставки и рисков — в оплаченной заявке. Сам классификатор можно листать дальше.
              </p>
              <Link href="/client/new" className="btn btn-primary" style={{ width: "100%", marginTop: 14, justifyContent: "center" }} onClick={startApplication}>
                Оформить заявку по этому коду
              </Link>
            </>
          ) : result && !canRead ? (
            <>
              <span className="pill warn">Нужна оплата</span>
              <div className="meta" style={{ marginTop: 10 }}>{result.group}</div>
              <div className="tnved-code">{result.hs}</div>
              <h3 style={{ marginTop: 10 }}>{result.title}</h3>
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
              <h3 style={{ marginTop: 10 }}>{data ? "Выберите группу или введите запрос" : "Загрузка классификатора"}</h3>
              <p className="meta" style={{ marginTop: 8 }}>
                {data
                  ? "96 товарных групп ТН ВЭД ЕАЭС на базе ГС 2022. Это не официальное решение ФТС."
                  : "Подключаем номенклатуру…"}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
