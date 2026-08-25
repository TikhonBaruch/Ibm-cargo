"use client";

import { CLIENT_SEGMENT_HINTS, CLIENT_SEGMENT_LABELS, type ClientSegment } from "@/lib/ved/sku-order";
import { factoryUiEnabled } from "@/lib/ved/cabinet-features";

export type CompanyProfileFields = {
  name: string;
  inn: string;
  kpp: string;
  legalAddress: string;
  contactEmail: string;
  contactPhone: string;
  clientSegment: ClientSegment;
};

const FIELD_LABELS: Record<Exclude<keyof CompanyProfileFields, "clientSegment">, string> = {
  name: "Название компании",
  inn: "ИНН",
  kpp: "КПП",
  legalAddress: "Юр. адрес",
  contactEmail: "Контактный email",
  contactPhone: "Телефон",
};

const SEGMENTS: ClientSegment[] = ["RETAIL_SMALL", "SINGLE", "WHOLESALE"];

export function CompanySettingsPane({
  profile,
  busy,
  onChange,
  onSave,
}: {
  profile: CompanyProfileFields;
  busy: boolean;
  onChange: (next: CompanyProfileFields) => void;
  onSave: () => void;
}) {
  const factoryOn = factoryUiEnabled();
  return (
    <section className="max-w-xl space-y-4">
      {factoryOn ? (
        <div className="space-y-3 rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-sm">
          <p className="text-sm font-medium">Как вы закупаете</p>
          <p className="text-sm text-[var(--kb-muted)]">
            Три режима одной роли «клиент». Не отдельные кабинеты — меняется формат запросов производителю.
          </p>
          <div className="grid gap-2">
            {SEGMENTS.map((code) => (
              <label
                key={code}
                className={`flex cursor-pointer gap-3 rounded-2xl border px-3 py-3 text-sm ${
                  profile.clientSegment === code
                    ? "border-[#2b72f4] bg-[#e8f0fe]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="clientSegment"
                  className="mt-1"
                  checked={profile.clientSegment === code}
                  onChange={() => onChange({ ...profile, clientSegment: code })}
                />
                <span>
                  <span className="font-medium">{CLIENT_SEGMENT_LABELS[code]}</span>
                  <span className="mt-0.5 block text-[var(--kb-muted)]">{CLIENT_SEGMENT_HINTS[code]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <div className="space-y-3 rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-sm">
        <p className="text-sm text-[var(--kb-muted)]">
          Реквизиты компании используются в просчётах и документах. Раздел «Настройки» ведёт сюда же.
        </p>
        {(Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]).map((k) => (
          <label key={k} className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--kb-muted)]">{FIELD_LABELS[k]}</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={profile[k]}
              onChange={(e) => onChange({ ...profile, [k]: e.target.value })}
              placeholder={FIELD_LABELS[k]}
              autoComplete="off"
            />
          </label>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="rounded-full bg-[#2b72f4] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Сохранить
        </button>
      </div>
    </section>
  );
}
