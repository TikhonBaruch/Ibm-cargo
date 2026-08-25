"use client";

import { ClientBalance } from "@/lbm-bro/components/client-extra";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

export default function Page() {
  return (
    <>
      <DesignerStub
        title="Баланс и пополнение"
        intent="Дизайнер: баланс в шапке, сумма к пополнению (5/10/25к), способы карта / СБП / счёт юрлица, история списаний по просчётам."
        gap="Макет на demo ledger. Domain: company balance + ledger + mock/ЮKassa topup — /cabinet/balance."
        compact
      />
      <ClientBalance />
    </>
  );
}
