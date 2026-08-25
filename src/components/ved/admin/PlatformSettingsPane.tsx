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
    <section className="max-w-lg">
      <div className="space-y-3 rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-sm">
        <label className="block text-sm">
          Порог confidence
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.01}
            value={settings.confidenceThreshold}
            onChange={(e) => onChange({ ...settings, confidenceThreshold: Number(e.target.value) })}
            className="w-full"
          />
          <span>{Math.round(settings.confidenceThreshold * 100)}%</span>
        </label>
        <label className="block text-sm">
          SLA по умолчанию, ч
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={settings.defaultSlaHours}
            onChange={(e) => onChange({ ...settings, defaultSlaHours: Number(e.target.value) })}
          />
        </label>
        <label className="block text-sm">
          Окно preferred broker, ч
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={settings.preferredClaimHours}
            onChange={(e) => onChange({ ...settings, preferredClaimHours: Number(e.target.value) })}
          />
        </label>
        <label className="block text-sm">
          Курс USD
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={settings.usdRate}
            onChange={(e) => onChange({ ...settings, usdRate: Number(e.target.value) })}
          />
        </label>
        <label className="block text-sm">
          Курс CNY
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={settings.cnyRate}
            onChange={(e) => onChange({ ...settings, cnyRate: Number(e.target.value) })}
          />
        </label>
        <label className="block text-sm">
          Курс EUR
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={settings.eurRate}
            onChange={(e) => onChange({ ...settings, eurRate: Number(e.target.value) })}
          />
        </label>
        <label className="block text-sm">
          Запас к курсу, %
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={settings.fxBufferPct}
            onChange={(e) => onChange({ ...settings, fxBufferPct: Number(e.target.value) })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.autoAssignBrokers}
            onChange={(e) => onChange({ ...settings, autoAssignBrokers: e.target.checked })}
          />
          Автоназначение брокера
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.marketplaceEnabled}
            onChange={(e) => onChange({ ...settings, marketplaceEnabled: e.target.checked })}
          />
          Маркетплейс брокеров
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.maintenanceMode}
            onChange={(e) => onChange({ ...settings, maintenanceMode: e.target.checked })}
          />
          Режим обслуживания
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.paymentsEnabled}
            onChange={(e) => onChange({ ...settings, paymentsEnabled: e.target.checked })}
          />
          Платежи / пополнение
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.llmEnrichEnabled}
            onChange={(e) => onChange({ ...settings, llmEnrichEnabled: e.target.checked })}
          />
          LLM enrich (внешний кластер)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.notifyEnabled}
            onChange={(e) => onChange({ ...settings, notifyEnabled: e.target.checked })}
          />
          Email / notify
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.mockTopupAllowed}
            onChange={(e) => onChange({ ...settings, mockTopupAllowed: e.target.checked })}
          />
          Mock topup (AND с env)
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="rounded-full bg-[#2b72f4] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Сохранить
        </button>
      </div>
    </section>
  );
}
