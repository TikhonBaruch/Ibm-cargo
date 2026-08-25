"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Save, ArrowLeft, Star } from "lucide-react";

interface Review {
  id: string;
  author: string;
  car: string | null;
  text: string;
  rating: number;
  date: string | null;
  isPublished: boolean;
  sortOrder: number;
}

export default function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [editing, setEditing] = useState<Review | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchReviews = () => {
    fetch("/api/admin/reviews", { credentials: "include" })
      .then((r) => r.json())
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReviews(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить отзыв?")) return;
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
      if (res.ok) {
        setReviews((r) => r.filter((x) => x.id !== id));
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Ошибка удаления");
      }
    } catch {
      alert("Ошибка соединения с сервером");
    }
  };

  const handleTogglePublish = async (review: Review) => {
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !review.isPublished }),
      });
      if (res.ok) {
        setReviews((r) => r.map((x) => (x.id === review.id ? { ...x, isPublished: !x.isPublished } : x)));
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Ошибка обновления");
      }
    } catch {
      alert("Ошибка соединения с сервером");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400">Загрузка...</div>;
  }

  if (creating || editing) {
    return (
      <ReviewForm
        review={editing}
        onDone={() => { setCreating(false); setEditing(null); fetchReviews(); }}
        onCancel={() => { setCreating(false); setEditing(null); }}
      />
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Отзывы</h1>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          <Plus className="h-4 w-4" /> Новый отзыв
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-400">
              <th className="p-4">Автор</th>
              <th className="p-4">Отзыв</th>
              <th className="p-4">Авто/Услуга</th>
              <th className="p-4">Оценка</th>
              <th className="p-4">Статус</th>
              <th className="p-4">Действия</th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Нет отзывов</td></tr>
            ) : reviews.map((review) => (
              <tr key={review.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="p-4 font-medium text-slate-100">{review.author}</td>
                <td className="p-4 text-sm text-slate-400 max-w-xs truncate">{review.text}</td>
                <td className="p-4 text-sm text-slate-400">{review.car || "—"}</td>
                <td className="p-4">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < review.rating ? "fill-yellow-500 text-yellow-500" : "text-slate-600"}`} />
                    ))}
                  </div>
                </td>
                <td className="p-4">
                  <button onClick={() => handleTogglePublish(review)} className={`rounded-full px-2 py-1 text-xs font-medium ${review.isPublished ? "bg-green-900/50 text-green-300" : "bg-slate-700 text-slate-400"}`}>
                    {review.isPublished ? "Опубликован" : "Черновик"}
                  </button>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(review)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(review.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReviewForm({ review, onDone, onCancel }: { review: Review | null; onDone: () => void; onCancel: () => void }) {
  const [author, setAuthor] = useState(review?.author || "");
  const [car, setCar] = useState(review?.car || "");
  const [text, setText] = useState(review?.text || "");
  const [rating, setRating] = useState(review?.rating || 5);
  const [date, setDate] = useState(review?.date || "");
  const [isPublished, setIsPublished] = useState(review?.isPublished ?? true);
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-600 focus:outline-none";
  const labelClass = "block mb-1 text-sm text-slate-400";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = { author, car, text, rating, date, isPublished };
    try {
      const url = review ? `/api/admin/reviews/${review.id}` : "/api/admin/reviews";
      const method = review ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Ошибка сохранения");
        setSaving(false);
        return;
      }
    } catch {
      alert("Ошибка соединения с сервером");
      setSaving(false);
      return;
    }
    setSaving(false);
    onDone();
  };

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-100"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-2xl font-bold text-slate-100">{review ? "Редактирование" : "Новый отзыв"}</h1>
      </div>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div>
          <label className={labelClass}>Автор *</label>
          <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} required className={inputClass} placeholder="Имя автора" />
        </div>
        <div>
          <label className={labelClass}>Авто / Услуга</label>
          <input type="text" value={car} onChange={(e) => setCar(e.target.value)} className={inputClass} placeholder="BMW X5, Покраска бампера" />
        </div>
        <div>
          <label className={labelClass}>Текст отзыва *</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} required rows={5} className={inputClass} placeholder="Текст отзыва..." />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Оценка</label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
                  <Star className={`w-6 h-6 ${n <= rating ? "fill-yellow-500 text-yellow-500" : "text-slate-600"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Дата</label>
            <input type="text" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} placeholder="15 мая" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="rounded border-slate-700 bg-slate-900" />
              Опубликован
            </label>
          </div>
        </div>
        <div className="flex gap-4 pt-4">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "Сохранение..." : "Сохранить"}
          </button>
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-800 px-6 py-2.5 text-sm text-slate-400 hover:text-slate-100">Отмена</button>
        </div>
      </form>
    </div>
  );
}
