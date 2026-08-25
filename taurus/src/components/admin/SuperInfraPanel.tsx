"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Copy, Check } from "lucide-react";
import { VedEmptyState } from "@/components/ved/VedShell";

type InfraCredential = {
  label: string;
  address?: string;
  login?: string;
  password?: string;
  notes?: string;
};

type InfraSection = {
  id: string;
  title: string;
  summary: string;
  credentials: InfraCredential[];
  structure?: string[];
};

function CopyField({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) {
    return (
      <div className="text-xs text-[#7a7f89]">
        <span className="font-medium text-slate-600">{label}:</span> — не задано
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 text-xs">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-600">{label}</div>
        <code className="mt-0.5 block break-all rounded bg-slate-100 px-2 py-1 text-[11px] text-[#0f172a]">
          {value}
        </code>
      </div>
      <button
        type="button"
        title="Копировать"
        className="mt-4 rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function SuperInfraPanel({ compact }: { compact?: boolean } = {}) {
  const [sections, setSections] = useState<InfraSection[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError("");
    fetch("/api/admin/infra", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d) => setSections(d.sections || []))
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className={`${compact ? "mt-0" : "mt-8"} rounded-2xl border border-slate-200 bg-white p-4 sm:p-5`}>
      {!compact && (
        <>
          <h2 className="text-base font-semibold text-[#0f172a]">Инфраструктура и доступы</h2>
          <p className="mt-1 text-xs text-[#7a7f89]">
            Структура среды и учётные данные из env. Раскройте блок — адрес, логин, пароль. Секреты не
            хранятся в git.
          </p>
        </>
      )}

      {loading && (
        <VedEmptyState title="Загрузка инфраструктуры…" hint="Секции и доступы из env." />
      )}
      {error && !loading && (
        <VedEmptyState
          title="Не удалось загрузить инфраструктуру"
          hint={error}
          actionLabel="Обновить"
          onAction={load}
        />
      )}
      {!loading && !error && sections.length === 0 && (
        <VedEmptyState title="Нет секций" hint="Env не отдал блоки инфраструктуры." />
      )}

      {!loading && !error && (
      <ul className="mt-4 space-y-2">
        {sections.map((section) => {
          const open = openId === section.id;
          return (
            <li key={section.id} className="overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 bg-slate-50 px-3 py-3 text-left hover:bg-slate-100"
                onClick={() => setOpenId(open ? null : section.id)}
                aria-expanded={open}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#0f172a]">{section.title}</div>
                  <div className="truncate text-xs text-[#7a7f89]">{section.summary}</div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <div className="space-y-4 border-t border-slate-200 bg-white px-3 py-3">
                  {section.structure && section.structure.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Структура
                      </div>
                      <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-700">
                        {section.structure.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Доступы
                    </div>
                    {section.credentials.map((cred) => (
                      <div
                        key={cred.label}
                        className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3"
                      >
                        <div className="text-sm font-medium text-[#0f172a]">{cred.label}</div>
                        <CopyField label="Адрес" value={cred.address} />
                        <CopyField label="Логин" value={cred.login} />
                        <CopyField label="Пароль" value={cred.password} />
                        {cred.notes && (
                          <p className="text-[11px] text-[#7a7f89]">{cred.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      )}
      <SuperAiPipelinePanel />
    </section>
  );
}

function SuperAiPipelinePanel() {
  const [orch, setOrch] = useState<{
    jobs?: Array<{ id: string; kind: string; status: string; lastError?: string | null }>;
    calls?: Array<{
      id: string;
      service: string;
      operation: string;
      status: string;
      error?: string | null;
    }>;
  } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/v1/platform/orch", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setOrch)
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  const failedJobs = (orch?.jobs || []).filter(
    (j) => j.kind === "AI_DRAIN" && ["FAILED", "DEAD"].includes(j.status)
  );
  const failedCalls = (orch?.calls || []).filter((c) =>
    ["ocr", "llm"].includes(c.service) && ["FAILED", "TIMEOUT"].includes(c.status)
  );

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="text-sm font-semibold text-[#0f172a]">AI pipeline (Qwen → DeepSeek)</h3>
      <p className="mt-1 text-xs text-[#7a7f89]">
        Сбои describe/reset/classify. Полный журнал и retry —{" "}
        <a className="text-[#2b72f4] underline" href="/admin/orch">
          /admin/orch
        </a>
        . Ключи моделей здесь не показываем.
      </p>
      {err && <p className="mt-2 text-xs text-amber-800">orch: {err}</p>}
      {!err && failedJobs.length === 0 && failedCalls.length === 0 && (
        <p className="mt-2 text-xs text-slate-600">Нет FAILED AI_DRAIN и ocr/llm вызовов в последней выборке.</p>
      )}
      {failedJobs.map((j) => (
        <p key={j.id} className="mt-2 whitespace-pre-wrap text-xs text-amber-900">
          job {j.kind} · {j.status}
          {j.lastError ? ` — ${j.lastError}` : ""}
        </p>
      ))}
      {failedCalls.map((c) => (
        <p key={c.id} className="mt-2 whitespace-pre-wrap text-xs text-amber-900">
          {c.service}/{c.operation} · {c.status}
          {c.error ? ` — ${c.error}` : ""}
        </p>
      ))}
    </div>
  );
}
