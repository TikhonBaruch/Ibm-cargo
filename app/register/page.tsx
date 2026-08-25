"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { LandingAuthShell } from "@/components/landing/LandingAuthShell";

export default function RegisterPage() {
  const [companyName, setCompanyName] = useState("");
  const [inn, setInn] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, inn: inn || undefined, name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка регистрации");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        window.location.href = "/login";
        return;
      }
      window.location.href = "/cabinet";
    } catch {
      setError("Ошибка соединения");
      setLoading(false);
    }
  };

  return (
    <LandingAuthShell
      title="Регистрация импортёра"
      subtitle="Откроем кабинет компании — дальше можно создать первый просчёт."
      active="register"
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="pill warn" style={{ marginBottom: 14, display: "block", padding: "10px 14px" }}>
            {error}
          </div>
        )}
        <div className="field">
          <label>Компания</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            placeholder="ООО Импорт"
            autoComplete="organization"
          />
        </div>
        <div className="field">
          <label>ИНН (необязательно)</label>
          <input type="text" value={inn} onChange={(e) => setInn(e.target.value)} />
        </div>
        <div className="field">
          <label>Контактное лицо</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label>Пароль (мин. 6 символов)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="modal-actions" style={{ justifyContent: "stretch", marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Регистрация…" : "Зарегистрироваться"}
          </button>
        </div>
        <p className="auth-hint">
          Уже есть аккаунт? <Link href="/login">Войти</Link>
        </p>
      </form>
    </LandingAuthShell>
  );
}
