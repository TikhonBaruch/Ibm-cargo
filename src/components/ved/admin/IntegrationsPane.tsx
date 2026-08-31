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
    <section>
      <div className="search-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onReload}>
          Обновить
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn btn-primary btn-sm"
          onClick={onSaveToggles}
        >
          Сохранить выключатели
        </button>
      </div>
      {!integrations && <p className="meta">Загрузка…</p>}
      {integrations && (
        <div className="two">
          {(
            [
              ["payments", "Платежка", integrations.payments, "paymentsEnabled"] as const,
              ["llm", "LLM-кластер", integrations.llm, "llmEnrichEnabled"] as const,
              ["notify", "Notify / email", integrations.notify, "notifyEnabled"] as const,
            ] as const
          ).map(([key, title, block, toggleKey]) => {
            if (!block) return null;
            return (
              <div key={key} className="card">
                <div className="card-head">
                  <div>
                    <h3>{title}</h3>
                    <p>
                      Host: {block.host || "не задан (env)"} · latency{" "}
                      {block.health?.latencyMs != null ? `${block.health.latencyMs}ms` : "—"}
                    </p>
                  </div>
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
                {!block.configured && (
                  <div className="alert-box warn-box">
                    <strong>Не настроено в окружении</strong>
                    Ключи/URL только в env, не в UI. Toggle можно оставить выкл., пока health не зелёный.
                  </div>
                )}
                {block.configured && block.health?.ok === false && (
                  <div className="alert-box">
                    <strong>Сервис отвечает с ошибкой</strong>
                    Смотрите последние вызовы и логи контейнера; временно выключите toggle.
                  </div>
                )}
                {block.health?.error && <p className="meta">{block.health.error}</p>}
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(settings[toggleKey])}
                    onChange={(e) => onToggle(toggleKey, e.target.checked)}
                  />
                  Включено
                </label>
                <h3>Последние вызовы</h3>
                {block.recent.length === 0 ? (
                  <VedEmptyState title="Нет вызовов" hint="История появится после первого запроса к интеграции." />
                ) : (
                  <div className="activity-list">
                    {block.recent.map((r) => (
                      <div key={r.id} className="activity-item">
                        <div className={`dot${r.error ? " warn" : " ok"}`} />
                        <div>
                          <strong>{r.operation} · {r.status}</strong>
                          <span>
                            {new Date(r.createdAt).toLocaleString("ru-RU")}
                            {r.durationMs != null ? ` · ${r.durationMs}ms` : ""}
                            {r.error ? ` · ${r.error}` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
