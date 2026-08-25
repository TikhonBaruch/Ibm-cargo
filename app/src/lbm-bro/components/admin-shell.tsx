"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/lbm-bro/components/icon";
import { AvatarImg } from "@/lbm-bro/components/avatar-img";
import { useDemo } from "@/lbm-bro/lib/store";

const NAV = [
  { href: "/admin", icon: "home" as const, label: "Дашборд" },
  { href: "/admin/orders", icon: "list" as const, label: "Заявки", badge: "48" },
  { href: "/admin/clients", icon: "users" as const, label: "Клиенты" },
  { href: "/admin/brokers", icon: "shield" as const, label: "Брокеры" },
  { href: "/admin/tariffs", icon: "wallet" as const, label: "Тарифы" },
  { href: "/admin/finance", icon: "chart" as const, label: "Финансы" },
  { href: "/admin/ai", icon: "cpu" as const, label: "AI-качество" },
  { href: "/admin/audit", icon: "file" as const, label: "Audit log" },
  { href: "/admin/settings", icon: "settings" as const, label: "Настройки" },
];

const TITLES: Record<string, [string, string]> = {
  "/admin": ["Дашборд платформы", "Операции, AI, брокеры и выручка — сводка за сегодня"],
  "/admin/orders": ["Заявки", "Все просчёты платформы · назначение и эскалация"],
  "/admin/clients": ["Клиенты", "Компании, балансы и активность"],
  "/admin/brokers": ["Брокеры", "Каталог, модерация и SLA"],
  "/admin/tariffs": ["Тарифы", "Код · Таможня · Под ключ"],
  "/admin/finance": ["Финансы", "GMV, комиссия и выплаты брокерам"],
  "/admin/ai": ["AI-качество", "Модули, точность и порог эскалации"],
  "/admin/audit": ["Audit log", "Журнал действий · 152-ФЗ"],
  "/admin/settings": ["Настройки", "Платформа и безопасность"],
};

export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { showToast } = useDemo();
  const title = TITLES[path] ?? ["Админ", ""];
  return (
    <section className="view">
      <div className="app">
        <aside className="side admin">
          <div className="side-brand">
            <div className="brand-mark"><Icon name="cpu" lg /></div>
            <div>LBM Брокер<small>Админ · платформа</small></div>
          </div>
          <nav className="side-nav">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={path === n.href ? "active" : ""}>
                <Icon name={n.icon} /> {n.label}
                {n.badge ? <span className="badge-n">{n.badge}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="side-foot">
            SLA платформы: <strong>≤ 4 ч</strong><br />
            Онлайн: <strong>18 брокеров</strong>
          </div>
          <Link href="/client" className="btn btn-outline-light btn-sm back-link">→ Кабинет клиента</Link>
        </aside>
        <div className="main">
          <div className="topbar">
            <div>
              <h1>{title[0]}</h1>
              <div className="sub">{title[1]}</div>
            </div>
            <div className="topbar-actions">
              <span className="pill blue">Прод · 152-ФЗ</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast("Отчёт экспортирован в CSV")}>Экспорт</button>
              <div className="avatar"><AvatarImg src="/lbm-bro/assets/avatar-user.svg" alt="Админ" /></div>
            </div>
          </div>
          <div className="content">{children}</div>
        </div>
      </div>
    </section>
  );
}
