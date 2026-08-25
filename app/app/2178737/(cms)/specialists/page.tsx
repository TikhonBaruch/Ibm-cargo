"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, X, Plus, ArrowLeft } from "lucide-react";
import { INPUT_CLASS, LABEL_CLASS } from "@/lib/constants";
import Image from "next/image";

interface Specialist {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  bio: string | null;
  specialization: string | null;
  phone: string | null;
  experience: number | null;
  sortOrder: number;
  showInTeam: boolean;
  role: string;
  _count: { posts: number };
}

export default function SpecialistsPage() {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSpecialists(); }, []);

  const fetchSpecialists = async () => {
    try {
      const res = await fetch("/api/admin/specialists", { credentials: "include" });
      if (res.ok) setSpecialists(await res.json());
    } catch (e) {
      console.error("Failed to fetch specialists:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (s: Specialist) => {
    setEditing(s.id);
    setEditForm({ ...s });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/admin/specialists/${editing}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: editForm.name,
        bio: editForm.bio,
        specialization: editForm.specialization,
        phone: editForm.phone,
        experience: editForm.experience ? parseInt(editForm.experience) : null,
        sortOrder: parseInt(editForm.sortOrder) || 0,
        showInTeam: editForm.showInTeam,
      }),
    });
    if (res.ok) {
      await fetchSpecialists();
      setEditing(null);
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-slate-400">Загрузка...</div></div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Специалисты</h1>
        <p className="text-sm text-slate-400 mt-1">Управление профилями специалистов для публичной страницы /specialists</p>
      </div>

      <div className="space-y-3">
        {specialists.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-800 bg-slate-900/50">
            {editing === s.id ? (
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-4">
                  {editForm.image ? (
                    <img src={editForm.image} alt="" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center text-xl text-slate-300">
                      {(editForm.name || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <input type="text" value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={`${INPUT_CLASS} w-64`} placeholder="Имя" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLASS}>Специализация</label>
                    <input type="text" value={editForm.specialization || ""} onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })} className={INPUT_CLASS} placeholder="Мастер кузовного ремонта" />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Телефон</label>
                    <input type="text" value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={INPUT_CLASS} placeholder="+7 (812) 123-45-67" />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Стаж (лет)</label>
                    <input type="number" value={editForm.experience || ""} onChange={(e) => setEditForm({ ...editForm, experience: e.target.value })} className={INPUT_CLASS} min="0" max="50" />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Порядок</label>
                    <input type="number" value={editForm.sortOrder || 0} onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })} className={INPUT_CLASS} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={LABEL_CLASS}>Биография</label>
                    <textarea value={editForm.bio || ""} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} className={INPUT_CLASS} placeholder="Подробное описание опыта и навыков..." />
                  </div>
                  <div className="md:col-span-2">
                    <label className={LABEL_CLASS}>URL изображения (аватар)</label>
                    <input type="text" value={editForm.image || ""} onChange={(e) => setEditForm({ ...editForm, image: e.target.value })} className={INPUT_CLASS} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <input type="checkbox" checked={editForm.showInTeam || false} onChange={(e) => setEditForm({ ...editForm, showInTeam: e.target.checked })} className="rounded border-slate-700 bg-slate-900" />
                      Показывать в команде
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Сохранение..." : "Сохранить"}
                  </button>
                  <button onClick={() => { setEditing(null); setEditForm({}); }} className="rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-400 hover:text-slate-100">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4">
                {s.image ? (
                  <img src={s.image} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center text-lg text-slate-300">
                    {(s.name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-100">{s.name || "Без имени"}</div>
                  <div className="text-xs text-slate-500">{s.specialization || "Не указана"} {s.experience ? `• ${s.experience} лет` : ""}</div>
                </div>
                <div className="text-xs text-slate-500">{s._count.posts} постов</div>
                <div className="flex items-center gap-1">
                  {s.showInTeam && <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">В команде</span>}
                  <button onClick={() => handleEdit(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100" title="Редактировать">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {specialists.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>Специалисты не найдены.</p>
          <p className="text-xs mt-1">Запустите seed-specialists.ts для создания тестовых данных.</p>
        </div>
      )}
    </div>
  );
}
