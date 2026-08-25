"use client";

import { useCallback, useEffect, useState } from "react";

type SeoRow = {
  id: string;
  pageKey: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
};

const DEFAULT_KEYS = ["home", "portfolio", "posts", "login", "register"];

export function SuperSeoPanel() {
  const [rows, setRows] = useState<SeoRow[]>([]);
  const [selected, setSelected] = useState("home");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [newKey, setNewKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/seo", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as SeoRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const row = rows.find((r) => r.pageKey === selected);
    setMetaTitle(row?.metaTitle || "");
    setMetaDescription(row?.metaDescription || "");
    setOgImage(row?.ogImage || "");
    setMessage("");
  }, [selected, rows]);

  const keys = Array.from(new Set([...DEFAULT_KEYS, ...rows.map((r) => r.pageKey)])).sort();

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/seo", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageKey: selected,
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
          ogImage: ogImage || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `${res.status}`);
      setMessage(`Сохранено: ${selected}`);
      await load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  const addKey = () => {
    const key = newKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!key) return;
    setSelected(key);
    setNewKey("");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#7a7f89]">
        Meta title / description / OG image по ключу страницы (`pageKey`). Seed: home, portfolio, posts.
      </p>

      {loading && <p className="text-sm text-[#7a7f89]">Загрузка…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-[#7a7f89]">Страница</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2b72f4]"
          >
            {keys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="новый pageKey"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2b72f4]"
          />
          <button
            type="button"
            onClick={addKey}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Добавить ключ
          </button>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="block text-sm">
          <span className="mb-1 block text-[#7a7f89]">Meta title</span>
          <input
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2b72f4]"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[#7a7f89]">Meta description</span>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2b72f4]"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[#7a7f89]">OG image URL</span>
          <input
            value={ogImage}
            onChange={(e) => setOgImage(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2b72f4]"
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-full bg-[#2b72f4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a5fd4] disabled:opacity-60"
        >
          {saving ? "Сохранение…" : "Сохранить SEO"}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase text-[#7a7f89]">
              <tr>
                <th className="px-3 py-2">pageKey</th>
                <th className="px-3 py-2">title</th>
                <th className="px-3 py-2">description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                  onClick={() => setSelected(r.pageKey)}
                >
                  <td className="px-3 py-2 font-medium">{r.pageKey}</td>
                  <td className="max-w-[220px] truncate px-3 py-2">{r.metaTitle || "—"}</td>
                  <td className="max-w-[320px] truncate px-3 py-2 text-[#7a7f89]">
                    {r.metaDescription || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
