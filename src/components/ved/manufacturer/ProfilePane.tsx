"use client";

import type { ManufacturerCompany } from "./types";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2b72f4]";

export function ProfilePane({
  company,
  busy,
  onChange,
  onSave,
}: {
  company: ManufacturerCompany | null;
  busy: boolean;
  onChange: (patch: Partial<ManufacturerCompany>) => void;
  onSave: () => void;
}) {
  if (!company) {
    return <p className="text-sm text-[var(--kb-muted)]">Компания не найдена.</p>;
  }

  return (
    <section className="max-w-xl space-y-3 rounded-[28px] border border-black/[0.04] bg-white p-5 shadow-sm">
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--kb-muted)]">Название</span>
        <input
          className={inputClass}
          value={company.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--kb-muted)]">ИНН</span>
        <input
          className={inputClass}
          value={company.inn || ""}
          onChange={(e) => onChange({ inn: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--kb-muted)]">Адрес</span>
        <input
          className={inputClass}
          value={company.legalAddress || ""}
          onChange={(e) => onChange({ legalAddress: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--kb-muted)]">Email</span>
        <input
          className={inputClass}
          type="email"
          value={company.contactEmail || ""}
          onChange={(e) => onChange({ contactEmail: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--kb-muted)]">Телефон</span>
        <input
          className={inputClass}
          value={company.contactPhone || ""}
          onChange={(e) => onChange({ contactPhone: e.target.value })}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className="rounded-full bg-[#2b72f4] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Сохранение…" : "Сохранить"}
      </button>
    </section>
  );
}
