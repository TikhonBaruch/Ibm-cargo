"use client";

import { VedEmptyState } from "../VedShell";
import type { AdminStaffUser } from "./types";

export function UsersPane({
  users,
  newUser,
  resetPasswordHint,
  busy,
  onNewUser,
  onCreate,
  onResetPassword,
}: {
  users: AdminStaffUser[];
  newUser: { name: string; email: string; role: string; password: string };
  resetPasswordHint: string;
  busy: boolean;
  onNewUser: (patch: Partial<{ name: string; email: string; role: string; password: string }>) => void;
  onCreate: () => void;
  onResetPassword: (userId: string) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">Создать пользователя</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Имя"
            value={newUser.name}
            onChange={(e) => onNewUser({ name: e.target.value })}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Email"
            value={newUser.email}
            onChange={(e) => onNewUser({ email: e.target.value })}
          />
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={newUser.role}
            onChange={(e) => onNewUser({ role: e.target.value })}
          >
            {["ADMIN", "EDITOR", "CLIENT", "BROKER", "MANUFACTURER"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            type="password"
            placeholder="Пароль (≥6)"
            value={newUser.password}
            onChange={(e) => onNewUser({ password: e.target.value })}
          />
          <button
            type="button"
            disabled={busy || !newUser.name || !newUser.email || newUser.password.length < 6}
            className="rounded-full bg-[#2b72f4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={onCreate}
          >
            Создать
          </button>
        </div>
        {resetPasswordHint && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Новый пароль (один раз): <strong>{resetPasswordHint}</strong>
          </p>
        )}
      </div>
      <ul className="space-y-2 text-sm">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/[0.04] bg-white px-4 py-3 shadow-sm"
          >
            <span>
              <span className="font-medium">{u.name || "—"}</span> · {u.email || "—"} ·{" "}
              <span className="text-[var(--kb-muted)]">{u.role}</span>
            </span>
            <button
              type="button"
              disabled={busy}
              className="text-[#2b72f4] disabled:opacity-50"
              onClick={() => onResetPassword(u.id)}
            >
              Сбросить пароль
            </button>
          </li>
        ))}
        {users.length === 0 && (
          <li>
            <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
              <VedEmptyState
                title="Пока нет пользователей"
                hint="Создайте staff или клиента формой выше — SUPER в списке не показывается."
              />
            </div>
          </li>
        )}
      </ul>
    </section>
  );
}
