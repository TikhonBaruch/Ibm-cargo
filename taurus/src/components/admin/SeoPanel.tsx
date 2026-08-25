"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { INPUT_CLASS, LABEL_CLASS } from "@/lib/constants";

interface SeoPanelProps {
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  pageUrl: string;
  onChange: (field: string, value: string) => void;
}

export function SeoPanel({ metaTitle, metaDescription, ogImage, pageUrl, onChange }: SeoPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const displayTitle = metaTitle || "(не задано)";
  const displayDesc = metaDescription || "(не задано)";
  const displayUrl = `cargobroker${pageUrl}`;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-white">SEO-настройки</span>
          {metaTitle && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/50 text-green-300">Настроено</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4 bg-slate-900/30">
          <div className="p-3 rounded-lg bg-white text-black">
            <div className="text-[12px] text-green-700 mb-0.5">{displayUrl}</div>
            <div className="text-[16px] text-blue-700 font-medium hover:underline cursor-pointer leading-tight">{displayTitle}</div>
            <div className="text-[12px] text-gray-600 mt-0.5 line-clamp-2">{displayDesc}</div>
          </div>

          {ogImage && (
            <div className="rounded-lg overflow-hidden border border-white/10">
              <div className="bg-gray-800 p-2 text-[10px] text-slate-400">OG Preview</div>
              <img src={ogImage} alt="OG preview" className="w-full h-40 object-cover" />
            </div>
          )}

          <div>
            <label className={LABEL_CLASS}>SEO Title</label>
            <input
              type="text"
              value={metaTitle}
              onChange={(e) => onChange("metaTitle", e.target.value)}
              placeholder="Заголовок страницы"
              maxLength={60}
              className={INPUT_CLASS}
            />
            <div className="text-[10px] text-slate-500 mt-1">{metaTitle.length}/60 символов</div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Meta Description</label>
            <textarea
              value={metaDescription}
              onChange={(e) => onChange("metaDescription", e.target.value)}
              placeholder="Краткое описание для поисковых систем"
              maxLength={160}
              rows={3}
              className={INPUT_CLASS}
            />
            <div className="text-[10px] text-slate-500 mt-1">{metaDescription.length}/160 символов</div>
          </div>

          <div>
            <label className={LABEL_CLASS}>OG Image URL</label>
            <input
              type="text"
              value={ogImage}
              onChange={(e) => onChange("ogImage", e.target.value)}
              placeholder="URL изображения для превью в соцсетях"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}
    </div>
  );
}
