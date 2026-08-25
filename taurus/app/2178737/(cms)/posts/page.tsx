"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Check,
  X,
  Save,
  ArrowLeft,
  Star,
  Download,
  ExternalLink,
  ImageIcon,
} from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import NextImage from "next/image";
import { SeoPanel } from "@/components/admin/SeoPanel";
import { SocialPostButton } from "@/components/SocialPostButton";

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  coverImage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  status: string;
  type: string;
  isFeatured: boolean;
  location: string | null;
  authorId: string;
  createdAt: string;
  author: { id: string; name: string };
  tags: Tag[];
  media: Media[];
  _count: { media: number };
}

interface Media {
  id: string;
  url: string;
  type: string;
  filename: string | null;
  size: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  PUBLISHED: "Опубликовано",
  ARCHIVED: "В архиве",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-700 text-slate-200",
  PENDING: "bg-yellow-900/50 text-yellow-300",
  PUBLISHED: "bg-green-900/50 text-green-300",
  ARCHIVED: "bg-slate-800 text-slate-400",
};

const TYPE_LABELS: Record<string, string> = {
  NEWS: "Новость",
  WORK: "Работа",
  UPDATE: "Обновление",
  EVENT: "Событие",
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Post | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchPosts = useCallback(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (search) params.set("search", search);
    fetch(`/api/admin/posts?${params}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then(setPosts)
      .catch(() => setPosts([]));
  }, [filter, search]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить публикацию?")) return;
    try {
      const res = await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((p) => p.filter((post) => post.id !== id));
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Ошибка удаления");
      }
    } catch {
      alert("Ошибка соединения с сервером");
    }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchPosts();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Ошибка обновления статуса");
      }
    } catch {
      alert("Ошибка соединения с сервером");
    }
  };

  if (creating || editing) {
    return (
      <PostForm
        post={editing}
        onDone={() => {
          setCreating(false);
          setEditing(null);
          fetchPosts();
        }}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Публикации</h1>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <Plus className="h-4 w-4" />
          Новая публикация
        </button>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/50 py-2 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-600 focus:outline-none"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
        >
          <option value="all">Все статусы</option>
          <option value="DRAFT">Черновик</option>
          <option value="PENDING">На модерации</option>
          <option value="PUBLISHED">Опубликовано</option>
          <option value="ARCHIVED">В архиве</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-400">
              <th className="p-4">Название</th>
              <th className="p-4">Тип</th>
              <th className="p-4">Автор</th>
              <th className="p-4">Статус</th>
              <th className="p-4">Дата</th>
              <th className="p-4">Действия</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  Нет публикаций
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {post.isFeatured && (
                        <Star className="h-4 w-4 text-amber-400" />
                      )}
                      <span className="font-medium text-slate-100">
                        {post.title}
                      </span>
                    </div>
                    {post.tags.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {post.tags.map((t) => (
                          <span
                            key={t.id}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400"
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-sm text-slate-400">
                    {TYPE_LABELS[post.type] || post.type}
                  </td>
                  <td className="p-4 text-sm text-slate-400">
                    {post.author.name}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[post.status]}`}
                    >
                      {STATUS_LABELS[post.status] || post.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-slate-400">
                    {new Date(post.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      {post.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => handleStatus(post.id, "PUBLISHED")}
                            title="Одобрить"
                            className="rounded-lg p-1.5 text-green-400 hover:bg-green-900/30"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleStatus(post.id, "DRAFT")}
                            title="Отклонить"
                            className="rounded-lg p-1.5 text-red-400 hover:bg-red-900/30"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setEditing(post)}
                        title="Редактировать"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        title="Удалить"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {post.status === "PUBLISHED" && (
                        <SocialPostButton
                          postId={post.id}
                          postTitle={post.title}
                          postUrl={`${window.location.origin}/posts/${post.slug}`}
                          postExcerpt={post.excerpt || post.content?.slice(0, 200)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PostForm({
  post,
  onDone,
  onCancel,
}: {
  post: Post | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(post?.title || "");
  const [content, setContent] = useState(post?.content || "");
  const [excerpt, setExcerpt] = useState(post?.excerpt || "");
  const [type, setType] = useState(post?.type || "NEWS");
  const [status, setStatus] = useState(post?.status || "DRAFT");
  const [isFeatured, setIsFeatured] = useState(post?.isFeatured || false);
  const [tags, setTags] = useState(
    post?.tags.map((t) => t.name).join(", ") || ""
  );
  const [coverImage, setCoverImage] = useState(post?.coverImage || "");
  const [location, setLocation] = useState(post?.location || "");
  const [media, setMedia] = useState<Media[]>(post?.media || []);
  const [metaTitle, setMetaTitle] = useState(post?.metaTitle || "");
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription || "");
  const [ogImage, setOgImage] = useState(post?.ogImage || "");
  const [saving, setSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [authorId, setAuthorId] = useState(post?.authorId || "");
  const [specialists, setSpecialists] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/admin/specialists", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setSpecialists(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const body: any = {
      title,
      content,
      excerpt,
      type,
      status,
      isFeatured,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      coverImage,
      location,
      metaTitle,
      metaDescription,
      ogImage,
      authorId: authorId || undefined,
    };

    try {
      const url = post ? `/api/admin/posts/${post.id}` : "/api/admin/posts";
      const method = post ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

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

  const inputClass =
    "w-full rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-600 focus:outline-none";
  const labelClass = "block mb-1 text-sm text-slate-400";

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-slate-100">
          {post ? "Редактирование" : "Новая публикация"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div>
          <label className={labelClass}>Название *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={inputClass}
            placeholder="Заголовок публикации"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Тип</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
            >
              <option value="NEWS">Новость</option>
              <option value="WORK">Работа</option>
              <option value="UPDATE">Обновление</option>
              <option value="EVENT">Событие</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              <option value="DRAFT">Черновик</option>
              <option value="PENDING">На модерации</option>
              <option value="PUBLISHED">Опубликовано</option>
              <option value="ARCHIVED">В архиве</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Автор</label>
            <select
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              className={inputClass}
            >
              <option value="">По умолчанию (я)</option>
              {specialists.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}{s.specialization ? ` — ${s.specialization}` : ""}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Краткое описание</label>
          <input
            type="text"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            className={inputClass}
            placeholder="Краткое описание для превью"
          />
        </div>

        <div>
          <label className={labelClass}>Содержание</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className={inputClass}
            placeholder="Текст публикации"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Обложка</label>
            <FileUpload
              folder="covers"
              onUpload={(urls) => setCoverImage(urls[0] || "")}
            />
            {coverImage && (
              <div className="mt-2">
                <div className="relative group">
                  <div className="relative h-48 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                    <NextImage
                      src={coverImage}
                      alt="Обложка"
                      fill
                      className="object-cover cursor-pointer"
                      sizes="100vw"
                      onClick={() => setSelectedImage(coverImage)}
                    />
                  </div>
                </div>
                <div className="mt-2 flex gap-3">
                  <a
                    href={coverImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Открыть
                  </a>
                  <a
                    href={coverImage}
                    download
                    className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
                  >
                    <Download className="h-3 w-3" />
                    Скачать
                  </a>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>Теги (через запятую)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={inputClass}
              placeholder="ремонт, объект, процесс"
            />
          </div>
        </div>

        {post && (
          <div>
            <label className={labelClass}>Медиафайлы</label>
            <FileUpload
              folder={`posts/${post.id}`}
              onUpload={async (urls) => {
                // Save each uploaded file as Media record
                for (const url of urls) {
                  const res = await fetch(`/api/admin/posts/${post.id}/media`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url, type: "IMAGE" }),
                  });
                  if (res.ok) {
                    const m = await res.json();
                    setMedia((prev) => [...prev, m]);
                  }
                }
              }}
            />
            {media.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {media.map((m) => (
                  <div key={m.id} className="group relative">
                    <NextImage
                      src={m.url}
                      alt={m.filename || "Медиафайл"}
                      width={200}
                      height={80}
                      className="h-20 w-full rounded-lg object-cover cursor-pointer hover:opacity-80"
                      onClick={() => setSelectedImage(m.url)}
                    />
                    <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100">
                      <a
                        href={m.url}
                        download
                        className="rounded bg-green-600/80 p-0.5 text-white"
                        title="Скачать"
                      >
                        <Download className="h-3 w-3" />
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/admin/posts/${post.id}/media/${m.id}`, {
                            method: "DELETE",
                          });
                          setMedia((prev) => prev.filter((x) => x.id !== m.id));
                        }}
                        className="rounded bg-red-600/80 p-0.5 text-white"
                        title="Удалить"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Move to gallery button */}
            {coverImage && (
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch("/api/admin/site-images", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      key: `gallery_${Date.now()}`,
                      url: coverImage,
                      title: title || "Фото из поста",
                      desc: excerpt || "",
                      sort: 999,
                    }),
                  });
                  if (res.ok) {
                    alert("Фото добавлено в галерею!");
                  }
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <ImageIcon className="h-4 w-4" />
                В галерею
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Место</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClass}
              placeholder="Москва, ул. Пример"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900"
              />
              В портфолио
            </label>
          </div>
        </div>

        <SeoPanel
          metaTitle={metaTitle}
          metaDescription={metaDescription}
          ogImage={ogImage}
          pageUrl={post ? `/posts/${post.slug}` : "/posts/new"}
          onChange={(field, value) => {
            if (field === "metaTitle") setMetaTitle(value);
            if (field === "metaDescription") setMetaDescription(value);
            if (field === "ogImage") setOgImage(value);
          }}
        />

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-800 px-6 py-2.5 text-sm text-slate-400 hover:text-slate-100"
          >
            Отмена
          </button>
        </div>
      </form>

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white z-10"
          >
            <X className="h-6 w-6" />
          </button>

          <div
            className="max-w-5xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video rounded-lg overflow-hidden">
              <NextImage
                src={selectedImage}
                alt="Просмотр изображения"
                fill
                className="object-contain"
                sizes="100vw"
              />
            </div>

            <div className="mt-4 flex justify-center gap-4">
              <a
                href={selectedImage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <ExternalLink className="h-4 w-4" />
                Открыть в полном размере
              </a>
              <a
                href={selectedImage}
                download
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
              >
                <Download className="h-4 w-4" />
                Скачать
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
