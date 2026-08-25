"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, Trash2, Reply } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null };
  replies?: Comment[];
}

export function CommentsSection({ postSlug }: { postSlug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postSlug}/comments`);
      if (res.ok) setComments(await res.json());
    } catch {}
    setLoading(false);
  }, [postSlug]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/posts/${postSlug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), parentId: replyTo?.id || undefined }),
      });
      if (res.ok) { setContent(""); setReplyTo(null); fetchComments(); }
    } catch {}
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить комментарий?")) return;
    await fetch(`/api/posts/${postSlug}/comments?id=${id}`, { method: "DELETE" });
    fetchComments();
  };

  const renderComment = (c: Comment, depth = 0) => (
    <div key={c.id} className={depth > 0 ? "ml-6 border-l border-slate-700 pl-4" : ""}>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {c.author.image ? <img src={c.author.image} alt="" className="h-6 w-6 rounded-full" /> : <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300">{(c.author.name || "?")[0].toUpperCase()}</div>}
            <span className="text-sm font-medium text-slate-100">{c.author.name || "Аноним"}</span>
            <span className="text-[11px] text-slate-500">{new Date(c.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setReplyTo(replyTo?.id === c.id ? null : c)} className="rounded p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition" title="Ответить"><Reply className="h-3.5 w-3.5" /></button>
            <button onClick={() => handleDelete(c.id)} className="rounded p-1 text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition" title="Удалить"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.content}</p>
      </div>
      {c.replies?.map((r) => renderComment(r, depth + 1))}
    </div>
  );

  return (
    <div className="mt-12 border-t border-slate-800 pt-8">
      <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-100">
        <MessageSquare className="h-5 w-5" />
        Комментарии ({comments.reduce((a, c) => a + 1 + (c.replies?.length || 0), 0)})
      </h2>
      <form onSubmit={handleSubmit} className="mb-8">
        {replyTo && <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400"><Reply className="h-3 w-3" /> Ответ на <span className="font-medium text-slate-200">{replyTo.author.name}</span> <button type="button" onClick={() => setReplyTo(null)} className="ml-auto text-slate-500 hover:text-slate-200">✕</button></div>}
        <div className="flex gap-3">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Написать комментарий..." rows={3} className="flex-1 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-600/50 focus:outline-none resize-none" />
          <button type="submit" disabled={sending || !content.trim()} className="self-end rounded-xl bg-blue-600 px-4 py-3 text-white hover:bg-blue-500 transition disabled:opacity-50"><Send className="h-4 w-4" /></button>
        </div>
      </form>
      {loading ? <div className="text-center text-slate-400 py-8">Загрузка...</div> : comments.length === 0 ? <div className="text-center text-slate-400 py-8"><p>Пока нет комментариев</p></div> : <div className="space-y-1">{comments.map((c) => renderComment(c))}</div>}
    </div>
  );
}
