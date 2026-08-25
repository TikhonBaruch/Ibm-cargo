"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

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
    <div className="flex min-h-dvh items-center justify-center bg-[#f5f7fa] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-2xl font-bold text-[#0f172a]">
            LBM Брокер
          </Link>
          <p className="mt-1 text-sm text-[#7a7f89]">Вход в кабинет</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        >
          {error && <div className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
          <div>
            <label className="mb-1 block text-sm text-[#7a7f89]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2b72f4]"
              placeholder="client@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[#7a7f89]">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2b72f4]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#2b72f4] py-2.5 text-sm font-semibold text-white hover:bg-[#1a5fd4] disabled:opacity-60"
          >
            {loading ? "Вход…" : "Войти"}
          </button>
          <p className="text-center text-xs text-[#7a7f89]">
            Демо: client@ / broker@ / manufacturer@ / operator@ / admin@ — пароль{" "}
            <code>demo1234</code>
          </p>
          <p className="text-center text-sm text-[#7a7f89]">
            Нет аккаунта?{" "}
            <Link href="/register" className="font-semibold text-[#2b72f4]">
              Регистрация
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
