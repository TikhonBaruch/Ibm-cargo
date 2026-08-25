"use client";

import { useEffect, useState } from "react";
import { VedEmptyState } from "@/components/ved/VedShell";

type CmsStats = {
  totalPosts: number;
  pendingPosts: number;
  publishedPosts: number;
  totalReviews: number;
  totalBookings: number;
  pendingBookings: number;
  totalAuditToday: number;
};

export function SuperCmsStats() {
  const [stats, setStats] = useState<CmsStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError("");
    fetch("/api/admin/stats", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d) => setStats(d))
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (error) {
    return (
      <VedEmptyState
        title="Не удалось загрузить сводку"
        hint={error}
        actionLabel="Обновить"
        onAction={load}
      />
    );
  }
  if (loading || !stats) {
    return <VedEmptyState title="Загрузка сводки…" hint="Публикации, отзывы, заявки CMS." />;
  }

  const cards = [
    { label: "Публикации", value: stats.totalPosts, hint: `${stats.publishedPosts} опубл. · ${stats.pendingPosts} на модерации` },
    { label: "Отзывы", value: stats.totalReviews, hint: "всего" },
    { label: "Заявки CMS", value: stats.totalBookings, hint: `${stats.pendingBookings} новых` },
    { label: "Audit сегодня", value: stats.totalAuditToday, hint: "событий" },
  ];

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <li key={c.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-[#7a7f89]">{c.label}</div>
          <div className="mt-1 text-2xl font-semibold text-[#0f172a]">{c.value}</div>
          <div className="mt-0.5 text-xs text-[#7a7f89]">{c.hint}</div>
        </li>
      ))}
    </ul>
  );
}
