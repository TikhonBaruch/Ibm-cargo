"use client";

import { ClientFaq } from "@/lbm-bro/components/client-extra";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export default function Page() {
  return (
    <>
      <DesignerStub
        title="FAQ под тарифную сетку дизайнера"
        intent="Дизайнер: ответы про Старт/Стандарт/Профи и Код/Таможня/Под ключ, freemium и мультипозицию — онбординг без саппорта."
        gap="Тексты отражают дизайн-тарифы, не D10 EXPRESS/STANDARD/PRO. Для боевых правил — /cabinet + product.md."
        compact
      />
      <ClientFaq />
    </>
  );
}
