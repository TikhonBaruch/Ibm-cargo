"use client";

import { useCallback, useEffect, useState } from "react";

type Booking = {
  id: string;
  name: string;
  phone: string;
  service?: string | null;
  message?: string | null;
  status: string;
  createdAt: string;
};

export default function SuperBookingsPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bookings", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
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

  const setStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `${res.status}`);
      return;
    }
    await load();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold text-[#0f172a]">Заявки CMS</h1>
      <p className="text-sm text-[#7a7f89]">
        Legacy модель `Booking` (лендинг). ВЭД-просчёты — в{" "}
        <a href="/admin/bookings" className="font-medium text-[#2b72f4]">
          /admin/bookings
        </a>
        .
      </p>

      {loading && <p className="text-sm text-[#7a7f89]">Загрузка…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase text-[#7a7f89]">
            <tr>
              <th className="px-3 py-2">Дата</th>
              <th className="px-3 py-2">Контакт</th>
              <th className="px-3 py-2">Сообщение</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-b border-slate-50 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-[#7a7f89]">
                  {new Date(b.createdAt).toLocaleString("ru-RU")}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{b.name || "—"}</div>
                  <div className="text-xs text-[#7a7f89]">
                    {b.phone}
                    {b.service ? ` · ${b.service}` : ""}
                  </div>
                </td>
                <td className="max-w-xs px-3 py-2 text-[#7a7f89]">{b.message || "—"}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">
                    {b.status}
                  </span>
                </td>
                <td className="space-x-1 whitespace-nowrap px-3 py-2">
                  {b.status !== "DONE" && (
                    <button
                      type="button"
                      onClick={() => setStatus(b.id, "DONE")}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      DONE
                    </button>
                  )}
                  {b.status !== "NEW" && (
                    <button
                      type="button"
                      onClick={() => setStatus(b.id, "NEW")}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      NEW
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-[#7a7f89]">
                  Нет заявок
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
