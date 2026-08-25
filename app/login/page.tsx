"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { LandingAuthShell } from "@/components/landing/LandingAuthShell";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setLoading(false);
        setError("Неверный email или пароль");
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
    <LandingAuthShell title="Вход в кабинет" subtitle="Email и пароль учётки LBM Брокер." active="login">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="pill warn" style={{ marginBottom: 14, display: "block", padding: "10px 14px" }}>
            {error}
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="client@example.com"
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="modal-actions" style={{ justifyContent: "stretch", marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Вход…" : "Войти"}
          </button>
        </div>
        <p className="auth-hint">
          Демо: client@ / broker@ / manufacturer@ / operator@ / admin@ — пароль <code>demo1234</code>
        </p>
        <p className="auth-hint">
          Нет аккаунта?{" "}
          <Link href="/register">Регистрация</Link>
        </p>
      </form>
    </LandingAuthShell>
  );
}
