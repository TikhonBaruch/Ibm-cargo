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
    <section>
      <div className="search-row">
        <span className={`pill ${orch?.health.ok ? "ok" : "warn"}`}>
          health: {orch ? (orch.health.ok ? "ok" : "degraded") : "…"}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onReload}>
          Обновить
        </button>
      </div>
      {!orch && (
        <div className="card">
          <VedEmptyState title="Загрузка оркестрации…" hint="Jobs, outbox и deps подтягиваются с API." />
        </div>
      )}
      {orch && (
        <>
          <div className="stats">
            <div className="stat">
              <div className="v">{orch.health.calls.total}</div>
              <div className="k">calls</div>
            </div>
            <div className="stat">
              <div className="v">{orch.health.outbox.pending}</div>
              <div className="k">outbox pending</div>
            </div>
            <div className="stat">
              <div className="v">{orch.health.outbox.failed}</div>
              <div className="k">outbox failed</div>
            </div>
            <div className="stat">
              <div className="v">{orch.health.outbox.dead}</div>
              <div className="k">outbox dead</div>
            </div>
          </div>
          {failedJobs === 0 && failedOutbox === 0 && (
            <div className="card">
              <VedEmptyState
                title="Нет FAILED jobs и outbox"
                hint="Очередь в норме. Обновите, если ждёте новую фоновую задачу."
                actionLabel="Обновить"
                onAction={onReload}
              />
            </div>
          )}
          <div className="two">
            <div className="card">
              <h3>BackgroundJob</h3>
              {orch.jobs.length === 0 ? (
                <VedEmptyState
                  title="Нет фоновых задач"
                  hint="Jobs появятся при AI-enrich, notify и других фоновых операциях."
                />
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>Kind</th>
                      <th>Статус</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {orch.jobs.map((j) => (
                      <tr key={j.id}>
                        <td>
                          {j.kind}
                          {j.lastError ? <div className="meta">{j.lastError}</div> : null}
                        </td>
                        <td>
                          {j.status} · attempts {j.attempts}
                          <div className="meta">{new Date(j.createdAt).toLocaleString("ru-RU")}</div>
                        </td>
                        <td>
                          {["FAILED", "DEAD"].includes(j.status) && (
                            <button
                              type="button"
                              disabled={busy}
                              className="btn btn-ghost btn-sm"
                              onClick={() => onRetry("retry_job", j.id)}
                            >
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card">
              <h3>ServiceOutbox</h3>
              {orch.outbox.length === 0 ? (
                <VedEmptyState
                  title="Outbox пуст"
                  hint="Письма и notify попадут сюда после событий просчёта и support."
                />
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>Шаблон</th>
                      <th>Кому</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {orch.outbox.map((o) => (
                      <tr key={o.id}>
                        <td>
                          {o.template} · {o.status}
                          {o.lastError ? <div className="meta">{o.lastError}</div> : null}
                        </td>
                        <td>
                          {o.to}
                          <div className="meta">attempts {o.attempts}</div>
                        </td>
                        <td>
                          {["FAILED", "DEAD"].includes(o.status) && (
                            <button
                              type="button"
                              disabled={busy}
                              className="btn btn-ghost btn-sm"
                              onClick={() => onRetry("retry_outbox", o.id)}
                            >
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div className="card">
            <h3>ServiceCall</h3>
            {!orch.calls?.length ? (
              <VedEmptyState
                title="Нет вызовов сервисов"
                hint="ocr describe/reset и llm classify появятся после AI_DRAIN."
              />
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Сервис</th>
                    <th>Статус</th>
                    <th>Когда</th>
                  </tr>
                </thead>
                <tbody>
                  {orch.calls.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.service}/{c.operation}
                        {c.error ? <div className="meta">{c.error}</div> : null}
                      </td>
                      <td>
                        {c.status}
                        {c.durationMs != null ? ` · ${c.durationMs} мс` : ""}
                      </td>
                      <td>
                        {new Date(c.createdAt).toLocaleString("ru-RU")}
                        {c.calculationId ? ` · ${c.calculationId.slice(0, 8)}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <h3>Deps</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {orch.health.deps.map((d) => (
                <span
                  key={d.service}
                  className={`pill ${!d.configured ? "muted" : d.ok ? "ok" : "warn"}`}
                >
                  {d.service}
                  {!d.configured ? " · off" : d.ok ? " · up" : " · down"}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
