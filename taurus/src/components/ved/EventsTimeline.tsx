"use client";

import { useEffect, useState } from "react";
import { api } from "./VedShell";

type CalcEvent = {
  id: string;
  kind: string;
  createdAt: string;
  payload?: {
    from?: string;
    to?: string;
    note?: string;
    number?: string;
  } | null;
};

function label(ev: CalcEvent): string {
  const p = ev.payload;
  switch (ev.kind) {
    case "CREATED":
      return p?.number ? `Создан ${p.number}` : "Создан";
    case "AI_DRAFT":
      return "AI-черновик";
    case "STATUS":
      return p?.from && p?.to ? `${p.from} → ${p.to}` : "Смена статуса";
    case "PAID":
      return "Оплачен";
    case "CLAIMED":
      return "Взят брокером";
    case "ITEM_MAPPED":
      return "Позиции обновлены";
    case "APPROVED":
      return "Утверждён";
    case "NOTE":
      return p?.note || "Заметка";
    default:
      return ev.kind;
  }
}

export function EventsTimeline({ calculationId }: { calculationId: string }) {
  const [events, setEvents] = useState<CalcEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<{ events: CalcEvent[] }>(`/api/v1/calculations/${calculationId}/events`)
      .then((res) => {
        if (!cancelled) setEvents(res.events || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "events error");
      });
    return () => {
      cancelled = true;
    };
  }, [calculationId]);

  if (error) {
    return <p className="text-xs text-amber-700">{error}</p>;
  }
  if (!events.length) {
    return <p className="text-xs text-[var(--kb-muted)]">Событий пока нет</p>;
  }

  return (
    <ol className="space-y-2 border-l border-slate-200 pl-3 text-xs">
      {events.map((ev) => (
        <li key={ev.id} className="relative">
          <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-[#2b72f4]" />
          <div className="font-medium text-slate-800">{label(ev)}</div>
          <div className="text-[var(--kb-muted)]">
            {new Date(ev.createdAt).toLocaleString("ru-RU")} · {ev.kind}
          </div>
        </li>
      ))}
    </ol>
  );
}
