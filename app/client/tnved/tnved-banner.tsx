"use client";

import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export function TnvedLabBanner() {
  return (
    <DesignerStub
      title="Справочник ТН ВЭД + «1 раз бесплатно»"
      intent="Дизайнер: поиск по коду/названию, группы классификатора, первый просмотр одной позиции бесплатно — воронка в платный просчёт."
      gap="Локальный tnved.json в браузере. Domain: /api/v1/tnved/search + TnvedCode; freemium-гейта нет."
      compact
    />
  );
}
