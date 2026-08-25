"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const TYPE_LABELS: Record<string, string> = {
  NEWS: "Новость",
  WORK: "Работа",
  UPDATE: "Обновление",
  EVENT: "Событие",
  PROMO: "Акция",
};

const TYPE_COLORS: Record<string, string> = {
  NEWS: "bg-blue-600/80",
  WORK: "bg-emerald-600/80",
  UPDATE: "bg-amber-600/80",
  EVENT: "bg-purple-600/80",
  PROMO: "bg-red-600/80",
};

interface Post {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  type: string;
  location: string | null;
  publishedAt: string | null;
}

const PER_PAGE = 9;
const ALL_FILTERS = ["Все", "NEWS", "WORK", "UPDATE", "EVENT", "PROMO"] as const;

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string>("Все");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/posts?limit=200")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPosts(Array.isArray(data) ? data : data.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = active === "Все" ? posts : posts.filter((p) => p.type === active);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleFilterChange = (filter: string) => {
    setActive(filter);
    setPage(1);
  };

  const typeCounts = posts.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="text-slate-100">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
            <ArrowLeft className="h-4 w-4" /> На главную
          </Link>
        </div>

        <div className="mb-2 text-[10px] tracking-[0.2em] text-slate-500 uppercase">Блог</div>
        <h1 className="mb-2 text-3xl font-bold text-slate-100">Публикации</h1>
        <p className="mb-8 text-sm text-slate-400">
          {filtered.length > 0
            ? `${filtered.length} ${filtered.length === 1 ? "публикация" : filtered.length < 5 ? "публикации" : "публикаций"}`
            : "Публикаций пока нет"}
        </p>

        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-2">
          {ALL_FILTERS.map((filter) => {
            const isActive = filter === active;
            const count = filter === "Все" ? posts.length : (typeCounts[filter] || 0);
            return (
              <button
                key={filter}
                onClick={() => handleFilterChange(filter)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {filter === "Все" ? "Все" : TYPE_LABELS[filter] || filter}
                {count > 0 && <span className="ml-1.5 text-[10px] opacity-60">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="py-12 text-center text-slate-400">Загрузка...</div>
        ) : paginated.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
            <p className="text-slate-400">Нет публикаций в этой категории</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 transition hover:border-slate-700"
              >
                {post.coverImage ? (
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image src={post.coverImage} alt={post.title} fill className="object-cover transition group-hover:scale-105" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                  </div>
                ) : (
                  <div className="aspect-[16/10] bg-gradient-to-br from-slate-800 to-slate-900" />
                )}
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${TYPE_COLORS[post.type] || "bg-slate-600/80"}`}>
                      {TYPE_LABELS[post.type] || post.type}
                    </span>
                    {post.publishedAt && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.publishedAt).toLocaleDateString("ru-RU")}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100 line-clamp-2 group-hover:text-white">{post.title}</h3>
                  {post.location && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />{post.location}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg border border-slate-800 p-2 text-slate-400 hover:text-slate-200 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 rounded-lg text-sm transition ${p === page ? "bg-blue-600 text-white" : "border border-slate-800 text-slate-400 hover:text-slate-200"}`}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-800 p-2 text-slate-400 hover:text-slate-200 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
