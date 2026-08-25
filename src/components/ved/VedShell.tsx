"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import {
  Box,
  Home,
  List,
  Users,
  Truck,
  Wallet,
  MessageSquare,
  Settings,
  User,
  LayoutDashboard,
  Calendar,
  Briefcase,
  Tag,
  Shield,
  Sparkles,
  ClipboardList,
  BarChart3,
  LogOut,
} from "lucide-react";

export type VedNavItem = {
  href: string;
  label: string;
  icon?: VedIconName;
  badge?: number | string | null;
  /** Sidebar section label (admin groups). Ignored when unset. */
  group?: string;
};

export type VedIconName =
  | "home"
  | "list"
  | "users"
  | "truck"
  | "wallet"
  | "message"
  | "settings"
  | "user"
  | "dash"
  | "calendar"
  | "briefcase"
  | "tag"
  | "shield"
  | "sparkles"
  | "clipboard"
  | "chart"
  | "box";

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

function NavIcon({ name }: { name?: VedIconName }) {
  const Icon = ICONS[name || "list"] || List;
  return <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.8} />;
}

export function VedShell({
  brand = "Кабинет",
  subtitle,
  nav,
  footer,
  title,
  lead,
  actions,
  avatarUrl = "/cabinets/assets/avatar-user.jpg",
  markVariant = "blue",
  children,
}: {
  brand?: string;
  subtitle?: string;
  nav: VedNavItem[];
  footer?: ReactNode;
  title?: string;
  lead?: string;
  actions?: ReactNode;
  avatarUrl?: string;
  markVariant?: "blue" | "admin";
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div
      className="flex min-h-dvh bg-[var(--kb-bg)] text-[var(--kb-ink)]"
      style={{ fontFamily: "var(--kb-font-ui)" }}
    >
      {/* Full-bleed shell: sidebar flush to viewport left (matches cargo-broker-cabinets.html) */}
      <aside
        className="hidden w-[260px] shrink-0 flex-col px-3.5 py-5 text-slate-400 md:flex"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 0% 0%, rgba(43,114,244,.28), transparent 50%), #0f172a",
        }}
      >
        <div className="mb-5 flex items-center gap-3 px-1.5">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] text-white shadow-[0_10px_22px_rgba(43,114,244,0.35)] ${
              markVariant === "admin"
                ? "bg-gradient-to-br from-[#2b72f4] to-[#7c3aed]"
                : "bg-[#2b72f4]"
            }`}
          >
            <Box className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-white" style={{ fontFamily: "var(--kb-font-display)" }}>
              {brand}
            </div>
            {subtitle && <div className="truncate text-[11px] font-medium text-slate-500">{subtitle}</div>}
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {nav.map((item, i) => {
            const prev = nav[i - 1];
            const showGroup = Boolean(item.group && item.group !== prev?.group);
            const active = pathname === item.href;
            return (
              <div key={item.href}>
                {showGroup && (
                  <div
                    className={`px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 ${
                      i === 0 ? "pt-0" : "pt-3"
                    }`}
                  >
                    {item.group}
                  </div>
                )}
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition ${
                    active ? "bg-[#2b72f4] text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <NavIcon name={item.icon} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge != null && item.badge !== "" && Number(item.badge) !== 0 && (
                    <span
                      className={`grid min-w-[22px] place-items-center rounded-full px-1.5 text-[11px] font-bold ${
                        active ? "bg-white/25" : "bg-white/10"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        {footer && (
          <div className="mt-3.5 rounded-[14px] border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-slate-400">
            {footer}
          </div>
        )}

        <div className="mt-2 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-400 hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {(title || actions) && (
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-black/[0.04] px-4 py-3.5 md:px-[22px]">
            <div className="min-w-0">
              {title && (
                <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--kb-font-display)" }}>
                  {title}
                </h1>
              )}
              {lead && <p className="mt-0.5 text-sm text-[var(--kb-muted)]">{lead}</p>}
            </div>
            <div className="flex items-center gap-3">
              {actions}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm"
              />
            </div>
          </header>
        )}

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-black/[0.04] bg-white px-2 py-2 md:hidden">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  active ? "bg-[#2b72f4] text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex min-w-0 flex-1 flex-col px-4 py-5 md:px-[22px] md:pb-10">{children}</main>
      </div>
    </div>
  );
}

export function VedEmptyState({
  title,
  hint,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="font-medium text-[#0f172a]">{title}</p>
      {hint && <p className="mt-1 text-sm text-[var(--kb-muted)]">{hint}</p>}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-full bg-[#2b72f4] px-4 py-2 text-xs font-semibold text-white"
        >
          {actionLabel}
        </Link>
      )}
      {!actionHref && onAction && actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex rounded-full bg-[#2b72f4] px-4 py-2 text-xs font-semibold text-white"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600",
    AI_PROCESSING: "bg-[#e8f0fe] text-[#1a5fd4]",
    AI_READY: "bg-[#e8f0fe] text-[#1a5fd4]",
    AWAITING_PAYMENT: "bg-[#ffedd5] text-[#c2410c]",
    QUEUED: "bg-[#e8f0fe] text-[#1a5fd4]",
    IN_REVIEW: "bg-[#e8f0fe] text-[#1a5fd4]",
    DONE: "bg-[#dcfce7] text-[#16a34a]",
    SLA_RISK: "bg-[#fee2e2] text-[#dc2626]",
    CANCELLED: "bg-slate-100 text-slate-500",
    SUBMITTED: "bg-[#e8f0fe] text-[#1a5fd4]",
    REJECTED: "bg-[#fee2e2] text-[#dc2626]",
    POOLED: "bg-[#e8f0fe] text-[#1a5fd4]",
    OPEN: "bg-[#ffedd5] text-[#c2410c]",
    CONFIRMED: "bg-[#dcfce7] text-[#16a34a]",
    CLOSED: "bg-slate-100 text-slate-500",
  };
  const labels: Record<string, string> = {
    DRAFT: "Черновик",
    AI_PROCESSING: "AI",
    AI_READY: "AI готов",
    AWAITING_PAYMENT: "Оплата",
    QUEUED: "Очередь",
    IN_REVIEW: "У брокера",
    DONE: "Готово",
    SLA_RISK: "SLA",
    CANCELLED: "Отмена",
    SUBMITTED: "Отправлен",
    REJECTED: "Отклонён",
    POOLED: "В сборке",
    OPEN: "Набор",
    CONFIRMED: "Подтверждён",
    CLOSED: "Закрыт",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] || "bg-slate-100 text-slate-600"}`}
    >
      {labels[status] || status}
    </span>
  );
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = "";
    try {
      const err = text ? (JSON.parse(text) as { error?: string }) : {};
      message = err.error || "";
    } catch {
      message = "";
    }
    if (!message) {
      if (res.status === 401) message = "Unauthorized";
      else if (res.status === 403) message = "Forbidden";
      else message = `Request failed (${res.status})`;
    }
    throw new Error(`${message} (${url})`);
  }
  return res.json() as Promise<T>;
}
