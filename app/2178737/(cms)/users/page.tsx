"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Plus, Trash2, Shield, User, Key, X } from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  telegramId: string | null;
  telegramName: string | null;
  role: string;
  hasPassword: boolean;
  createdAt: string;
  _count: { posts: number };
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Администратор",
  EDITOR: "Редактор",
  SPECIALIST: "Специалист",
  CLIENT: "Клиент",
  BROKER: "Брокер",
  USER: "Пользователь",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-900/50 text-purple-300",
  EDITOR: "bg-blue-900/50 text-blue-300",
  SPECIALIST: "bg-cyan-900/50 text-cyan-300",
  CLIENT: "bg-emerald-900/50 text-emerald-300",
  BROKER: "bg-indigo-900/50 text-indigo-300",
  USER: "bg-slate-700 text-slate-200",
};

export default function UsersPage() {
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as any)?.role === "SUPER_ADMIN";
  const currentUserId = (session?.user as any)?.id;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("EDITOR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Password change modal
  const [passwordModal, setPasswordModal] = useState<{ userId: string; userName: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Password reset
  const [resetModal, setResetModal] = useState<{ userId: string; userName: string } | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(() => {
    fetch("/api/admin/users", { credentials: "include" })
      .then((r) => r.json())
      .then((list: AdminUser[]) =>
        setUsers(Array.isArray(list) ? list.filter((u) => u.role !== "SUPER_ADMIN") : [])
      )
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (id: string, userName: string) => {
    if (!confirm(`Удалить пользователя "${userName}"? Это действие необратимо.`)) return;

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } else {
      const data = await res.json();
      alert(data.error || "Ошибка удаления");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, role, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ошибка");
      setSaving(false);
      return;
    }

    setCreating(false);
    setName("");
    setEmail("");
    setPassword("");
    setRole("EDITOR");
    setSaving(false);
    fetchUsers();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModal) return;

    setPasswordSaving(true);
    setPasswordError("");

    const res = await fetch(`/api/admin/users/${passwordModal.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password: newPassword }),
    });

    if (!res.ok) {
      const data = await res.json();
      setPasswordError(data.error || "Ошибка");
      setPasswordSaving(false);
      return;
    }

    setPasswordModal(null);
    setNewPassword("");
    setPasswordSaving(false);
    fetchUsers();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModal) return;

    setResetting(true);
    setResetResult(null);

    const res = await fetch(`/api/admin/users/${resetModal.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ resetPassword: true }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Ошибка");
      setResetting(false);
      return;
    }

    const data = await res.json();
    setResetResult(data.newPassword);
    setResetting(false);
    fetchUsers();
  };

  const inputClass =
    "w-full rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-600 focus:outline-none";
  const labelClass = "block mb-1 text-sm text-slate-400";

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Пользователи</h1>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <Plus className="h-4 w-4" />
          Добавить пользователя
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form
          onSubmit={handleCreate}
          className="mb-8 max-w-lg space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
        >
          <h2 className="text-lg font-semibold text-slate-100">Новый пользователь</h2>

          {error && (
            <div className="rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Имя *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
              placeholder="Иван Иванов"
            />
          </div>

          <div>
            <label className={labelClass}>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
              placeholder="ivan@example.com"
            />
          </div>

          <div>
            <label className={labelClass}>Пароль * (минимум 6 символов)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={inputClass}
              placeholder="Минимум 6 символов"
            />
          </div>

          {isSuperAdmin && (
            <div>
              <label className={labelClass}>Роль</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={inputClass}
              >
                <option value="EDITOR">Редактор</option>
                <option value="ADMIN">Администратор</option>
                <option value="SPECIALIST">Специалист</option>
                <option value="CLIENT">Клиент</option>
                <option value="BROKER">Брокер</option>
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? "Создание..." : "Создать"}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setError(""); }}
              className="rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-400 hover:text-slate-100"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Password change modal */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <form
            onSubmit={handleChangePassword}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                Сменить пароль — {passwordModal.userName}
              </h2>
              <button
                type="button"
                onClick={() => { setPasswordModal(null); setNewPassword(""); setPasswordError(""); }}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {passwordError && (
              <div className="rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">
                {passwordError}
              </div>
            )}

            <div>
              <label className={labelClass}>Новый пароль (минимум 6 символов)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
                placeholder="Новый пароль"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                <Key className="h-4 w-4" />
                {passwordSaving ? "Сохранение..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => { setPasswordModal(null); setNewPassword(""); setPasswordError(""); }}
                className="rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-400 hover:text-slate-100"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password reset modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                Сброс пароля — {resetModal.userName}
              </h2>
              <button
                onClick={() => { setResetModal(null); setResetResult(null); }}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {resetResult ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-green-900/30 px-4 py-3 text-sm text-green-300">
                  Новый пароль сгенерирован!
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="mb-1 text-xs text-slate-400">Новый пароль:</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-lg font-mono font-bold text-amber-300 select-all">
                      {resetResult}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(resetResult)}
                      className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600"
                    >
                      Копировать
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Передайте пароль пользователю. Он сможет войти в админку с этим паролем.
                </p>
                <button
                  onClick={() => { setResetModal(null); setResetResult(null); }}
                  className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Готово
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-sm text-slate-400">
                  Будет сгенерирован новый случайный пароль. Старый пароль перестанет работать.
                </p>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={resetting}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-900/50 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-900/70 disabled:opacity-50"
                  >
                    <Key className="h-4 w-4" />
                    {resetting ? "Генерация..." : "Сгенерировать пароль"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setResetModal(null); setResetResult(null); }}
                    className="rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-400 hover:text-slate-100"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-400">
              <th className="p-4">Пользователь</th>
              <th className="p-4">Роль</th>
              <th className="p-4">Пароль</th>
              <th className="p-4">Telegram</th>
              <th className="p-4">Постов</th>
              {isSuperAdmin && <th className="p-4">Действия</th>}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={isSuperAdmin ? 6 : 5} className="p-8 text-center text-slate-400">
                  Нет пользователей
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800">
                        {user.role === "ADMIN" ? (
                          <Shield className="h-4 w-4 text-purple-400" />
                        ) : (
                          <User className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-slate-100">{user.name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${ROLE_COLORS[user.role]}`}
                    >
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-slate-400">
                    {user.hasPassword ? "✅ Задан" : "❌ Не задан"}
                  </td>
                  <td className="p-4 text-sm text-slate-400">
                    {user.telegramName || "—"}
                  </td>
                  <td className="p-4 text-sm text-slate-400">{user._count.posts}</td>
                  {isSuperAdmin && (
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setPasswordModal({ userId: user.id, userName: user.name || user.email || "" });
                            setNewPassword("");
                            setPasswordError("");
                          }}
                          title="Сменить пароль"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-amber-400"
                        >
                          <Key className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setResetModal({ userId: user.id, userName: user.name || user.email || "" });
                            setResetResult(null);
                          }}
                          title="Сбросить пароль"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        {user.role !== "SUPER_ADMIN" && (
                          <button
                            onClick={() => handleDelete(user.id, user.name || user.email || "")}
                            title="Удалить"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
