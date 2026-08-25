"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { VedEmptyState } from "@/components/ved/VedShell";

export function SuperSiteSettingsPanel() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetch("/api/admin/settings/restricted-mode", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (next: boolean) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/settings/restricted-mode", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `${res.status}`);
      setEnabled(Boolean(body.enabled));
      setMessage(body.enabled ? "Restricted mode включён" : "Restricted mode выключен");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#0f172a]">Restricted mode</h2>
        <p className="mt-1 text-sm text-[#7a7f89]">
          Сайтовый флаг `site_settings.restricted_mode` (только SUPER_ADMIN). Не путать с VED{" "}
          <code className="text-xs">maintenanceMode</code> в{" "}
          <Link href="/admin/settings" className="font-medium text-[#2b72f4]">
            /admin/settings
          </Link>
          .
        </p>

        {loading && (
          <VedEmptyState title="Загрузка настроек…" hint="Restricted mode из site_settings." />
        )}
        {error && !loading && (
          <VedEmptyState
            title="Не удалось загрузить флаг"
            hint={error}
            actionLabel="Обновить"
            onAction={load}
          />
        )}
        {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}

        {!loading && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                enabled ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {enabled ? "ВКЛ" : "ВЫКЛ"}
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(!enabled)}
              className="rounded-full bg-[#2b72f4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a5fd4] disabled:opacity-60"
            >
              {saving ? "…" : enabled ? "Выключить" : "Включить"}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#0f172a]">VED platform</h2>
        <p className="mt-1 text-sm text-[#7a7f89]">
          Операционные выключатели платежей / LLM / notify / maintenance — в кабинете платформы.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { href: "/admin/settings", label: "Настройки платформы" },
            { href: "/admin/integrations", label: "Интеграции" },
            { href: "/admin/orch", label: "Оркестрация" },
            { href: "/admin/users", label: "Пользователи VED" },
          ].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="block rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:border-[#2b72f4]/40"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
