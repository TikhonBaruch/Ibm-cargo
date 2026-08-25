"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "@/lbm-bro/components/icon";
import { AvatarImg } from "@/lbm-bro/components/avatar-img";
import { fmt } from "@/lbm-bro/lib/format";
import { useDemo } from "@/lbm-bro/lib/store";

const TITLES: Record<string, [string, string]> = {
  "/client": ["Главная", "Импорт под контролем · AI + брокер"],
  "/client/orders": ["Заявки", "Просчёты, статусы и действия по карточкам"],
  "/client/new": ["Новый просчёт", "Старт · Стандарт · Профи — сначала код ТН ВЭД"],
  "/client/chat": ["Чаты", "Поддержка отдельно, брокер — по каждой заявке"],
  "/client/company": ["Компания", "Профиль и уведомления"],
  "/client/faq": ["FAQ", "Частые вопросы по просчёту и брокеру"],
  "/client/guide": ["Как пользоваться", "Четыре шага до PDF"],
  "/client/tnved": ["Справочник ТН ВЭД", "Первый код бесплатно · дальше по тарифу"],
  "/client/brokers": ["Брокеры", "Назначьте эксперта или напишите в чат"],
  "/client/ship": ["Перевозка", "Маршрут, способ и ориентир по цене"],
  "/client/clearance": ["Таможенное оформление", "Декларация, платежи и выпуск груза"],
  "/client/balance": ["Баланс", "Пополнение и история списаний"],
};

const NAV = [
  { href: "/client", icon: "home" as const, label: "Главная", hint: "Кабинет", tone: "nav-home" },
  { href: "/client/orders", icon: "list" as const, label: "Заявки", hint: "Просчёты", tone: "orders" },
  { href: "/client/tnved", icon: "search" as const, label: "Справочник ТН ВЭД", hint: "Коды ЕАЭС", tone: "tnved" },
  { href: "/client/chat", icon: "message" as const, label: "Чат", hint: "Брокер", tone: "chats" },
  { href: "/client/company", icon: "user" as const, label: "Компания", hint: "Профиль", tone: "company" },
];

export function ClientShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { balance, chatBadge, notes, showToast, orders, beginNewCalculation } = useDemo();
  const [notesOpen, setNotesOpen] = useState(false);
  const [q, setQ] = useState("");
  const isHome = path === "/client";
  const isOrder = path.startsWith("/client/orders/");
  const isWiz = path === "/client/new";
  const title = isOrder
    ? ["Заявка", "Статусы, документы и следующий шаг"] as const
    : TITLES[path] ?? ["Кабинет", ""];
  const navHighlight = path.startsWith("/client/orders") || path === "/client/new" || path === "/client/ship" || path === "/client/brokers" || path === "/client/clearance"
    ? "/client/orders"
    : path === "/client/balance"
      ? "/client/company"
      : path === "/client/faq" || path === "/client/guide"
        ? "/client"
        : path;

  function search() {
    const query = q.toLowerCase();
    if (!query) return;
    const hit = orders.find((o) => o.id.includes(query.replace("#", "")) || o.title.toLowerCase().includes(query) || o.broker.toLowerCase().includes(query));
    if (hit) router.push(`/client/orders/${hit.id}`);
    else if (query.includes("брок")) router.push("/client/brokers");
    else showToast("Ничего не найдено");
  }

  return (
    <section className="view view-client">
      <div className="cl-app">
        <aside className="cl-side">
          <div className="cl-user">
            <div className="avatar"><AvatarImg src="/lbm-bro/assets/avatar-user.svg" alt="Иван Михайлов" /></div>
            <div>
              <strong>Иван Михайлов</strong>
              <span>ООО «Импортёр»</span>
            </div>
          </div>
          <nav className="cl-side-nav">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`cl-nav-tile ${n.tone}${navHighlight === n.href ? " active" : ""}`}
              >
                <span className="cl-nav-ico"><Icon name={n.icon} /></span>
                {n.href === "/client/chat" && chatBadge > 0 ? <span className="badge-n">{chatBadge}</span> : null}
                <span className="cl-nav-copy">
                  <strong>{n.label}</strong>
                  <span className="cl-nav-hint">{n.hint}</span>
                </span>
              </Link>
            ))}
          </nav>
          <div className="cl-side-foot">
            <div className="k">Доступно к списанию</div>
            <div className="v">{fmt(balance)} ₽</div>
            <Link href="/client/balance" className="btn btn-sm" style={{ marginTop: 10, background: "rgba(255,255,255,.16)", color: "#fff", width: "100%" }}>Пополнить</Link>
          </div>
        </aside>
        <div className="cl-main">
          <div className="cl-top">
            {!isOrder && !isHome && !isWiz && (
              <div className="cl-title">
                <h1 style={{ fontFamily: "var(--display)", fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.15 }}>{title[0]}</h1>
                <div className="sub">{title[1]}</div>
              </div>
            )}
            {!isOrder && (
              <label className="cl-search">
                <Icon name="search" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Найти заявку, товар или брокера…"
                  onKeyDown={(e) => { if (e.key === "Enter") search(); }}
                />
              </label>
            )}
            <div className="cl-top-actions" style={{ position: "relative" }}>
              <button type="button" className="cl-bell" aria-label="Уведомления" onClick={() => setNotesOpen((v) => !v)}>
                <Icon name="alert" /><i />
              </button>
              {notesOpen ? (
                <div className="card" style={{ position: "absolute", right: 0, top: 52, width: 320, zIndex: 60, margin: 0 }}>
                  <h3>Уведомления</h3>
                  <div className="activity-list">
                    {notes.map((n) => (
                      <Link key={n.id} href={`/client/orders/${n.orderId}`} className="activity-item" style={{ width: "100%", textAlign: "left" }} onClick={() => setNotesOpen(false)}>
                        <div className={`dot ${n.tone}`} />
                        <div><strong>{n.title}</strong><span>{n.text}</span></div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              <Link href="/client/new" className="btn btn-primary btn-sm" onClick={() => beginNewCalculation()}><Icon name="plus" /> Новый просчёт</Link>
            </div>
          </div>
          <div className="cl-content">{children}</div>
        </div>
      </div>
    </section>
  );
}
