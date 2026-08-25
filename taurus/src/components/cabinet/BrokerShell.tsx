"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Briefcase,
  MessageCircle,
  Timer,
  Wallet,
  User,
} from "lucide-react";

const side = [
  { href: "/broker", label: "Дашборд", icon: LayoutDashboard },
  { href: "/broker/queue", label: "Очередь", icon: Inbox },
  { href: "/broker/work", label: "В работе", icon: Briefcase },
  { href: "/broker/chat", label: "Чат", icon: MessageCircle },
  { href: "/broker/sla", label: "SLA / статистика", icon: Timer },
  { href: "/broker/payouts", label: "Выплаты", icon: Wallet },
  { href: "/broker/profile", label: "Профиль", icon: User },
];

export function BrokerShell({
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
            <div className="mt-1 text-xs text-slate-400">Брокер · А. Иванов</div>
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
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-black/5 bg-white/80 px-4 py-4 backdrop-blur md:px-8">
            <h1 className="font-display text-xl font-bold">{title}</h1>
            {description && <p className="text-sm text-kb-muted">{description}</p>}
          </header>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
