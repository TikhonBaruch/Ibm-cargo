"use client";

/**
 * Live cabinet chrome in the lbm-bro visual language (D33 plan-lbm-bro-visual).
 * Client = light product shell. Broker/admin = dark ops shell.
 * Panes and /api/v1 stay in ved/* — this file is layout only. No proto-bar, no demo-store.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { Icon } from "@/lbm-bro/components/icon";
import type { VedIconName, VedNavItem } from "./VedShell";
import { clientNavHighlight, type LiveBellNote } from "./lbm-pane-visual";
import "@/lbm-bro/globals.css";
import "./lbm-cabinets-live.css";

type BroIcon =
  | "box"
  | "home"
  | "list"
  | "users"
  | "user"
  | "truck"
  | "wallet"
  | "message"
  | "settings"
  | "chart"
  | "clock"
  | "send"
  | "plus"
  | "shield"
  | "cpu"
  | "file"
  | "check"
  | "alert"
  | "search"
  | "mic"
  | "play"
  | "pause";

const OPS_ICON: Record<VedIconName, BroIcon> = {
  home: "home",
  list: "list",
  users: "users",
  truck: "truck",
  wallet: "wallet",
  message: "message",
  settings: "settings",
  user: "user",
  dash: "chart",
  calendar: "clock",
  briefcase: "box",
  tag: "file",
  shield: "shield",
  sparkles: "cpu",
  clipboard: "list",
  chart: "chart",
  box: "box",
};

function opsIcon(name?: VedIconName): BroIcon {
  return OPS_ICON[name || "list"] || "list";
}

function clientTileIcon(label: string, name?: VedIconName): BroIcon {
  if (label.includes("ТН ВЭД") || label.includes("Справочник")) return "search";
  if (label === "Чат" || label === "Поддержка") return "message";
  return opsIcon(name);
}

export function clientNavTone(label: string): string {
  if (label === "Главная" || label === "Дашборд") return "nav-home";
  if (label.startsWith("Заявки")) return "orders";
  if (label.includes("ТН ВЭД") || label.includes("Справочник")) return "tnved";
  if (label === "Чат" || label === "Поддержка" || label === "Брокеры") return "chats";
  if (label === "Производитель") return "tnved";
  if (label === "Перевозка") return "orders";
  if (label === "Баланс" || label === "Компания" || label === "Профиль") return "company";
  return "company";
}

export function clientNavHint(label: string): string {
  if (label === "Главная" || label === "Дашборд") return "Кабинет";
  if (label.startsWith("Заявки")) return "Просчёты";
  if (label.includes("ТН ВЭД") || label.includes("Справочник")) return "Коды ЕАЭС";
  if (label === "Чат") return "Брокер";
  if (label === "Поддержка") return "Тикеты";
  if (label === "Компания" || label === "Профиль") return "Профиль";
  if (label === "Производитель") return "Сборный заказ";
  if (label === "Брокеры") return "Эксперты";
  if (label === "Перевозка") return "После DONE";
  if (label === "Баланс") return "Списание";
  return "";
}

export type LbmCabinetsShellProps = {
  variant: "client" | "broker" | "admin";
  brand?: string;
  subtitle?: string;
  nav: VedNavItem[];
  footer?: ReactNode;
  title?: string;
  lead?: string;
  actions?: ReactNode;
  avatarUrl?: string;
  userLabel?: string;
  userMeta?: string;
  hideHeaderTitle?: boolean;
  hideSearch?: boolean;
  balanceRub?: number;
  balanceHref?: string;
  newCalcHref?: string;
  notes?: LiveBellNote[];
  bellUnread?: boolean;
  onSearch?: (q: string) => string | null;
  children: ReactNode;
};

export function LbmCabinetsShell({
  variant,
  brand = "Кабинет",
  subtitle,
  nav,
  footer,
  title,
  lead,
  actions,
  avatarUrl = "/cabinets/assets/avatar-user.jpg",
  userLabel,
  userMeta,
  hideHeaderTitle = false,
  hideSearch = false,
  balanceRub,
  balanceHref,
  newCalcHref,
  notes = [],
  bellUnread = false,
  onSearch,
  children,
}: LbmCabinetsShellProps) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const isClient = variant === "client";
  const isAdmin = variant === "admin";
  const [q, setQ] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const highlightHref = isClient ? clientNavHighlight(pathname, nav) : "";

  function runSearch() {
    if (!onSearch) return;
    const href = onSearch(q);
    if (href) router.push(href);
  }

  return (
    <div className={`lbm-bro-root${isClient ? " lbm-live-client" : " lbm-live-ops"}`}>
      <section className={isClient ? "view view-client" : "view"}>
        {isClient ? (
          <div className="cl-app">
            <aside className="cl-side">
              <div className="cl-user">
                <div className="avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarUrl} alt="" />
                </div>
                <div>
                  <strong>{userLabel || brand}</strong>
                  <span>{userMeta || subtitle || "Клиент"}</span>
                </div>
              </div>
              <nav className="cl-side-nav">
                {nav.map((n) => {
                  const active = n.href === highlightHref || pathname === n.href;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`cl-nav-tile ${clientNavTone(n.label)}${active ? " active" : ""}`}
                    >
                      <span className="cl-nav-ico">
                        <Icon name={clientTileIcon(n.label, n.icon)} />
                      </span>
                      {n.badge != null && n.badge !== "" && Number(n.badge) !== 0 ? (
                        <span className="badge-n">{n.badge}</span>
                      ) : null}
                      <span className="cl-nav-copy">
                        <strong>{n.label}</strong>
                        <span className="cl-nav-hint">{clientNavHint(n.label)}</span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
              <div className="cl-side-foot">
                {typeof balanceRub === "number" ? (
                  <>
                    <div className="k">Доступно к списанию</div>
                    <div className="v">{Math.round(balanceRub).toLocaleString("ru-RU")} ₽</div>
                    {balanceHref ? (
                      <Link
                        href={balanceHref}
                        className="btn btn-sm"
                        style={{ marginTop: 10, background: "rgba(255,255,255,.16)", color: "#fff", width: "100%" }}
                      >
                        Пополнить
                      </Link>
                    ) : null}
                  </>
                ) : (
                  footer
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ marginTop: 8, background: "transparent", color: "rgba(255,255,255,.85)", width: "100%" }}
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  Выйти
                </button>
              </div>
            </aside>
            <div className="cl-main">
              <div className="cl-top">
                {!hideHeaderTitle && title ? (
                  <div className="cl-title">
                    <h1
                      style={{
                        fontFamily: "var(--display)",
                        fontSize: "1.35rem",
                        fontWeight: 800,
                        letterSpacing: "-.03em",
                        lineHeight: 1.15,
                      }}
                    >
                      {title}
                    </h1>
                    {lead ? <div className="sub">{lead}</div> : null}
                  </div>
                ) : null}
                {!hideSearch ? (
                  <label className="cl-search">
                    <Icon name="search" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Найти заявку, товар или брокера…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") runSearch();
                      }}
                    />
                  </label>
                ) : null}
                <div className="cl-top-actions" style={{ position: "relative", marginLeft: "auto" }}>
                  <button
                    type="button"
                    className="cl-bell"
                    aria-label="Уведомления"
                    onClick={() => setNotesOpen((v) => !v)}
                  >
                    <Icon name="alert" />
                    {bellUnread ? <i /> : null}
                  </button>
                  {notesOpen ? (
                    <div className="card" style={{ position: "absolute", right: 0, top: 52, width: 320, zIndex: 60, margin: 0 }}>
                      <h3>Уведомления</h3>
                      <div className="activity-list">
                        {notes.length ? (
                          notes.map((n) => (
                            <Link
                              key={n.id}
                              href={n.href}
                              className="activity-item"
                              style={{ width: "100%", textAlign: "left" }}
                              onClick={() => setNotesOpen(false)}
                            >
                              <div className={`dot ${n.tone}`} />
                              <div>
                                <strong>{n.title}</strong>
                                <span>{n.text}</span>
                              </div>
                            </Link>
                          ))
                        ) : (
                          <p className="meta" style={{ padding: "8px 0" }}>
                            Пока нет событий по заявкам
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {newCalcHref ? (
                    <Link href={newCalcHref} className="btn btn-primary btn-sm" aria-label="Новый просчёт">
                      <Icon name="plus" /> <span className="cl-new-label">Новый просчёт</span>
                    </Link>
                  ) : null}
                  {actions}
                  <div className="avatar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarUrl} alt="" />
                  </div>
                </div>
              </div>
              <div className="cl-content">{children}</div>
            </div>
          </div>
        ) : (
          <div className="app">
            <aside className={isAdmin ? "side admin" : "side"}>
              <div className="side-brand">
                <div className="brand-mark">
                  <Icon name={isAdmin ? "cpu" : "shield"} lg />
                </div>
                <div>
                  {brand}
                  <small>{subtitle}</small>
                </div>
              </div>
              <nav className="side-nav">
                {nav.map((n, i) => {
                  const prev = nav[i - 1];
                  const showGroup = Boolean(n.group && n.group !== prev?.group);
                  const active = pathname === n.href;
                  return (
                    <div key={n.href} className="lbm-nav-item">
                      {showGroup ? <div className="side-nav-group">{n.group}</div> : null}
                      <Link href={n.href} className={active ? "active" : ""}>
                        <Icon name={opsIcon(n.icon)} /> {n.label}
                        {n.badge != null && n.badge !== "" && Number(n.badge) !== 0 ? (
                          <span className="badge-n">{n.badge}</span>
                        ) : null}
                      </Link>
                    </div>
                  );
                })}
              </nav>
              {footer ? <div className="side-foot">{footer}</div> : null}
              <button
                type="button"
                className="btn btn-outline-light btn-sm back-link"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Выйти
              </button>
            </aside>
            <div className="main">
              <div className="topbar">
                <div>
                  {title ? <h1>{title}</h1> : null}
                  {lead ? <div className="sub">{lead}</div> : null}
                </div>
                <div className="topbar-actions">
                  {actions}
                  <div className="avatar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarUrl} alt="" />
                  </div>
                </div>
              </div>
              <div className="content">{children}</div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
