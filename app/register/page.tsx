"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

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
    <div className="flex min-h-dvh items-center justify-center bg-[#f5f7fa] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-2xl font-bold text-[#0f172a]">
            LBM Брокер
          </Link>
          <p className="mt-1 text-sm text-[#7a7f89]">Регистрация импортёра</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        >
          {error && <div className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
          <div>
            <label className="mb-1 block text-sm text-[#7a7f89]">Компания</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2b72f4]"
              placeholder="ООО Импорт"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[#7a7f89]">ИНН (необязательно)</label>
            <input
              type="text"
              value={inn}
              onChange={(e) => setInn(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2b72f4]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[#7a7f89]">Контактное лицо</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2b72f4]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[#7a7f89]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2b72f4]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[#7a7f89]">Пароль (мин. 6 символов)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2b72f4]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#2b72f4] py-2.5 text-sm font-semibold text-white hover:bg-[#1a5fd4] disabled:opacity-60"
          >
            {loading ? "Регистрация…" : "Зарегистрироваться"}
          </button>
          <p className="text-center text-sm text-[#7a7f89]">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="font-semibold text-[#2b72f4]">
              Войти
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
