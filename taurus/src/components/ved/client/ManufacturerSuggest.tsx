"use client";

/**
 * Stub manufacturer field (directory search out of scope for now).
 * Free text only — no API directory / propose UX.
 */
export type ManufacturerSuggestValue = {
  manufacturerName: string;
  companyId?: string;
  proposalId?: string;
  status?: "approved" | "pending" | "draft";
};

export function ManufacturerSuggest({
  value,
  onChange,
  disabled,
}: {
  value: ManufacturerSuggestValue;
  onChange: (next: ManufacturerSuggestValue) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">Производитель</span>
      <span className="mb-1.5 block text-[11px] leading-snug text-[var(--kb-muted)]">
        Введите название вручную (каталог подсказок временно отключён).
      </span>
      <input
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        placeholder="Название производителя"
        value={value.manufacturerName}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) =>
          onChange({
            manufacturerName: e.target.value,
            status: "draft",
          })
        }
      />
    </label>
  );
}
