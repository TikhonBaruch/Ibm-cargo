"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Tag,
  Percent,
  Gift,
  Clock,
  PercentIcon,
} from "lucide-react";

interface PromoItem {
  icon: React.ReactNode;
  label: string;
  value: string;
}

interface Promo {
  id: string;
  title: string;
  content: string | null;
  publishedAt: string | null;
}

function parsePromos(content: string): PromoItem[] {
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const cleaned = line.replace(
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        ""
      );
      const match = cleaned.match(/^([^:]+):\s*(.+)$/);
      if (!match) return null;

      const [, label, value] = match;
      const lowerLabel = label.toLowerCase();

      let icon: React.ReactNode;
      let colorClass: string;

      if (lowerLabel.includes("скидк") || lowerLabel.includes("цена")) {
        icon = <Percent className="h-4 w-4" />;
        colorClass = "text-red-400";
      } else if (lowerLabel.includes("акци") || lowerLabel.includes("билет")) {
        icon = <Tag className="h-4 w-4" />;
        colorClass = "text-amber-400";
      } else if (
        lowerLabel.includes("подарок") ||
        lowerLabel.includes("бонус")
      ) {
        icon = <Gift className="h-4 w-4" />;
        colorClass = "text-purple-400";
      } else if (
        lowerLabel.includes("срок") ||
        lowerLabel.includes("дата") ||
        lowerLabel.includes("до")
      ) {
        icon = <Clock className="h-4 w-4" />;
        colorClass = "text-sky-400";
      } else {
        icon = <PercentIcon className="h-4 w-4" />;
        colorClass = "text-emerald-400";
      }

      return { icon, label: label.trim(), value: value.trim() };
    })
    .filter(Boolean) as PromoItem[];
}

export function PromosBlock() {
  const [promo, setPromo] = useState<Promo | null>(null);
  const [items, setItems] = useState<PromoItem[]>([]);

  useEffect(() => {
    fetch("/api/promos")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.content) {
          setPromo(data);
          setItems(parsePromos(data.content));
        }
      })
      .catch(() => {});
  }, []);

  if (!promo || items.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-amber-400/30 bg-amber-950/30 p-5"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
          </span>
          <h3 className="text-lg font-semibold text-slate-100">
            {promo.title}
          </h3>
        </div>
        {promo.publishedAt && (
          <span className="text-xs text-slate-500">
            Обновлено:{" "}
            {new Date(promo.publishedAt).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* Content grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"
          >
            <div className="mt-0.5">{item.icon}</div>
            <div>
              <div className="text-xs text-slate-400">{item.label}</div>
              <div className="text-sm font-medium text-slate-100">
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
