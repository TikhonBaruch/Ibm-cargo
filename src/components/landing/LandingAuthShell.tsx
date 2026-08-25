"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import "./landing.css";

const BOX_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  active: "login" | "register";
};

/** Landing chrome (header + modal card) for /login and /register — same visual as taurus landing. */
export function LandingAuthShell({ title, subtitle, children, active }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="landing-root landing-auth">
      <header className="site-header" id="header">
        <div className="wrap hdr-inner">
          <Link href="/" className="brand">
            <div className="brand-mark">{BOX_ICON}</div>
            <div>
              LBM БРОКЕР
              <small>AI-платформа для импорта</small>
            </div>
          </Link>
          <nav className="nav">
            <Link href="/#how">Как работает</Link>
            <Link href="/#features">Возможности</Link>
            <Link href="/#cabinet">Кабинет</Link>
            <Link href="/#pricing">Тарифы</Link>
          </nav>
          <div className="hdr-actions">
            <Link href="/login" className={`btn btn-ghost btn-sm${active === "login" ? " is-active" : ""}`}>
              Войти
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              Начать бесплатно
            </Link>
            <button
              type="button"
              className="menu-btn"
              aria-label="Меню"
              onClick={() => setMobileOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="mobile-nav open" onClick={() => setMobileOpen(false)}>
          <div className="mobile-panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: "flex-end", marginBottom: 8 }}
              onClick={() => setMobileOpen(false)}
            >
              ✕
            </button>
            <Link href="/#how" onClick={() => setMobileOpen(false)}>
              Как работает
            </Link>
            <Link href="/#features" onClick={() => setMobileOpen(false)}>
              Возможности
            </Link>
            <Link href="/#cabinet" onClick={() => setMobileOpen(false)}>
              Кабинет
            </Link>
            <Link href="/#pricing" onClick={() => setMobileOpen(false)}>
              Тарифы
            </Link>
            <Link href="/login" className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setMobileOpen(false)}>
              Войти
            </Link>
            <Link href="/register" className="btn btn-primary" onClick={() => setMobileOpen(false)}>
              Начать бесплатно
            </Link>
          </div>
        </div>
      )}

      <main className="auth-main">
        <div className="modal auth-card">
          <h3>{title}</h3>
          <p>{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
