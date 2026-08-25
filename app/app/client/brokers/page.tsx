"use client";

import { ClientBrokers } from "@/lbm-bro/components/client-extra";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export default function Page() {
  return (
    <>
      <DesignerStub
        title="Выбор / назначение брокера"
        intent="Дизайнер: витрина брокеров (рейтинг, онлайн, специализация), назначение на активную заявку или чат — «под ключ» как отдельный сервис."
        gap="UI-витрина. Domain: preferred broker на create/pay + очередь после оплаты (D11); публичного маркетплейса брокеров в MVP нет."
        compact
      />
      <ClientBrokers />
    </>
  );
}
