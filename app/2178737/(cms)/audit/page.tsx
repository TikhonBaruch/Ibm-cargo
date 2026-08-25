"use client";

import { useEffect, useState } from "react";

type AuditRow = {
  id: string;
  action?: string;
  entity?: string;
  createdAt?: string;
  user?: { email?: string | null; name?: string | null };
};

export default function SuperAuditPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/audit?limit=50", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d) => setLogs(d.logs || []))
      .catch((e) => setError(String(e.message || e)));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold">Audit log</h1>
      <p className="mt-1 text-sm text-[#7a7f89]">Действия staff (read-only)</p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <ul className="mt-4 space-y-2">
        {logs.map((row) => (
          <li key={row.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <div className="font-medium">
              {row.action || "—"} · {row.entity || "—"}
            </div>
            <div className="text-xs text-[#7a7f89]">
              {row.user?.email || row.user?.name || "—"} ·{" "}
              {row.createdAt ? new Date(row.createdAt).toLocaleString("ru-RU") : ""}
            </div>
          </li>
        ))}
        {!error && logs.length === 0 && (
          <li className="text-sm text-[#7a7f89]">Нет записей</li>
        )}
      </ul>
    </div>
  );
}
