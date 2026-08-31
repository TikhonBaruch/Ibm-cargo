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
    <section>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Производитель</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Сборный заказ и каталог SKU
          </p>
        </div>
      </div>
      <div className="card">
        <ManufacturerSuggest value={manufacturer} onChange={setManufacturer} disabled={busy} />
        <p className="meta" style={{ marginTop: 10 }}>
          Ниже — запрос qty по опубликованному SKU (сборный заказ). Нового производителя без SKU
          можно указать в «Новый просчёт».
        </p>
      </div>

      <div className="card">
        <h3>{CLIENT_SEGMENT_LABELS[segment]}</h3>
        <p className="meta" style={{ marginTop: 0, marginBottom: 12 }}>{hint}</p>
        {segment === "RETAIL_SMALL" && selected?.moq ? (
          <p className="meta">
            MOQ производителя {selected.moq}. Ваш qty идёт в общую сборку, не обязан быть полным MOQ.
          </p>
        ) : null}

        {selected ? (
          <div className="activity-item" style={{ marginBottom: 12 }}>
            <div>
              <strong>{selected.name}</strong>
              <span>
                {selected.company.name} · {selected.sku}
                {selected.originCountry ? ` · ${selected.originCountry}` : ""}
                {" · "}
                {selected.netWeightKg != null ? `нетто ${selected.netWeightKg} кг` : "нетто —"}
                {selected.moq ? ` · MOQ ${selected.moq}` : ""}
                {selected.packMultiple ? ` · кратность ${selected.packMultiple}` : ""}
              </span>
              {selected.openPool ? (
                <span>
                  В открытой сборке {selected.openPool.qtyTotal}
                  {selected.openPool.targetQty ? ` / цель ${selected.openPool.targetQty}` : ""} (без
                  данных других покупателей)
                </span>
              ) : (
                <span>Открытой сборки по этому SKU пока нет.</span>
              )}
            </div>
          </div>
        ) : null}

        {skusForManufacturer.length === 0 ? (
          <p className="meta">
            Пока нет опубликованных SKU. Укажите производителя выше или сделайте просчёт ТН ВЭД в
            «Новый просчёт».
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitOne();
            }}
          >
            <div className="field">
              <label>Артикул производителя</label>
              <select
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
            </div>
            <div className="field" style={{ maxWidth: "12rem" }}>
              <label>Количество</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Комментарий</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Необязательно"
              />
            </div>
            <button type="submit" disabled={busy || !skuId} className="btn btn-primary btn-sm">
              Запросить в сборный заказ
            </button>
          </form>
        )}

        {wholesale ? (
          <div className="field" style={{ marginTop: 18 }}>
            <label>Опт: загрузка CSV</label>
            <span className="meta">Колонки: sku,qty,note — артикул как в каталоге производителя.</span>
            <textarea
              rows={4}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"sku,qty,note\nNB-T14-16,20,хвост май"}
              style={{ fontFamily: "ui-monospace, monospace" }}
            />
            <button
              type="button"
              disabled={busy || !csv.trim()}
              onClick={() => void submitCsv()}
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 8 }}
            >
              Загрузить строки
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="alert-box">{error}</p> : null}

      {!rows?.length ? (
        <div className="card">
          <VedEmptyState
            title="Запросов производителю пока нет"
            hint="Выберите опубликованный SKU и количество — производитель соберёт мелкие заказы в партию."
          />
        </div>
      ) : (
        <div className="card">
          <h3>Запросы</h3>
          <table className="data">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Кол-во</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.manufacturerSku.name}
                    <div className="meta">{r.manufacturerSku.sku}</div>
                    {r.status === "CONFIRMED" ? (
                      <div className="meta">
                        Партия набрана. Следующий шаг — просчёт ТН ВЭД, не оплата производителю.
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {r.qty}
                    {r.pool?.qtyTotal != null
                      ? ` · в сборке ${r.pool.qtyTotal}${r.pool.targetQty ? ` / ${r.pool.targetQty}` : ""}`
                      : ""}
                    {r.rejectReason ? ` · ${r.rejectReason}` : ""}
                  </td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {r.manufacturerSku.id ? (
                        <Link
                          href={newCalcHref({
                            skuId: r.manufacturerSku.id,
                            qty: r.qty,
                            requestId: r.id,
                          })}
                          className="btn btn-primary btn-sm"
                        >
                          Просчитать ТН ВЭД
                        </Link>
                      ) : null}
                      {r.status === "SUBMITTED" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void cancel(r.id)}
                          className="btn btn-ghost btn-sm"
                        >
                          Отменить
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
