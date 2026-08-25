"use client";

import { ClientChat } from "@/lbm-bro/components/client-extra";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export default function Page() {
  return (
    <>
      <DesignerStub
        title="Голосовые сообщения в чате"
        intent="Дизайнер заложил voice bubbles (запись/воспроизведение) в чате с брокером и поддержкой — быстрее уточнять состав/маркировку голосом."
        gap="В taurus чат текстовый. UI голоса в макете — заглушка до отдельного ADR."
        compact
      />
      <ClientChat />
    </>
  );
}
