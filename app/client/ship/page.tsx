"use client";

import { ClientShip } from "@/lbm-bro/components/client-extra";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export default function Page() {
  return (
    <>
      <DesignerStub
        title="Грузоперевозки (LTL / FTL)"
        intent="Дизайнер: отдельный сервис наземной доставки (сборная/рейсовая фура), привязка к готовому просчёту, ориентир цены на экране — «сопровождение груза» как модуль суперприложения."
        gap="В LBM shipping domain есть, клиентский UI по умолчанию выключен (D27). Здесь — макет без боевого заказа перевозки."
      />
      <ClientShip />
    </>
  );
}
