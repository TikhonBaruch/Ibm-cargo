"use client";

import { ClientClearance } from "@/lbm-bro/components/client-extra";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export default function Page() {
  return (
    <>
      <DesignerStub
        title="Таможенное оформление"
        intent="Дизайнер: после кода ТН ВЭД — отдельный поток декларации, платежей и выпуска груза (документы, риски, «отправить в обработку»), не смешивая с простым QC брокера."
        gap="Полного продукта ТО в domain MVP нет (D27: ТН ВЭД → брокер QC → PDF). Макет показывает целевой UX."
      />
      <ClientClearance />
    </>
  );
}
