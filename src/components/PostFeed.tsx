"use client";

import { useState } from "react";
import { PostCard } from "./PostCard";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  type: string;
  location?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}

interface PostFeedProps {
  initialPosts: Post[];
}

const typeFilters = [
  { value: "ALL", label: "Все" },
  { value: "WORK", label: "Работы" },
  { value: "NEWS", label: "Новости" },
  { value: "UPDATE", label: "Обновления" },
  { value: "EVENT", label: "События" },
];

export function PostFeed({ initialPosts }: PostFeedProps) {
  const [filter, setFilter] = useState("ALL");

  const filtered =
    filter === "ALL"
      ? initialPosts
      : initialPosts.filter((p) => p.type === filter);

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {typeFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f.value
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          Пока нет публикаций
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((post) => (
            <PostCard key={post.id} {...post} />
          ))}
        </div>
      )}
    </div>
  );
}
