"use client";

import { VedEmptyState } from "../VedShell";
import type { AdminAuditRow } from "./types";

export function AuditPane({ rows }: { rows: AdminAuditRow[] }) {
  if (rows.length === 0) {
    return (
      <section>
        <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
          <VedEmptyState
            title="Журнал пуст"
            hint="Действия администраторов (settings, assign, adjust) появятся здесь автоматически."
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      <ul className="space-y-2 text-sm">
        {rows.map((a) => (
          <li
            key={a.id}
            className="rounded-2xl border border-black/[0.04] bg-white px-4 py-3 shadow-sm"
          >
            <span className="text-[var(--kb-muted)]">{new Date(a.createdAt).toLocaleString("ru-RU")}</span> ·{" "}
            {a.userName} · {a.action} · {a.entity} · {a.details}
          </li>
        ))}
      </ul>
    </section>
  );
}
