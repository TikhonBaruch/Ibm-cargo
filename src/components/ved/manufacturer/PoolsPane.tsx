"use client";

import { useState } from "react";
import { StatusPill, VedEmptyState } from "../VedShell";
import type { ManufacturerOrderRequest, ManufacturerPool } from "./types";

export function PoolsPane({
  requests,
  pools,
  busy,
  catalogHref = "/manufacturer/catalog",
  onAccept,
  onReject,
  onConfirm,
  onClose,
}: {
  requests: ManufacturerOrderRequest[];
  pools: ManufacturerPool[];
  busy: boolean;
  catalogHref?: string;
  onAccept: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onConfirm: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const incoming = requests.filter((r) => r.status === "SUBMITTED");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (requests.length === 0 && pools.length === 0) {
    return (
      <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
        <VedEmptyState
          title="Запросов пока нет"
          hint="Сначала опубликуйте SKU в каталоге. Когда импортёры отправят qty, здесь можно принять строки в сборный заказ."
          actionLabel="К каталогу"
          actionHref={catalogHref}
        />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold">Входящие запросы</h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-[var(--kb-muted)]">Новых запросов нет — смотрите сборки ниже.</p>
        ) : (
          <ul className="space-y-2">
            {incoming.map((r) => (
              <li
                key={r.id}
                className="rounded-[22px] border border-black/[0.04] bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {r.manufacturerSku.name}{" "}
                      <span className="text-[var(--kb-muted)]">· {r.manufacturerSku.sku}</span>
                    </p>
                    <p className="text-sm text-[var(--kb-muted)]">
                      {r.clientCompany?.name || "Компания"}
                      {r.clientCompany?.inn ? ` · ИНН ${r.clientCompany.inn}` : ""} · qty {r.qty}
                      {r.manufacturerSku.moq ? ` · MOQ ${r.manufacturerSku.moq}` : ""}
                    </p>
                    {r.note ? <p className="mt-1 text-sm">{r.note}</p> : null}
                  </div>
                  <StatusPill status={r.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAccept(r.id)}
                    className="rounded-full bg-[#2b72f4] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    В сборный заказ
                  </button>
                  {rejectId === r.id ? (
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        onReject(r.id, reason);
                        setRejectId(null);
                        setReason("");
                      }}
                    >
                      <input
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
                        placeholder="Причина"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                        minLength={2}
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-sm"
                      >
                        Отклонить
                      </button>
                      <button
                        type="button"
                        className="text-sm text-[var(--kb-muted)]"
                        onClick={() => setRejectId(null)}
                      >
                        Отмена
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRejectId(r.id);
                        setReason("");
                      }}
                      className="rounded-full border border-slate-200 px-4 py-1.5 text-sm"
                    >
                      Отклонить
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Сборные заказы</h2>
        {pools.length === 0 ? (
          <p className="text-sm text-[var(--kb-muted)]">Пул появится, когда примете первый запрос.</p>
        ) : (
          <ul className="space-y-3">
            {pools.map((p) => (
              <li
                key={p.id}
                className="rounded-[22px] border border-black/[0.04] bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.title || p.manufacturerSku.name}</p>
                    <p className="text-sm text-[var(--kb-muted)]">
                      {p.manufacturerSku.sku} · в сборке {p.qtyTotal}
                      {p.targetQty ? ` / цель ${p.targetQty}` : ""}
                    </p>
                  </div>
                  <StatusPill status={p.status} />
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {p.requests.map((line) => (
                    <li key={line.id} className="flex justify-between gap-2 text-[var(--kb-muted)]">
                      <span>
                        {line.clientCompany?.name || "Компания"} · qty {line.qty}
                      </span>
                      <StatusPill status={line.status} />
                    </li>
                  ))}
                </ul>
                {p.status === "OPEN" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || p.qtyTotal < 1}
                      onClick={() => onConfirm(p.id)}
                      className="rounded-full bg-[#2b72f4] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Подтвердить сборку
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onClose(p.id)}
                      className="rounded-full border border-slate-200 px-4 py-1.5 text-sm"
                    >
                      Закрыть
                    </button>
                  </div>
                ) : p.status === "CONFIRMED" ? (
                  <div className="mt-3 space-y-2">
                    <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      Партия набрана. Дальше импортёр делает просчёт ТН ВЭД (тариф брокера) — это не
                      оплата вам и не отгрузка. Можно закрыть сборку, когда хвост обработан.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onClose(p.id)}
                      className="rounded-full border border-slate-200 px-4 py-1.5 text-sm"
                    >
                      Закрыть
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
