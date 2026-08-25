"use client";

import { useParams } from "next/navigation";
import { ClientOrderPage } from "@/lbm-bro/components/client-order-page";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <DesignerStub
        title="Карточка заявки + апгрейд тарифа"
        intent="Дизайнер: вкладки параметры / оплата / код / платежи / файл; upgrade tiles Код→Таможня→Под ключ; PDF download/share; clarify и SLA на карточке."
        gap="Демо-стор и локальный PDF. Domain: статусы D8, тарифы EXPRESS/STANDARD/PRO, pay gate D11 — через /cabinet/orders?id=."
        compact
      />
      <ClientOrderPage id={String(id)} />
    </>
  );
}
