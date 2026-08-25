"use client";

import { ClientCompany } from "@/lbm-bro/components/client-extra";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export default function Page() {
  return (
    <>
      <DesignerStub
        title="Профиль компании и уведомления"
        intent="Дизайнер: реквизиты компании, тумблеры push / PDF на почту / SMS от брокера / 2FA — настройки доверия рядом с профилем."
        gap="Макет. Domain: PATCH company на /cabinet/profile; 2FA и SMS — не в MVP."
        compact
      />
      <ClientCompany />
    </>
  );
}
