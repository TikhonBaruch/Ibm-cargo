"use client";

import { useState, useEffect } from "react";
import { Send, MessageCircle, Share2, Check, X, Loader2, ExternalLink } from "lucide-react";

interface SocialPost { id: string; platform: string; status: string; sentAt: string | null; error: string | null; }

const PLATFORMS = [
  { id: "telegram", name: "Telegram", icon: Send, color: "bg-blue-500 hover:bg-blue-600" },
  { id: "whatsapp", name: "WhatsApp", icon: MessageCircle, color: "bg-green-500 hover:bg-green-600" },
  { id: "vk", name: "VK", icon: Share2, color: "bg-blue-600 hover:bg-blue-700" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидает", color: "text-yellow-400" },
  sent: { label: "Отправлено", color: "text-green-400" },
  failed: { label: "Ошибка", color: "text-red-400" },
};

export function SocialPostButton({ postId, postTitle, postUrl, postExcerpt }: { postId: string; postTitle: string; postUrl: string; postExcerpt?: string; }) {
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => { if (showPanel) fetchSocialPosts(); }, [showPanel, postId]);

  const fetchSocialPosts = async () => { try { const r = await fetch(`/api/admin/social?postId=${postId}`); if (r.ok) setSocialPosts(await r.json()); } catch {} };

  const handleSend = async (platform: string) => {
    setSending(platform);
    try {
      const cr = await fetch("/api/admin/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, platform }) });
      if (cr.status === 409 || !cr.ok) { setSending(null); return; }
      const sp = await cr.json();
      const text = `${postTitle}\n\n${postExcerpt || ""}`.trim();
      const eu = encodeURIComponent(postUrl), et = encodeURIComponent(text);
      const urls: Record<string, string> = { telegram: `https://t.me/share/url?url=${eu}&text=${et}`, whatsapp: `https://wa.me/?text=${et}%20${eu}`, vk: `https://vk.com/share.php?url=${eu}&title=${et}` };
      if (urls[platform]) window.open(urls[platform], "_blank", "width=600,height=400");
      await fetch("/api/admin/social", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sp.id, status: "sent" }) });
      fetchSocialPosts();
    } catch {} finally { setSending(null); }
  };

  const getStatus = (p: string) => socialPosts.find((s) => s.platform === p && s.status !== "failed");

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600 hover:text-white transition"><Share2 className="h-3.5 w-3.5" /> Поделиться</button>
      {showPanel && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-medium text-slate-100">Поделиться</h4><button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button></div>
          <div className="space-y-2">
            {PLATFORMS.map((p) => { const ex = getStatus(p.id); const Icon = p.icon; return (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-slate-400" /><span className="text-sm text-slate-300">{p.name}</span>{ex && <span className={`text-xs ${STATUS_LABELS[ex.status]?.color || ""}`}>{STATUS_LABELS[ex.status]?.label || ex.status}</span>}</div>
                <button onClick={() => handleSend(p.id)} disabled={sending === p.id || ex?.status === "sent"} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-white transition disabled:opacity-50 ${ex?.status === "sent" ? "bg-green-800 cursor-default" : p.color}`}>
                  {sending === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : ex?.status === "sent" ? <Check className="h-3 w-3" /> : <ExternalLink className="h-3 w-3" />}
                  {ex?.status === "sent" ? "Отправлено" : "Отправить"}
                </button>
              </div>
            ); })}
          </div>
        </div>
      )}
    </div>
  );
}
