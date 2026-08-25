"use client";

/**
 * Live cabinet chrome in the lbm-bro visual language (D33 plan-lbm-bro-visual).
 * Client = light product shell. Broker/admin = dark ops shell.
 * Panes and /api/v1 stay in ved/* — this file is layout only. No proto-bar, no demo-store.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import {
  Box,
  Briefcase,
  ClipboardList,
  Home,
  List,
  LogOut,
  MessageSquare,
  Settings,
  Shield,
  Sparkles,
  Tag,
  Truck,
  User,
  Users,
  Wallet,
  BarChart3,
  LayoutDashboard,
  Calendar,
} from "lucide-react";
import type { VedIconName, VedNavItem } from "./VedShell";
import "@/lbm-bro/globals.css";
import "./lbm-cabinets-live.css";

const ICONS: Record<VedIconName, typeof Home> = {
  home: Home,
  list: List,
  users: Users,
  truck: Truck,
  wallet: Wallet,
  message: MessageSquare,
  settings: Settings,
  user: User,
  dash: LayoutDashboard,
  calendar: Calendar,
  briefcase: Briefcase,
  tag: Tag,
  shield: Shield,
  sparkles: Sparkles,
  clipboard: ClipboardList,
  chart: BarChart3,
  box: Box,
};

function NavGlyph({ name }: { name?: VedIconName }) {
  const Icon = ICONS[name || "list"] || List;
  return <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />;
}

export function clientNavTone(label: string): string {
  if (label === "Дашборд") return "nav-home";
  if (label.startsWith("Заявки")) return "orders";
  if (label === "Производитель") return "tnved";
  if (label === "Брокеры") return "chats";
  if (label === "Перевозка") return "orders";
  if (label === "Баланс") return "company";
  if (label === "Поддержка") return "chats";
  return "company";
}

export function clientNavHint(label: string): string {
  if (label === "Дашборд") return "Кабинет";
  if (label.startsWith("Заявки")) return "Просчёты";
  if (label === "Производитель") return "Сборный заказ";
  if (label === "Брокеры") return "Эксперты";
  if (label === "Перевозка") return "После DONE";
  if (label === "Баланс") return "Списание";
  if (label === "Поддержка") return "Тикеты";
  if (label === "Профиль") return "Компания";
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
  balanceRub?: number;
  balanceHref?: string;
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
  balanceRub,
  balanceHref,
  children,
}: LbmCabinetsShellProps) {
  const pathname = usePathname() || "";
  const isClient = variant === "client";
  const isAdmin = variant === "admin";

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
                  const active = pathname === n.href;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`cl-nav-tile ${clientNavTone(n.label)}${active ? " active" : ""}`}
                    >
                      <span className="cl-nav-ico">
                        <NavGlyph name={n.icon} />
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
                      <Link href={balanceHref} className="btn btn-sm" style={{ marginTop: 10, background: "rgba(255,255,255,.16)", color: "#fff", width: "100%" }}>
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
                <div className="cl-top-actions" style={{ marginLeft: "auto" }}>
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
                  <NavGlyph name={isAdmin ? "sparkles" : "shield"} />
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
                        <NavGlyph name={n.icon} /> {n.label}
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
                <LogOut className="h-4 w-4" strokeWidth={1.8} /> Выйти
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
