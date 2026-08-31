"use client";

import { VedEmptyState } from "../VedShell";
import type { AdminAuditRow } from "./types";

export function AuditPane({ rows }: { rows: AdminAuditRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <VedEmptyState
          title="Журнал пуст"
          hint="Действия администраторов (settings, assign, adjust) появятся здесь автоматически."
        />
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Журнал</h3>
      <div className="activity-list">
        {rows.map((a) => (
          <div key={a.id} className="activity-item">
            <div className="dot" />
            <div>
              <strong>
                {a.userName} · {a.action}
              </strong>
              <span>
                {new Date(a.createdAt).toLocaleString("ru-RU")} · {a.entity}
                {a.details ? ` · ${a.details}` : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
