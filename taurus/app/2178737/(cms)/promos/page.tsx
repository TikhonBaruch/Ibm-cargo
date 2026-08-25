"use client";

import { useEffect, useState } from "react";
import { Save, Eye } from "lucide-react";

interface Promo {
  id: string;
  title: string;
  content: string | null;
  status: string;
  publishedAt: string | null;
}

const FIELDS = [
  { key: "discount", label: "Скидка", placeholder: "Скидка: до 30% на все работы", icon: "🏷️" },
  { key: "promo", label: "Акция", placeholder: "Акция: первый заказ со скидкой 15%", icon: "🎉" },
  { key: "bonus", label: "Бонус", placeholder: "Бонус: бесплатная консультация", icon: "🎁" },
  { key: "deadline", label: "Сроки", placeholder: "Сроки: до 31 июля 2026", icon: "⏰" },
];

function parseContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  content.split("\n").filter(Boolean).forEach((line) => {
    const cleaned = line.replace(
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ""
    );
    const match = cleaned.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      FIELDS.forEach((f) => {
        if (key.includes(f.key) || key.includes(f.label.toLowerCase())) {
          result[f.key] = match[2].trim();
        }
      });
    }
  });
  return result;
}

function buildContent(fields: Record<string, string>): string {
  return FIELDS.map((f) => `${f.icon} ${f.label}: ${fields[f.key] || ""}`)
    .filter((line) => !line.endsWith(": "))
    .join("\n");
}

export default function PromosPage() {
  const [promo, setPromo] = useState<Promo | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/promos", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setPromo(data);
          setFields(parseContent(data.content || ""));
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const content = buildContent(fields);

    try {
      const res = await fetch("/api/admin/promos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: promo?.id || null,
          title: "Акции и скидки",
          content,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Ошибка сохранения");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      // Refresh promo data
      const refreshRes = await fetch("/api/admin/promos", { credentials: "include" });
      const data = await refreshRes.json();
      if (data) setPromo(data);
    } catch (e) {
      console.error("Failed to save promo:", e);
      alert("Ошибка соединения с сервером");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-600 focus:outline-none";
  const labelClass = "block mb-1 text-sm text-slate-400";

  // Preview
  const previewContent = buildContent(fields);
  const previewItems = previewContent
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const cleaned = line.replace(
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        ""
      );
      const match = cleaned.match(/^([^:]+):\s*(.+)$/);
      return match ? { label: match[1].trim(), value: match[2].trim() } : null;
    })
    .filter(Boolean);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Акции и скидки</h1>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-green-400">Сохранено!</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="space-y-4">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className={labelClass}>
                {field.icon} {field.label}
              </label>
              <input
                type="text"
                value={fields[field.key] || ""}
                onChange={(e) =>
                  setFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                className={inputClass}
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>

        {/* Preview */}
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
            <Eye className="h-4 w-4" />
            Предпросмотр
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-amber-950/30 p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
              </span>
              <h3 className="text-lg font-semibold text-slate-100">
                Акции и скидки
              </h3>
            </div>
            {previewItems.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {previewItems.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"
                  >
                    <div className="text-xs text-slate-400">{item!.label}</div>
                    <div className="text-sm font-medium text-slate-100">
                      {item!.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Заполните поля слева — превью появится здесь
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
