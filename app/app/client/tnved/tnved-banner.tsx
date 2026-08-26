"use client";

import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export function TnvedLabBanner() {
  return (
    <DesignerStub
      title="Справочник ТН ВЭД + «1 раз бесплатно»"
      intent="Поиск по коду/названию и группам, первый полный просмотр карточки бесплатно — воронка в платный просчёт."
      gap="Ранжирование как lbm-bro (hs-aliases pin), данные и ставки — Postgres /api/v1/tnved. Freemium пока DemoProvider (localStorage)."
      compact
    />
  );
}
