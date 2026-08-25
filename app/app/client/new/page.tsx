"use client";

import { ClientWizard } from "@/lbm-bro/components/client-wizard";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import { useDemo } from "@/lbm-bro/lib/store";

export default function Page() {
  const { wizardSession } = useDemo();
  return (
    <>
      <DesignerStub
        title="Мастер просчёта (wizard)"
        intent="Дизайнер: шаги товар → документы/OCR → clarify-chips → тариф Код/Таможня/Под ключ → PDF; мультипозиция из CSV/XLSX/фото; апгрейд тарифа после кода."
        gap="Сейчас demo-store + локальный классификатор. Боевое создание — /cabinet/new → POST /api/v1/calculations (EXPRESS/STANDARD/PRO)."
      />
      <ClientWizard key={wizardSession} />
    </>
  );
}
