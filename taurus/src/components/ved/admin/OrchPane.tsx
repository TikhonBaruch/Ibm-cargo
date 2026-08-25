"use client";

import { VedEmptyState } from "../VedShell";
import type { AdminOrchState } from "./types";

export function OrchPane({
  orch,
  busy,
  onReload,
  onRetry,
}: {
  orch: AdminOrchState | null;
  busy: boolean;
  onReload: () => void;
  onRetry: (action: "retry_job" | "retry_outbox", id: string) => void;
}) {
  const failedJobs = orch?.jobs.filter((j) => ["FAILED", "DEAD"].includes(j.status)).length ?? 0;
  const failedOutbox = orch?.outbox.filter((o) => ["FAILED", "DEAD"].includes(o.status)).length ?? 0;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            orch?.health.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
          }`}
        >
          health: {orch ? (orch.health.ok ? "ok" : "degraded") : "…"}
        </span>
        <button
          type="button"
          className="rounded-full border px-3 py-1 text-xs font-semibold"
          disabled={busy}
          onClick={onReload}
        >
          Обновить
        </button>
      </div>
      {!orch && (
        <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
          <VedEmptyState title="Загрузка оркестрации…" hint="Jobs, outbox и deps подтягиваются с API." />
        </div>
      )}
      {orch && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: "calls", v: orch.health.calls.total },
              { k: "outbox pending", v: orch.health.outbox.pending },
              { k: "outbox failed", v: orch.health.outbox.failed },
              { k: "outbox dead", v: orch.health.outbox.dead },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-[24px] border border-black/[0.04] bg-white px-4 py-3 shadow-sm"
              >
                <div className="text-2xl font-bold">{s.v}</div>
                <div className="text-xs text-[var(--kb-muted)]">{s.k}</div>
              </div>
            ))}
          </div>
          {failedJobs === 0 && failedOutbox === 0 && (
            <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
              <VedEmptyState
                title="Нет FAILED jobs и outbox"
                hint="Очередь в норме. Обновите, если ждёте новую фоновую задачу."
                actionLabel="Обновить"
                onAction={onReload}
              />
            </div>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-base font-semibold">BackgroundJob</h2>
              {orch.jobs.length === 0 ? (
                <VedEmptyState
                  title="Нет фоновых задач"
                  hint="Jobs появятся при AI-enrich, notify и других фоновых операциях."
                />
              ) : (
                <ul className="max-h-[360px] space-y-2 overflow-y-auto text-sm">
                  {orch.jobs.map((j) => (
                    <li key={j.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {j.kind} · {j.status}
                          </div>
                          <div className="text-xs text-[var(--kb-muted)]">
                            attempts {j.attempts} · {new Date(j.createdAt).toLocaleString("ru-RU")}
                          </div>
                        </div>
                        {["FAILED", "DEAD"].includes(j.status) && (
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-full border border-[#2b72f4]/40 px-2.5 py-1 text-xs font-semibold text-[#2b72f4] disabled:opacity-50"
                            onClick={() => onRetry("retry_job", j.id)}
                          >
                            Retry
                          </button>
                        )}
                      </div>
                      {j.lastError && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-amber-800">{j.lastError}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-base font-semibold">ServiceOutbox</h2>
              {orch.outbox.length === 0 ? (
                <VedEmptyState
                  title="Outbox пуст"
                  hint="Письма и notify попадут сюда после событий просчёта и support."
                />
              ) : (
                <ul className="max-h-[360px] space-y-2 overflow-y-auto text-sm">
                  {orch.outbox.map((o) => (
                    <li key={o.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {o.template} · {o.status}
                          </div>
                          <div className="text-xs text-[var(--kb-muted)]">
                            {o.to} · attempts {o.attempts}
                          </div>
                        </div>
                        {["FAILED", "DEAD"].includes(o.status) && (
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-full border border-[#2b72f4]/40 px-2.5 py-1 text-xs font-semibold text-[#2b72f4] disabled:opacity-50"
                            onClick={() => onRetry("retry_outbox", o.id)}
                          >
                            Retry
                          </button>
                        )}
                      </div>
                      {o.lastError && (
                        <p className="mt-1 line-clamp-2 text-xs text-amber-800">{o.lastError}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold">ServiceCall</h2>
            {!orch.calls?.length ? (
              <VedEmptyState
                title="Нет вызовов сервисов"
                hint="ocr describe/reset и llm classify появятся после AI_DRAIN."
              />
            ) : (
              <ul className="max-h-[360px] space-y-2 overflow-y-auto text-sm">
                {orch.calls.map((c) => (
                  <li key={c.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div className="font-medium">
                      {c.service}/{c.operation} · {c.status}
                    </div>
                    <div className="text-xs text-[var(--kb-muted)]">
                      {c.durationMs != null ? `${c.durationMs} мс · ` : ""}
                      {c.calculationId ? `calc ${c.calculationId.slice(0, 8)} · ` : ""}
                      {new Date(c.createdAt).toLocaleString("ru-RU")}
                    </div>
                    {c.error && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-amber-800">{c.error}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold">Deps</h2>
            <ul className="flex flex-wrap gap-2 text-xs">
              {orch.health.deps.map((d) => (
                <li
                  key={d.service}
                  className={`rounded-full px-3 py-1 ${
                    !d.configured
                      ? "bg-slate-100 text-slate-600"
                      : d.ok
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {d.service}
                  {!d.configured ? " · off" : d.ok ? " · up" : " · down"}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
