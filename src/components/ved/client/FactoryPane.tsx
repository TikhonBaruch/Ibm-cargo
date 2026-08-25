"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusPill, VedEmptyState, api } from "../VedShell";
import { useVedToast } from "../feedback/VedToast";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import type { CatalogSku, ClientSegment, FactoryOrderRequest } from "./types";
import { CLIENT_SEGMENT_HINTS, CLIENT_SEGMENT_LABELS } from "@/lib/ved/sku-order";
import { ManufacturerSuggest, type ManufacturerSuggestValue } from "./ManufacturerSuggest";

function parseCsv(text: string): Array<{ sku: string; qty: number; note?: string }> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Array<{ sku: string; qty: number; note?: string }> = [];
  for (const line of lines) {
    if (/^sku\s*,/i.test(line)) continue;
    const [sku, qtyRaw, note] = line.split(",").map((p) => p.trim());
    const qty = Number(qtyRaw);
    if (!sku || !Number.isInteger(qty) || qty < 1) continue;
    out.push({ sku, qty, note: note || undefined });
  }
  return out;
}

export function FactoryPane({
  catalogSkus,
  segment,
  requests,
  newCalcHref,
  onChanged,
}: {
  catalogSkus: CatalogSku[];
  segment: ClientSegment;
  requests: FactoryOrderRequest[] | null;
  newCalcHref: (opts: { skuId: string; qty: number; requestId?: string }) => string;
  onChanged: () => Promise<void> | void;
}) {
  const { toast } = useVedToast();
  const rows = requests;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [skuId, setSkuId] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [csv, setCsv] = useState("");
  const [manufacturer, setManufacturer] = useState<ManufacturerSuggestValue>({
    manufacturerName: "",
  });
  const wholesale = segment === "WHOLESALE";
  const hint = CLIENT_SEGMENT_HINTS[segment];

  const selected = useMemo(
    () => catalogSkus.find((s) => s.id === skuId) || null,
    [catalogSkus, skuId]
  );

  const skusForManufacturer = useMemo(() => {
    const companyId = manufacturer.companyId;
    if (!companyId) return catalogSkus;
    return catalogSkus.filter((s) => s.company.id === companyId);
  }, [catalogSkus, manufacturer.companyId]);

  const submitOne = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/factory/requests", {
        method: "POST",
        body: JSON.stringify({
          manufacturerSkuId: skuId,
          qty: Number(qty),
          note: note.trim() || undefined,
        }),
      });
      toast("Запрос отправлен", { variant: "ok" });
      setNote("");
      await onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const submitCsv = async () => {
    const parsed = parseCsv(csv);
    if (!parsed.length) {
      toast("В CSV нужны строки sku,qty", { variant: "error" });
      return;
    }
    const lines = parsed
      .map((p) => {
        const sku = catalogSkus.find((s) => s.sku === p.sku);
        if (!sku) return null;
        return { manufacturerSkuId: sku.id, qty: p.qty, note: p.note };
      })
      .filter(Boolean);
    if (!lines.length) {
      toast("Артикулы из CSV не найдены в каталоге", { variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const out = await api<{ created: unknown[]; errors: unknown[] }>("/api/v1/factory/requests/bulk", {
        method: "POST",
        body: JSON.stringify({ lines }),
      });
      toast(`Создано ${out.created.length}${out.errors.length ? `, ошибок ${out.errors.length}` : ""}`, {
        variant: out.errors.length ? "info" : "ok",
      });
      setCsv("");
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    setBusy(true);
    try {
      await api(`/api/v1/factory/requests/${id}/cancel`, { method: "POST", body: "{}" });
      toast("Запрос отменён", { variant: "ok" });
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (rows === null && !error) {
    return <p className="text-sm text-[var(--kb-muted)]">Загрузка запросов…</p>;
  }

  return (
    <section className="space-y-5">
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Производитель</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Сборный заказ и каталог SKU
          </p>
        </div>
      </div>
      <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
        <ManufacturerSuggest value={manufacturer} onChange={setManufacturer} disabled={busy} />
        <p className="mt-3 text-xs text-[var(--kb-muted)]">
          Ниже — запрос qty по опубликованному SKU (сборный заказ). Нового производителя без SKU
          можно указать в «Новый просчёт».
        </p>
      </div>

      <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--kb-muted)]">
          {CLIENT_SEGMENT_LABELS[segment]}
        </p>
        <p className="mt-1 text-sm text-[var(--kb-muted)]">{hint}</p>
        {segment === "RETAIL_SMALL" && selected?.moq ? (
          <p className="mt-2 text-sm">
            MOQ производителя {selected.moq}. Ваш qty идёт в общую сборку, не обязан быть полным MOQ.
          </p>
        ) : null}

        {selected ? (
          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm">
            <p className="font-medium">{selected.name}</p>
            <p className="text-[var(--kb-muted)]">
              {selected.company.name} · {selected.sku}
              {selected.originCountry ? ` · ${selected.originCountry}` : ""}
            </p>
            <p className="mt-1 text-[var(--kb-muted)]">
              {selected.netWeightKg != null ? `нетто ${selected.netWeightKg} кг` : "нетто —"}
              {selected.moq ? ` · MOQ ${selected.moq}` : ""}
              {selected.packMultiple ? ` · кратность ${selected.packMultiple}` : ""}
            </p>
            {selected.openPool ? (
              <p className="mt-1">
                В открытой сборке {selected.openPool.qtyTotal}
                {selected.openPool.targetQty ? ` / цель ${selected.openPool.targetQty}` : ""} (без
                данных других покупателей)
              </p>
            ) : (
              <p className="mt-1 text-[var(--kb-muted)]">Открытой сборки по этому SKU пока нет.</p>
            )}
          </div>
        ) : null}

        {skusForManufacturer.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--kb-muted)]">
            Пока нет опубликованных SKU. Укажите производителя выше или сделайте просчёт ТН ВЭД в
            «Новый просчёт».
          </p>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitOne();
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--kb-muted)]">
                Артикул производителя
              </span>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={skuId}
                onChange={(e) => setSkuId(e.target.value)}
                required
              >
                <option value="">Выберите SKU</option>
                {skusForManufacturer.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.company.name ? `${s.company.name} · ` : ""}
                    {s.sku} — {s.name}
                    {s.moq ? ` (MOQ ${s.moq})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block max-w-[12rem]">
              <span className="mb-1 block text-xs font-medium text-[var(--kb-muted)]">Количество</span>
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--kb-muted)]">Комментарий</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Необязательно"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !skuId}
              className="rounded-full bg-[#2b72f4] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Запросить в сборный заказ
            </button>
          </form>
        )}

        {wholesale ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium">Опт: загрузка CSV</p>
            <p className="mt-1 text-xs text-[var(--kb-muted)]">
              Колонки: sku,qty,note — артикул как в каталоге производителя.
            </p>
            <textarea
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
              rows={4}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"sku,qty,note\nNB-T14-16,20,хвост май"}
            />
            <button
              type="button"
              disabled={busy || !csv.trim()}
              onClick={() => void submitCsv()}
              className="mt-2 rounded-full border border-slate-200 px-4 py-2 text-sm"
            >
              Загрузить строки
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!rows?.length ? (
        <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
          <VedEmptyState
            title="Запросов производителю пока нет"
            hint="Выберите опубликованный SKU и количество — производитель соберёт мелкие заказы в партию."
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[22px] border border-black/[0.04] bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="font-medium">
                  {r.manufacturerSku.name}{" "}
                  <span className="text-[var(--kb-muted)]">· {r.manufacturerSku.sku}</span>
                </p>
                <p className="text-sm text-[var(--kb-muted)]">
                  qty {r.qty}
                  {r.pool?.qtyTotal != null
                    ? ` · в сборке ${r.pool.qtyTotal}${r.pool.targetQty ? ` / ${r.pool.targetQty}` : ""}`
                    : ""}
                  {r.rejectReason ? ` · ${r.rejectReason}` : ""}
                </p>
                {r.status === "CONFIRMED" ? (
                  <p className="mt-1 text-sm">
                    Партия набрана. Следующий шаг — просчёт ТН ВЭД (тариф брокера), не оплата
                    производителю.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={r.status} />
                {r.manufacturerSku.id ? (
                  <Link
                    href={newCalcHref({
                      skuId: r.manufacturerSku.id,
                      qty: r.qty,
                      requestId: r.id,
                    })}
                    className="rounded-full bg-[#2b72f4] px-3 py-1 text-sm font-semibold text-white"
                  >
                    Просчитать ТН ВЭД
                  </Link>
                ) : null}
                {r.status === "SUBMITTED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void cancel(r.id)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-sm"
                  >
                    Отменить
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FactoryHoldPane({ homeHref }: { homeHref: string }) {
  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Производитель</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Сборный заказ — модуль макета суперприложения
          </p>
        </div>
        <Link href={homeHref} className="btn btn-ghost btn-sm">
          На главную
        </Link>
      </div>
      <DesignerStub
        title="Производитель / сборный заказ"
        intent="Дизайнер вынес фабрику на плитку главной, не в сайдбар."
        gap="Клиентский factory UI выключен (FACTORY_UI). Код экрана живой — включите флаг, чтобы создавать запросы."
      />
    </>
  );
}
