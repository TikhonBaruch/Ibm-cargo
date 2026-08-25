"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/lbm-bro/components/icon";
import { AvatarImg } from "@/lbm-bro/components/avatar-img";
import { useDemo } from "@/lbm-bro/lib/store";

const NAV = [
  { href: "/broker", icon: "home" as const, label: "Дашборд" },
  { href: "/broker/queue", icon: "list" as const, label: "Очередь" },
  { href: "/broker/work", icon: "clock" as const, label: "В работе" },
  { href: "/broker/chat", icon: "message" as const, label: "Чат" },
  { href: "/broker/sla", icon: "chart" as const, label: "SLA / статистика" },
  { href: "/broker/pay", icon: "wallet" as const, label: "Выплаты" },
  { href: "/broker/profile", icon: "user" as const, label: "Профиль" },
];

const TITLES: Record<string, string> = {
  "/broker": "Дашборд брокера",
  "/broker/queue": "Очередь заявок",
  "/broker/work": "Мои в работе",
  "/broker/chat": "Чат с клиентами",
  "/broker/sla": "Статистика / SLA",
  "/broker/pay": "Выплаты",
  "/broker/profile": "Профиль",
};

export function BrokerShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { queueCount } = useDemo();
  return (
    <section className="view">
      <div className="app">
        <aside className="side">
          <div className="side-brand">
            <div className="brand-mark"><Icon name="shield" lg /></div>
            <div>Кабинет<small>Брокер · А. Иванов</small></div>
          </div>
          <nav className="side-nav">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={path === n.href ? "active" : ""}>
                <Icon name={n.icon} /> {n.label}
                {n.href === "/broker/queue" ? <span className="badge-n">{queueCount}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="side-foot">
            SLA: <strong>≤ 4 ч</strong><br />
            Рейтинг ★ 4.9 · 28 закрыто / нед.
          </div>
          <Link href="/admin" className="btn btn-outline-light btn-sm back-link">→ Админ-панель</Link>
        </aside>
        <div className="main">
          <div className="topbar">
            <div>
              <h1>{TITLES[path] ?? "Кабинет"}</h1>
              <div className="sub">Очередь заявок, которые клиент сам отправил на проверку</div>
            </div>
            <div className="topbar-actions">
              <span className="pill ok">Онлайн</span>
              <Link href="/broker/queue" className="btn btn-primary btn-sm">Открыть очередь</Link>
              <div className="avatar"><AvatarImg src="/lbm-bro/assets/avatar-broker.svg" alt="Брокер" /></div>
            </div>
          </div>
          <div className="content">{children}</div>
        </div>
      </div>
    </section>
  );
}
