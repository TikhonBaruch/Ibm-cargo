"use client";

import type { PlatformSettings } from "./types";

export function PlatformSettingsPane({
  settings,
  busy,
  onChange,
  onSave,
}: {
  settings: PlatformSettings;
  busy: boolean;
  onChange: (next: PlatformSettings) => void;
  onSave: () => void;
}) {
  return (
    <section style={{ maxWidth: 560 }}>
      <div className="card">
        <h3>Настройки платформы</h3>
        <div className="field">
          <label>Порог confidence · {Math.round(settings.confidenceThreshold * 100)}%</label>
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.01}
            value={settings.confidenceThreshold}
            onChange={(e) => onChange({ ...settings, confidenceThreshold: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>SLA по умолчанию, ч</label>
          <input
            type="number"
            value={settings.defaultSlaHours}
            onChange={(e) => onChange({ ...settings, defaultSlaHours: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Окно preferred broker, ч</label>
          <input
            type="number"
            value={settings.preferredClaimHours}
            onChange={(e) => onChange({ ...settings, preferredClaimHours: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Курс USD</label>
          <input
            type="number"
            value={settings.usdRate}
            onChange={(e) => onChange({ ...settings, usdRate: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Курс CNY</label>
          <input
            type="number"
            value={settings.cnyRate}
            onChange={(e) => onChange({ ...settings, cnyRate: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Курс EUR</label>
          <input
            type="number"
            value={settings.eurRate}
            onChange={(e) => onChange({ ...settings, eurRate: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Запас к курсу, %</label>
          <input
            type="number"
            value={settings.fxBufferPct}
            onChange={(e) => onChange({ ...settings, fxBufferPct: Number(e.target.value) })}
          />
        </div>
        {(
          [
            ["autoAssignBrokers", "Автоназначение брокера"],
            ["marketplaceEnabled", "Маркетплейс брокеров"],
            ["maintenanceMode", "Режим обслуживания"],
            ["paymentsEnabled", "Платежи / пополнение"],
            ["llmEnrichEnabled", "LLM enrich (внешний кластер)"],
            ["notifyEnabled", "Email / notify"],
            ["mockTopupAllowed", "Mock topup (AND с env)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(settings[key])}
              onChange={(e) => onChange({ ...settings, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <button type="button" disabled={busy} onClick={onSave} className="btn btn-primary btn-sm">
          Сохранить
        </button>
      </div>
    </section>
  );
}
