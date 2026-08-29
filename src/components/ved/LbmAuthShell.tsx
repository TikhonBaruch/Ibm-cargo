"use client";

/**
 * Mobile-first auth chrome (M1) — lbm-bro tokens, brand-first, no landing nav clutter.
 * Plan: docs/knowledge/plan-mobile-client-lbm.md
 */
import Link from "next/link";
import type { ReactNode } from "react";
import "@/lbm-bro/globals.css";
import "./lbm-auth.css";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  active: "login" | "register";
};

const BOX_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

export function LbmAuthShell({ title, subtitle, children, active }: Props) {
  return (
    <div className="lbm-bro-root lbm-auth">
      <div className="lbm-auth-atmosphere" aria-hidden />
      <header className="lbm-auth-hero">
        <Link href="/" className="lbm-auth-brand">
          <span className="lbm-auth-mark">{BOX_ICON}</span>
          <span className="lbm-auth-name">
            LBM БРОКЕР
            <small>AI-платформа для импорта</small>
          </span>
        </Link>
      </header>
      <main className="lbm-auth-main">
        <div className="lbm-auth-card">
          <h1>{title}</h1>
          <p className="lbm-auth-lead">{subtitle}</p>
          {children}
        </div>
        <p className="lbm-auth-switch">
          {active === "login" ? (
            <>
              Нет аккаунта? <Link href="/register">Регистрация</Link>
            </>
          ) : (
            <>
              Уже есть аккаунт? <Link href="/login">Войти</Link>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
