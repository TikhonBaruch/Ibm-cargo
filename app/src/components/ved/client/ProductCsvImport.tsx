"use client";

import { useRef, useState } from "react";
import { useVedToast } from "../feedback/VedToast";
import type { FormItem } from "./types";

export type ImportPreviewRow = {
  rowIndex: number;
  name: string;
  description?: string;
  qty?: number;
  unitPrice?: number;
  currency?: string;
  attrs?: FormItem["attrs"];
  rowStatus: "MATCHED_PRECEDENT" | "CLASSIFIED_NEW" | "PARSE_ERROR" | "LOW_CONFIDENCE";
  hsCode?: string;
  confidence?: number;
  llmEnrich?: string;
  parseWarnings?: string[];
};

export type ImportPreviewResponse = {
  tariffCode: string;
  maxRows: number;
  rowCount: number;
  summary: {
    matchedPrecedent: number;
    classifiedNew: number;
    lowConfidence: number;
    parseError: number;
  };
  rows: ImportPreviewRow[];
};

function statusLabel(s: ImportPreviewRow["rowStatus"]): string {
  switch (s) {
    case "MATCHED_PRECEDENT":
      return "прецедент";
    case "CLASSIFIED_NEW":
      return "подбор";
    case "LOW_CONFIDENCE":
      return "низкая уверенность";
    case "PARSE_ERROR":
      return "ошибка";
    default:
      return s;
  }
}

