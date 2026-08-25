"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

interface PortfolioItem {
  id: string;
  title: string;
  slug: string;
  coverImage?: string | null;
  excerpt?: string | null;
}

interface PortfolioGridProps {
  items: PortfolioItem[];
}

export function PortfolioGrid({ items }: PortfolioGridProps) {
  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500">
        Пока нет избранных работ
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
        >
          <Link
            href={`/posts/${item.slug}`}
            className="group block overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 transition hover:border-slate-700"
          >
            {item.coverImage && (
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={item.coverImage}
                  alt={item.title}
                  fill
                  className="object-cover transition group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            )}
            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-100 transition group-hover:text-white">
                {item.title}
              </h3>
              {item.excerpt && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                  {item.excerpt}
                </p>
              )}
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
