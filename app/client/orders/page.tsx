"use client";

import { ClientOrders } from "@/lbm-bro/components/client-orders";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export default function Page() {
  return (
    <>
      <DesignerStub
        title="Лента заявок (карточки)"
        intent="Дизайнер: заявки как карточки с фильтрами Все / Оплата / ТН ВЭД / В работе / Готово — не таблица; статус-пиллы и прогресс на превью."
        gap="Сейчас демо-лента (localStorage). Боевой список — /cabinet/orders → GET /api/v1/calculations."
        compact
      />
      <ClientOrders />
    </>
  );
}
