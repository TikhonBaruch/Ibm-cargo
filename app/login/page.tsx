"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { LbmAuthShell } from "@/components/ved/LbmAuthShell";
import { messageForAuthError, normalizeLoginEmail } from "@/lib/auth-login";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code === "Configuration" || code === "Callback") {
      setError(messageForAuthError(code));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: normalizeLoginEmail(email),
        password,
        redirect: false,
      });
      if (result?.error) {
        setLoading(false);
        setError(messageForAuthError(result.error));
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const role = session?.user?.role as string | undefined;
      if (role === "CLIENT") window.location.href = "/cabinet";
      else if (role === "BROKER") window.location.href = "/broker";
      else if (role === "MANUFACTURER") window.location.href = "/manufacturer";
      else if (role === "SPECIALIST") window.location.href = "/admin/chat";
      else window.location.href = "/admin";
    } catch {
      setLoading(false);
      setError("Ошибка соединения");
    }
  };

  return (
    <LbmAuthShell title="Вход в кабинет" subtitle="Email и пароль учётки LBM Брокер." active="login">
      <form onSubmit={handleSubmit} noValidate>
        {error ? (
          <div className="pill warn" style={{ marginBottom: 14, display: "block", padding: "10px 14px" }}>
            {error}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="client@example.com"
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Пароль</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? "Вход…" : "Войти"}
        </button>
        <p className="auth-hint">
          Демо: client@example.com / broker@example.com / admin@example.com — пароль{" "}
          <code>demo1234</code>
        </p>
      </form>
    </LbmAuthShell>
  );
}
