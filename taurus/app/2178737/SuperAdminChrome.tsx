"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Bot,
  Users,
  Tag,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Star,
  Image as ImageIcon,
  Shield,
  Search,
  Settings,
  Server,
  ClipboardList,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  SUPER_ADMIN_BASE,
  isSuperAdminLoginPath,
} from "@/lib/ved/super-admin";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const nav: NavItem[] = [
  { label: "Обзор", href: SUPER_ADMIN_BASE, icon: LayoutDashboard },
  { label: "Публикации", href: `${SUPER_ADMIN_BASE}/posts`, icon: FileText },
  { label: "Акции", href: `${SUPER_ADMIN_BASE}/promos`, icon: Tag },
  { label: "Отзывы", href: `${SUPER_ADMIN_BASE}/reviews`, icon: Star },
  { label: "Галерея", href: `${SUPER_ADMIN_BASE}/gallery`, icon: ImageIcon },
  { label: "SEO", href: `${SUPER_ADMIN_BASE}/seo`, icon: Search },
  { label: "Специалисты", href: `${SUPER_ADMIN_BASE}/specialists`, icon: Users },
  { label: "Заявки CMS", href: `${SUPER_ADMIN_BASE}/bookings`, icon: ClipboardList },
  { label: "Пользователи", href: `${SUPER_ADMIN_BASE}/users`, icon: Users },
  { label: "Чат CMS", href: `${SUPER_ADMIN_BASE}/chat`, icon: MessageSquare },
  { label: "Telegram", href: `${SUPER_ADMIN_BASE}/telegram`, icon: Bot },
  { label: "Настройки", href: `${SUPER_ADMIN_BASE}/settings`, icon: Settings },
  { label: "Инфраструктура", href: `${SUPER_ADMIN_BASE}/infra`, icon: Server },
  { label: "Audit log", href: `${SUPER_ADMIN_BASE}/audit`, icon: Shield },
];

function navActive(pathname: string, href: string) {
  if (href === SUPER_ADMIN_BASE) return pathname === SUPER_ADMIN_BASE;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SuperAdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (status !== "authenticated") return;
    if (role !== "SUPER_ADMIN") {
      router.replace("/admin");
    }
  }, [status, role, router]);

  if (isSuperAdminLoginPath(pathname || "")) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#0f172a] text-slate-400"
        role="status"
      >
        Загрузка CMS…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <>{children}</>;
  }

  if (role !== "SUPER_ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a] text-slate-400">
        Нет доступа
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-[#f5f7fa] text-[#0f172a]">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href={SUPER_ADMIN_BASE} className="text-lg font-semibold">
            Super CMS
          </Link>
          <button type="button" className="text-[#7a7f89]" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <nav className="border-b border-slate-200 bg-[#0f172a] p-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                navActive(pathname || "", item.href) ? "bg-[#2b72f4] text-white" : "text-slate-300"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: `${SUPER_ADMIN_BASE}/login` })}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </nav>
      )}

      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 flex-col bg-[#0f172a] text-white">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <span className="text-lg font-semibold">LBM Брокер</span>
          <span className="text-xs text-slate-400">CMS</span>
          <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
            SUPER
          </span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active = navActive(pathname || "", item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                  active ? "bg-[#2b72f4] text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <div className="mt-4 border-t border-white/10 pt-3">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <LayoutDashboard className="h-4 w-4" />
              VED /admin
            </Link>
          </div>
        </nav>
        {session?.user && (
          <div className="border-t border-white/10 p-4">
            <div className="mb-2 truncate text-xs text-slate-400">{session.user.email}</div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `${SUPER_ADMIN_BASE}/login` })}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Выйти
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 p-4 md:ml-64 md:p-8">{children}</main>
    </div>
  );
}
