"use client";

/**
 * Admin TN VED catalog ops (D32):
 * - single form (like TariffsPane)
 * - CSV paste/file + preview (like ProductCsvImport)
 * - JSON advanced
 * - search existing (like HsCodeAutocomplete)
 */
import { useRef, useState } from "react";
import { api, VedEmptyState } from "../VedShell";
import { TnvedCardDrawer } from "../TnvedCardDrawer";
import {
  buildTnvedImportItem,
  parseTnvedCsv,
  type TnvedImportItem,
} from "@/lib/ved/tnved";
import demoPack from "../../../../scripts/fixtures/tnved/demo-pack.json";

type Mode = "single" | "csv" | "json";

type SearchHit = {
  code: string;
  codeDisplay?: string | null;
  titleRu: string;
  level: number;
  isLeaf?: boolean;
};

const CSV_SAMPLE = `code,titleRu,dutyPct,vatPct
8471300000,Машины вычислительные портативные,,22
6404110000,Спортивная обувь с текстильным верхом,,22`;

const JSON_SAMPLE = JSON.stringify(
  {
    items: [
      {
        code: "8471300000",
        codeDisplay: "8471 30 000 0",
        level: 10,
        parentCode: "84713000",
        titleRu: "Машины вычислительные портативные",
        isLeaf: true,
        rate: { dutyKind: "AD_VALOREM", dutyPct: null, vatPct: 22 },
      },
    ],
  },
  null,
  2
);

