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
    <section>
      <div className="card">
        <h3>Создать пользователя</h3>
        <div className="search-row">
          <input
            placeholder="Имя"
            value={newUser.name}
            onChange={(e) => onNewUser({ name: e.target.value })}
          />
          <input
            placeholder="Email"
            value={newUser.email}
            onChange={(e) => onNewUser({ email: e.target.value })}
          />
          <select value={newUser.role} onChange={(e) => onNewUser({ role: e.target.value })}>
            {["ADMIN", "EDITOR", "CLIENT", "BROKER", "MANUFACTURER"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            type="password"
            placeholder="Пароль (≥6)"
            value={newUser.password}
            onChange={(e) => onNewUser({ password: e.target.value })}
          />
          <button
            type="button"
            disabled={busy || !newUser.name || !newUser.email || newUser.password.length < 6}
            className="btn btn-primary btn-sm"
            onClick={onCreate}
          >
            Создать
          </button>
        </div>
        {resetPasswordHint && (
          <div className="alert-box warn-box" style={{ marginTop: 12 }}>
            <strong>Новый пароль (один раз)</strong>
            {resetPasswordHint}
          </div>
        )}
      </div>
      <div className="card">
        <h3>Пользователи</h3>
        {users.length === 0 ? (
          <VedEmptyState
            title="Пока нет пользователей"
            hint="Создайте staff или клиента формой выше — SUPER в списке не показывается."
          />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || "—"}</td>
                  <td>{u.email || "—"}</td>
                  <td>
                    <span className="pill muted">{u.role}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={busy}
                      className="btn btn-ghost btn-sm"
                      onClick={() => onResetPassword(u.id)}
                    >
                      Сбросить пароль
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
