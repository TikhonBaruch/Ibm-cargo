"use client";

import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Trash2,
  Save,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Upload,
  Loader2,
  X,
} from "lucide-react";
import NextImage from "next/image";

interface GalleryItem {
  before: string;
  after: string;
  title: string;
  desc: string;
}

interface Section {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  isActive: boolean;
}

function ImageUpload({ value, onChange, label }: { value: string; onChange: (url: string) => void; label: string }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "gallery");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        onChange(data.url);
      }
    } catch {}
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {value ? (
        <div className="relative group">
          <div className="relative h-32 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <NextImage src={value} alt={label} fill className="object-cover" sizes="200px" />
          </div>
          <button
            onClick={() => onChange("")}
            className="absolute top-2 right-2 p-1 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center h-32 rounded-xl border border-dashed cursor-pointer transition ${
            dragOver ? "border-blue-500 bg-blue-900/20" : "border-slate-700 hover:border-slate-600"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
          ) : (
            <>
              <Upload className="h-6 w-6 text-slate-500 mb-1" />
              <span className="text-xs text-slate-500">Нажмите или перетащите</span>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}

export default function GalleryPage() {
  const [section, setSection] = useState<Section | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [batchUploading, setBatchUploading] = useState(false);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => { fetchSection(); }, []);

  const fetchSection = async () => {
    try {
      const res = await fetch("/api/admin/sections?page=landing", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const gallery = data.find((s: Section) => s.type === "gallery");
        if (gallery) {
          setSection(gallery);
          let contentItems: GalleryItem[] = [];
          try { contentItems = JSON.parse(gallery.content || "{}").items || []; } catch {}
          setItems(contentItems);
        }
      }
    } catch (e) {
      console.error("Failed to fetch gallery section:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!section) return;
    setSaving(true);
    const res = await fetch(`/api/admin/sections/${section.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: section.title, content: JSON.stringify({ items }) }),
    });
    if (res.ok) await fetchSection();
    setSaving(false);
  };

  const addItem = () => {
    setItems([...items, { before: "", after: "", title: "", desc: "" }]);
    setEditingIndex(items.length);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
  };

  const updateItem = (index: number, field: keyof GalleryItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setBatchUploading(true);
    const newItems: GalleryItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "gallery");

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          newItems.push({
            before: data.url,
            after: "",
            title: file.name.replace(/\.[^.]+$/, ""),
            desc: "",
          });
        }
      } catch {}
    }

    if (newItems.length > 0) {
      setItems([...items, ...newItems]);
    }

    setBatchUploading(false);
    if (batchInputRef.current) batchInputRef.current.value = "";
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setItems(newItems);
    if (editingIndex === index) setEditingIndex(newIndex);
    else if (editingIndex === newIndex) setEditingIndex(index);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newItems = [...items];
    const draggedItem = newItems[dragIndex];
    newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, draggedItem);
    setItems(newItems);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-slate-400">Загрузка...</div></div>;
  if (!section) return <div className="text-center py-12 text-slate-500">Секция галереи не найдена. Создайте её в настройках CMS.</div>;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Галерея работ</h1>
          <p className="text-sm text-slate-400 mt-1">Управление фото «До/После» для лендинга</p>
        </div>
        <div className="flex gap-3">
          <button onClick={addItem} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            <Plus className="h-4 w-4" /> Добавить фото
          </button>
          <button
            onClick={() => batchInputRef.current?.click()}
            disabled={batchUploading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {batchUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {batchUploading ? "Загрузка..." : "Загрузить несколько"}
          </button>
          <input
            ref={batchInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleBatchUpload}
            className="hidden"
          />
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-700 rounded-2xl">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 text-slate-600" />
          <p>Нет фото в галерее</p>
          <p className="text-sm mt-1">Нажмите «Добавить фото» чтобы начать</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`rounded-2xl border bg-slate-900/50 overflow-hidden transition ${
                dragIndex === idx ? "border-blue-500 opacity-50" : "border-slate-800"
              }`}
            >
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-800/30 transition" onClick={() => setEditingIndex(editingIndex === idx ? null : idx)}>
                <GripVertical className="h-5 w-5 text-slate-600 shrink-0 cursor-grab" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-100">{item.title || `Фото ${idx + 1}`}</span>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{item.desc || "Без описания"}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); moveItem(idx, "up"); }} disabled={idx === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); moveItem(idx, "down"); }} disabled={idx === items.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeItem(idx); }} className="p-1.5 rounded-lg text-red-400 hover:bg-red-900/30"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {editingIndex === idx && (
                <div className="border-t border-slate-800 p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Название</label>
                      <input type="text" value={item.title} onChange={(e) => updateItem(idx, "title", e.target.value)} placeholder="Название работы" className="w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Описание</label>
                      <input type="text" value={item.desc} onChange={(e) => updateItem(idx, "desc", e.target.value)} placeholder="Описание работы" className="w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <ImageUpload value={item.before} onChange={(url) => updateItem(idx, "before", url)} label='Фото "До"' />
                    <ImageUpload value={item.after} onChange={(url) => updateItem(idx, "after", url)} label='Фото "После"' />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