export function TnvedImportPane({
  busy,
  result,
  onImport,
}: {
  busy: boolean;
  result: string;
  onImport: (items: TnvedImportItem[]) => void;
}) {
  const [mode, setMode] = useState<Mode>("single");
  const [code, setCode] = useState("8471300000");
  const [titleRu, setTitleRu] = useState("Машины вычислительные портативные");
  const [dutyPct, setDutyPct] = useState("0");
  const [vatPct, setVatPct] = useState("22");
  const [isLeaf, setIsLeaf] = useState(true);
  const [csvText, setCsvText] = useState(CSV_SAMPLE);
  const [jsonText, setJsonText] = useState(JSON_SAMPLE);
  const [csvPreview, setCsvPreview] = useState<ReturnType<typeof parseTnvedCsv> | null>(null);
  const [formError, setFormError] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [cardCode, setCardCode] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runSearch = async () => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    setSearchBusy(true);
    try {
      const data = await api<{ items: SearchHit[] }>(
        `/api/v1/tnved/search?q=${encodeURIComponent(query)}&limit=12`
      );
      setHits(data.items || []);
    } catch {
      setHits([]);
    } finally {
      setSearchBusy(false);
    }
  };

  const submitSingle = () => {
    setFormError("");
    try {
      const item = buildTnvedImportItem({
        code,
        titleRu,
        dutyPct: dutyPct === "" ? undefined : Number(dutyPct),
        vatPct: vatPct === "" ? undefined : Number(vatPct),
        isLeaf,
      });
      onImport([item]);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Ошибка формы");
    }
  };

  const previewCsv = () => {
    setFormError("");
    setCsvPreview(parseTnvedCsv(csvText));
  };

  const submitCsv = () => {
    setFormError("");
    const parsed = csvPreview || parseTnvedCsv(csvText);
    setCsvPreview(parsed);
    if (!parsed.items.length) {
      setFormError(parsed.errors[0]?.message || "Нет валидных строк");
      return;
    }
    onImport(parsed.items);
  };

  const submitJson = () => {
    setFormError("");
    try {
      const parsed = JSON.parse(jsonText) as { items?: unknown };
      if (!parsed.items || !Array.isArray(parsed.items) || !parsed.items.length) {
        throw new Error("Ожидается JSON: { items: [ { code, titleRu, … } ] }");
      }
      onImport(parsed.items as TnvedImportItem[]);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Некорректный JSON");
    }
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
    setCsvPreview(parseTnvedCsv(text));
    setMode("csv");
  };

  return (
    <section className="max-w-3xl space-y-5">
      <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Справочник в системе</h2>
        <p className="mt-1 text-sm text-[var(--kb-muted)]">
          Поиск по коду или названию — чтобы не дублировать уже загруженные позиции.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="8471 или ноутбуки"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
          />
          <button
            type="button"
            disabled={searchBusy || q.trim().length < 2}
            className="rounded-full border border-[#2b72f4]/40 px-4 py-2 text-sm font-semibold text-[#2b72f4] disabled:opacity-50"
            onClick={() => void runSearch()}
          >
            Найти
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            onClick={() => onImport((demoPack as { items: TnvedImportItem[] }).items)}
          >
            Загрузить демо-набор
          </button>
        </div>
        {hits.length > 0 ? (
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
            {hits.map((h) => (
              <li key={h.code}>
                <button
                  type="button"
                  className="w-full rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                  onClick={() => setCardCode(h.code)}
                >
                  <span className="font-medium">{h.codeDisplay || h.code}</span>
                  <span className="text-[var(--kb-muted)]">
                    {" "}
                    · ур. {h.level}
                    {h.isLeaf ? " · лист" : ""} — {h.titleRu}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : q.trim().length >= 2 && !searchBusy ? (
          <div className="mt-3">
            <VedEmptyState
              title="Ничего не найдено"
              hint="Добавьте код формой или CSV ниже — брокер увидит его в подсказках HS."
              actionLabel="Добавить позицию"
              onAction={() => {
                setMode("single");
                setFormError("");
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["single", "Одна позиция"],
            ["csv", "CSV / таблица"],
            ["json", "JSON"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              setFormError("");
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              mode === id ? "bg-[#2b72f4] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "single" && (
        <div className="space-y-3 rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <p className="text-sm text-[var(--kb-muted)]">
            Укажите код (2–10 цифр) и название на русском. Ставка пошлины и НДС — опционально для
            подсказки брокеру.
          </p>
          <label className="block text-sm">
            Код ТН ВЭД
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="8471300000"
            />
          </label>
          <label className="block text-sm">
            Название (RU)
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={titleRu}
              onChange={(e) => setTitleRu(e.target.value)}
              placeholder="Машины вычислительные портативные"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Пошлина, %
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={dutyPct}
                onChange={(e) => setDutyPct(e.target.value)}
                min={0}
                max={100}
                step={0.1}
              />
            </label>
            <label className="block text-sm">
              НДС, %
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={vatPct}
                onChange={(e) => setVatPct(e.target.value)}
                min={0}
                max={100}
                step={1}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isLeaf} onChange={(e) => setIsLeaf(e.target.checked)} />
            Конечная позиция (10 знаков / лист)
          </label>
          <button
            type="button"
            disabled={busy}
            className="rounded-full bg-[#2b72f4] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            onClick={submitSingle}
          >
            Добавить в справочник
          </button>
        </div>
      )}

      {mode === "csv" && (
        <div className="space-y-3 rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <p className="text-sm text-[var(--kb-muted)]">
            Колонки:{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">code,titleRu[,dutyPct][,vatPct]</code>
            . До 500 строк. Разделитель — запятая, точка с запятой или таб.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
              onClick={() => fileRef.current?.click()}
            >
              Выбрать файл
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setCsvText(CSV_SAMPLE);
                setCsvPreview(null);
              }}
            >
              Пример
            </button>
          </div>
          <textarea
            className="min-h-[160px] w-full rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs"
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setCsvPreview(null);
            }}
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-full border border-[#2b72f4]/40 px-4 py-2 text-sm font-semibold text-[#2b72f4] disabled:opacity-50"
              onClick={previewCsv}
            >
              Проверить
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-full bg-[#2b72f4] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              onClick={submitCsv}
            >
              Импортировать {csvPreview?.items.length ? `(${csvPreview.items.length})` : ""}
            </button>
          </div>
          {csvPreview && (
            <div className="space-y-2 text-sm">
              <p className="text-[var(--kb-muted)]">
                Готово: {csvPreview.items.length}
                {csvPreview.errors.length ? ` · ошибок: ${csvPreview.errors.length}` : ""}
              </p>
              {csvPreview.items.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[var(--kb-muted)]">
                      <tr>
                        <th className="px-3 py-2">Код</th>
                        <th className="px-3 py-2">Название</th>
                        <th className="px-3 py-2">Пошлина</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.items.slice(0, 40).map((it) => (
                        <tr key={it.code} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 font-mono">{it.codeDisplay}</td>
                          <td className="px-3 py-1.5">{it.titleRu}</td>
                          <td className="px-3 py-1.5">
                            {it.rate?.dutyPct != null ? `${it.rate.dutyPct}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {csvPreview.errors.slice(0, 8).map((err) => (
                <p key={`${err.line}-${err.message}`} className="text-xs text-red-600">
                  Строка {err.line}: {err.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "json" && (
        <div className="space-y-3 rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
          <p className="text-sm text-[var(--kb-muted)]">
            Для выгрузок из пайплайна LLM. Формат{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">{"{ items: [...] }"}</code>, до 500
            позиций. Обычным операторам удобнее режимы «Одна позиция» или «CSV».
          </p>
          <textarea
            className="min-h-[240px] w-full rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
          />
          <button
            type="button"
            disabled={busy}
            className="rounded-full bg-[#2b72f4] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            onClick={submitJson}
          >
            Импортировать JSON
          </button>
        </div>
      )}

      {formError && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {formError}
        </p>
      )}
      {result && (
        <pre className="overflow-x-auto rounded-[24px] border border-emerald-100 bg-emerald-50/60 p-4 text-xs text-emerald-900">
          {result}
        </pre>
      )}
      <TnvedCardDrawer code={cardCode} onClose={() => setCardCode(null)} />
    </section>
  );
}
