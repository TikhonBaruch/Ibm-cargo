"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { LbmAuthShell } from "@/components/ved/LbmAuthShell";

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
    <LbmAuthShell
      title="Регистрация импортёра"
      subtitle="Откроем кабинет компании — дальше можно создать первый просчёт."
      active="register"
    >
      <form onSubmit={handleSubmit} noValidate>
        {error ? (
          <div className="pill warn" style={{ marginBottom: 14, display: "block", padding: "10px 14px" }}>
            {error}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="reg-company">Компания</label>
          <input
            id="reg-company"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            placeholder="ООО Импорт"
            autoComplete="organization"
          />
        </div>
        <div className="field">
          <label htmlFor="reg-inn">ИНН (необязательно)</label>
          <input id="reg-inn" type="text" value={inn} onChange={(e) => setInn(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="reg-name">Контактное лицо</label>
          <input
            id="reg-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="reg-password">Пароль (мин. 6 символов)</label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? "Регистрация…" : "Зарегистрироваться"}
        </button>
      </form>
    </LbmAuthShell>
  );
}
