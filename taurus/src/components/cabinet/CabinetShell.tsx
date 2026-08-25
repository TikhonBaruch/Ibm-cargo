"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListOrdered,
  Users,
  Ship,
  Wallet,
  MessageCircle,
  Settings,
  User,
  Home,
  FilePlus2,
} from "lucide-react";
import { shippingUiEnabled } from "@/lib/ved/cabinet-features";

const sideAll = [
  { href: "/cabinet", label: "Дашборд", icon: LayoutDashboard },
  { href: "/cabinet/orders", label: "Заявки / просчёты", icon: ListOrdered },
  { href: "/cabinet/new", label: "Новый просчёт", icon: FilePlus2 },
  { href: "/cabinet/brokers", label: "Брокеры", icon: Users },
  { href: "/cabinet/shipping", label: "Перевозка", icon: Ship },
  { href: "/cabinet/balance", label: "Баланс", icon: Wallet },
  { href: "/cabinet/support", label: "Поддержка", icon: MessageCircle },
  { href: "/cabinet/settings", label: "Настройки", icon: Settings },
  { href: "/cabinet/profile", label: "Профиль", icon: User },
];

const side = shippingUiEnabled()
  ? sideAll
  : sideAll.filter((item) => item.href !== "/cabinet/shipping");

const tabs = [
  { href: "/cabinet", label: "Главная", icon: Home },
  { href: "/cabinet/orders", label: "Заявки", icon: ListOrdered },
  { href: "/cabinet/support", label: "Чат", icon: MessageCircle },
  { href: "/cabinet/profile", label: "Профиль", icon: User },
];

export function CabinetShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-kb-bg text-kb-ink">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="hidden w-60 shrink-0 flex-col bg-kb-ink text-white md:flex">
          <div className="border-b border-white/10 px-5 py-5">
            <Link href="/" className="font-display text-lg font-bold">
              LBM Брокер
            </Link>
            <div className="mt-1 text-xs text-slate-400">Клиент · ООО «Импортёр»</div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {side.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                    active ? "bg-kb-blue text-white" : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <header className="border-b border-black/5 bg-white/80 px-4 py-4 backdrop-blur md:px-8">
            <h1 className="font-display text-xl font-bold">{title}</h1>
            {description && <p className="text-sm text-kb-muted">{description}</p>}
          </header>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>

      {/* Mobile bottom tabbar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-black/5 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-2">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold ${
                  active ? "text-kb-blue" : "text-kb-muted"
                }`}
              >
                <t.icon className="h-5 w-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
