"use client";

import { StatusPill, VedEmptyState } from "../VedShell";
import type { AdminIntegrations, PlatformSettings } from "./types";

export function IntegrationsPane({
  integrations,
  settings,
  busy,
  onReload,
  onSaveToggles,
  onToggle,
}: {
  integrations: AdminIntegrations | null;
  settings: PlatformSettings;
  busy: boolean;
  onReload: () => void;
  onSaveToggles: () => void;
  onToggle: (key: "paymentsEnabled" | "llmEnrichEnabled" | "notifyEnabled", value: boolean) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm"
          onClick={onReload}
        >
          Обновить
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-full bg-[#2b72f4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={onSaveToggles}
        >
          Сохранить выключатели
        </button>
      </div>
      {!integrations && <p className="text-sm text-[var(--kb-muted)]">Загрузка…</p>}
      {integrations && (
        <div className="grid gap-5 lg:grid-cols-2">
          {(
            [
              ["payments", "Платежка", integrations.payments, "paymentsEnabled"] as const,
              ["llm", "LLM-кластер", integrations.llm, "llmEnrichEnabled"] as const,
              ["notify", "Notify / email", integrations.notify, "notifyEnabled"] as const,
            ] as const
          ).map(([key, title, block, toggleKey]) => {
            if (!block) return null;
            return (
              <div
                key={key}
                className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">{title}</h2>
                  <StatusPill
                    status={
                      !block.configured
                        ? "DRAFT"
                        : block.health?.ok
                          ? "DONE"
                          : block.health?.ok === false
                            ? "SLA_RISK"
                            : "QUEUED"
                    }
                  />
                </div>
                <p className="text-xs text-[var(--kb-muted)]">
                  Host: {block.host || "не задан (env)"} · latency{" "}
                  {block.health?.latencyMs != null ? `${block.health.latencyMs}ms` : "—"}
                </p>
                {!block.configured && (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Не настроено в окружении (ключи/URL только в env, не в UI). Проверьте runbook →
                    integrations / Track A; toggle ниже можно оставить выкл., пока health не зелёный.
                  </p>
                )}
                {block.configured && block.health?.ok === false && (
                  <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    Сервис отвечает с ошибкой. Смотрите последние вызовы ниже и логи контейнера;
                    временно выключите toggle, чтобы не бить API впустую.
                  </p>
                )}
                {block.health?.error && (
                  <p className="mt-1 text-xs text-amber-700">{block.health.error}</p>
                )}
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(settings[toggleKey])}
                    onChange={(e) => onToggle(toggleKey, e.target.checked)}
                  />
                  Включено
                </label>
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Последние вызовы
                </h3>
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
                  {block.recent.map((r) => (
                    <li key={r.id} className="rounded-lg bg-slate-50 px-2 py-1.5">
                      {new Date(r.createdAt).toLocaleString("ru-RU")} · {r.operation} · {r.status}
                      {r.durationMs != null ? ` · ${r.durationMs}ms` : ""}
                      {r.error ? ` · ${r.error}` : ""}
                    </li>
                  ))}
                  {block.recent.length === 0 && (
                    <li className="list-none">
                      <VedEmptyState title="Нет вызовов" hint="История появится после первого запроса к интеграции." />
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
