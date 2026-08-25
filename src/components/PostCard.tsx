"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, MapPin } from "lucide-react";

interface PostCardProps {
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

const typeLabels: Record<string, string> = {
  NEWS: "Новость",
  WORK: "Работа",
  UPDATE: "Обновление",
  EVENT: "Событие",
};

const typeColors: Record<string, string> = {
  NEWS: "bg-blue-500/20 text-blue-400",
  WORK: "bg-emerald-500/20 text-emerald-400",
  UPDATE: "bg-amber-500/20 text-amber-400",
  EVENT: "bg-purple-500/20 text-purple-400",
};

export function PostCard({
  title,
  slug,
  excerpt,
  coverImage,
  type,
  location,
  publishedAt,
  createdAt,
}: PostCardProps) {
  const date = publishedAt || createdAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Link
        href={`/posts/${slug}`}
        className="group block overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 transition hover:border-slate-700 hover:bg-slate-900"
      >
        {coverImage && (
          <div className="relative aspect-[16/10] overflow-hidden">
            <Image
              src={coverImage}
              alt={title}
              fill
              className="object-cover transition group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        )}

        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${typeColors[type] || "bg-slate-700 text-slate-300"}`}
            >
              {typeLabels[type] || type}
            </span>
            {location && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
            )}
          </div>

          <h3 className="text-base font-semibold text-slate-100 transition group-hover:text-white">
            {title}
          </h3>

          {excerpt && (
            <p className="mt-1.5 line-clamp-2 text-sm text-slate-400">
              {excerpt}
            </p>
          )}

          <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="h-3 w-3" />
            {new Date(date).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