function statusClass(s: ImportPreviewRow["rowStatus"]): string {
  switch (s) {
    case "MATCHED_PRECEDENT":
      return "bg-emerald-50 text-emerald-800";
    case "CLASSIFIED_NEW":
      return "bg-sky-50 text-sky-800";
    case "LOW_CONFIDENCE":
      return "bg-amber-50 text-amber-900";
    case "PARSE_ERROR":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function ProductCsvImport({
  tariffCode,
  country,
  shipmentValue,
  busy,
  maxPos,
  onApply,
}: {
  tariffCode: string;
  country: string;
  shipmentValue: string;
  busy: boolean;
  maxPos: number;
  onApply: (payload: {
    items: FormItem[];
    titleHint: string;
    descriptionHint: string;
    create: boolean;
  }) => void;
}) {
  const { toast } = useVedToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  const usable = (preview?.rows || []).filter(
    (r) => r.rowStatus !== "PARSE_ERROR" && !excluded.has(r.rowIndex)
  );

  const runPreview = async (file: File) => {
    setPreviewBusy(true);
    setPreview(null);
    setExcluded(new Set());
    try {
      let data: ImportPreviewResponse & { error?: string };
      if (/\.pdf$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
        const pdfBase64 = btoa(binary);
        const res = await fetch("/api/v1/imports/products/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfBase64,
            filename: file.name,
            tariffCode,
            country: country || undefined,
            shipmentValue: shipmentValue || undefined,
          }),
        });
        data = (await res.json()) as ImportPreviewResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || `Preview ${res.status}`);
      } else if (/\.xlsx$/i.test(file.name) || /\.xls$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
        const xlsxBase64 = btoa(binary);
        const res = await fetch("/api/v1/imports/products/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            xlsxBase64,
            filename: file.name,
            tariffCode,
            country: country || undefined,
            shipmentValue: shipmentValue || undefined,
          }),
        });
        data = (await res.json()) as ImportPreviewResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || `Preview ${res.status}`);
      } else {
        const csv = await file.text();
        const res = await fetch("/api/v1/imports/products/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csv,
            tariffCode,
            country: country || undefined,
            shipmentValue: shipmentValue || undefined,
          }),
        });
        data = (await res.json()) as ImportPreviewResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || `Preview ${res.status}`);
      }
      setPreview(data);
      toast(
        `Распознано ${data.rowCount} поз.: прецедент ${data.summary.matchedPrecedent}, подбор ${data.summary.classifiedNew}`,
        { variant: "ok" }
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка разбора файла", { variant: "error" });
    } finally {
      setPreviewBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const toItems = (): FormItem[] =>
    usable.slice(0, maxPos).map((r) => ({
      name: r.name,
      qty: r.qty ?? 1,
      unitPrice: r.unitPrice ?? 0,
      attrs: r.attrs
        ? {
            brand: r.attrs.brand,
            material: r.attrs.material,
            composition: r.attrs.composition,
            manufacturerName: r.attrs.manufacturerName,
            originCountry: r.attrs.originCountry,
            hsHint: r.hsCode || r.attrs.hsHint,
            netWeightKg:
              r.attrs.netWeightKg != null ? String(r.attrs.netWeightKg) : undefined,
          }
        : r.hsCode
          ? { hsHint: r.hsCode }
          : undefined,
    }));

  const apply = (create: boolean) => {
    if (!usable.length) {
      toast("Нет строк для подстановки", { variant: "error" });
      return;
    }
    if (usable.length > maxPos) {
      toast(`Будут взяты первые ${maxPos} из ${usable.length} (лимит тарифа)`, {
        variant: "info",
      });
    }
    const items = toItems();
    const first = usable[0];
    onApply({
      items,
      titleHint: first.name.slice(0, 120),
      descriptionHint: first.description || first.name,
      create,
    });
  };

  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">Таблица CSV / XLSX / PDF</p>
          <p className="text-xs text-slate-500">
            Когда позиций много — загрузите файл вместо ручного ввода. Колонки: наименование,
            описание, кол-во, цена, бренд… PDF — текстовый слой invoice / packing list. Макс.{" "}
            {maxPos} поз. по тарифу. Черновик кодов — брокер проверит.
          </p>
        </div>
        <label className="cursor-pointer rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2b72f4] shadow-sm ring-1 ring-slate-200">
          {previewBusy ? "Разбор…" : "Загрузить файл"}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            disabled={busy || previewBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runPreview(f);
            }}
          />
        </label>
      </div>

      {preview && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-600">
            Итого: {preview.summary.matchedPrecedent} прецедент · {preview.summary.classifiedNew}{" "}
            подбор · {preview.summary.lowConfidence} низкая увер. · {preview.summary.parseError}{" "}
            ошибка
          </p>
          <div className="max-h-56 overflow-auto rounded-xl border border-slate-100 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 font-medium">#</th>
                  <th className="px-2 py-1.5 font-medium">Товар</th>
                  <th className="px-2 py-1.5 font-medium">HS</th>
                  <th className="px-2 py-1.5 font-medium">Статус</th>
                  <th className="px-2 py-1.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.rowIndex} className="border-t border-slate-50">
                    <td className="px-2 py-1.5 text-slate-400">{r.rowIndex}</td>
                    <td className="max-w-[10rem] truncate px-2 py-1.5" title={r.name}>
                      {r.name}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px]">
                      {r.hsCode || "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 ${statusClass(r.rowStatus)}`}
                      >
                        {statusLabel(r.rowStatus)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      {r.rowStatus !== "PARSE_ERROR" && (
                        <button
                          type="button"
                          className="text-slate-400 hover:text-red-500"
                          onClick={() => {
                            setExcluded((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.rowIndex)) next.delete(r.rowIndex);
                              else next.add(r.rowIndex);
                              return next;
                            });
                          }}
                        >
                          {excluded.has(r.rowIndex) ? "вернуть" : "искл."}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || previewBusy || !usable.length}
              onClick={() => apply(false)}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 disabled:opacity-40"
            >
              Подставить в форму ({Math.min(usable.length, maxPos)})
            </button>
            <button
              type="button"
              disabled={busy || previewBusy || !usable.length}
              onClick={() => apply(true)}
              className="rounded-full bg-[#2b72f4] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Создать заявку из таблицы
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
