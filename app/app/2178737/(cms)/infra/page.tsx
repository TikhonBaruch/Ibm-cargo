"use client";

import { SuperInfraPanel } from "@/components/admin/SuperInfraPanel";

export default function SuperInfraPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-[#0f172a]">Инфраструктура</h1>
      <p className="text-sm text-[#7a7f89]">
        Структура среды и учётные данные из env (только SUPER_ADMIN). Секреты не хранятся в git.
      </p>
      <SuperInfraPanel compact />
    </div>
  );
}
