"use client";

import { ClientGuide } from "@/lbm-bro/components/client-extra";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export default function Page() {
  return (
    <>
      <DesignerStub
        title="Гайд «4 шага»"
        intent="Дизайнер: короткий сценарий Код → оплата → таможня → PDF/брокер — обучение на главной воронке суперприложения."
        gap="Копирайт под дизайн-тарифы. Domain happy-path: create → AI_READY → pay → queue → approve → PDF."
        compact
      />
      <ClientGuide />
    </>
  );
}
