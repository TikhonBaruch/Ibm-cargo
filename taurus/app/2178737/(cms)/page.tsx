"use client";

import Link from "next/link";
import { SUPER_ADMIN_BASE } from "@/lib/ved/super-admin";
import { SuperCmsStats } from "@/components/admin/SuperCmsStats";
import { SuperInfraPanel } from "@/components/admin/SuperInfraPanel";

type Section = {
  title: string;
  description: string;
  items: Array<{ href: string; label: string; hint: string }>;
};

const sections: Section[] = [
  {
    title: "Контент сайта",
    description: "Публикации, акции, отзывы, галерея, специалисты (legacy CMS, D6).",
    items: [
      { href: `${SUPER_ADMIN_BASE}/posts`, label: "Публикации", hint: "Статьи и модерация" },
      { href: `${SUPER_ADMIN_BASE}/promos`, label: "Акции", hint: "Промо-блоки" },
      { href: `${SUPER_ADMIN_BASE}/reviews`, label: "Отзывы", hint: "Модерация отзывов" },
      { href: `${SUPER_ADMIN_BASE}/gallery`, label: "Галерея", hint: "Секции и медиа" },
      { href: `${SUPER_ADMIN_BASE}/specialists`, label: "Специалисты", hint: "Команда на лендинге" },
      { href: `${SUPER_ADMIN_BASE}/seo`, label: "SEO", hint: "Meta / OG по pageKey" },
    ],
  },
  {
    title: "Доступ и коммуникации",
    description: "Пользователи платформы, чат CMS, Telegram-рассылки.",
    items: [
      { href: `${SUPER_ADMIN_BASE}/users`, label: "Пользователи", hint: "CRUD ролей (без SUPER)" },
      { href: `${SUPER_ADMIN_BASE}/chat`, label: "Чат CMS", hint: "Внутренний чат" },
      { href: `${SUPER_ADMIN_BASE}/telegram`, label: "Telegram", hint: "Получатели / бот" },
      { href: `${SUPER_ADMIN_BASE}/bookings`, label: "Заявки CMS", hint: "Legacy Booking" },
    ],
  },
  {
    title: "Управление и безопасность",
    description: "Сайтовые флаги, инфраструктура, журнал действий.",
    items: [
      { href: `${SUPER_ADMIN_BASE}/settings`, label: "Настройки сайта", hint: "Restricted mode" },
      { href: `${SUPER_ADMIN_BASE}/infra`, label: "Инфраструктура", hint: "Env / доступы" },
      { href: `${SUPER_ADMIN_BASE}/audit`, label: "Audit log", hint: "Журнал SUPER/CMS" },
      { href: "/admin", label: "VED /admin", hint: "Операции ВЭД-платформы" },
    ],
  },
];

export default function SuperAdminHomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-[#0f172a]">Супер-админ · управление</h1>
        <p className="mt-2 text-sm text-[#7a7f89]">
          Legacy CMS и инфраструктура (SUPER_ADMIN). Операции ВЭД — в{" "}
          <Link href="/admin" className="font-medium text-[#2b72f4]">
            /admin
          </Link>
          . Не лицо продукта (D6).
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#7a7f89]">Сводка</h2>
        <SuperCmsStats />
      </section>

      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-lg font-semibold text-[#0f172a]">{section.title}</h2>
          <p className="mt-1 text-sm text-[#7a7f89]">{section.description}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-[#2b72f4]/40"
                >
                  <div className="text-sm font-semibold text-[#0f172a]">{item.label}</div>
                  <div className="mt-0.5 text-xs text-[#7a7f89]">{item.hint}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <SuperInfraPanel />
    </div>
  );
}
