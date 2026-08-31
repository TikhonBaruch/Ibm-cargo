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
    <div className="field">
      <label>Производитель</label>
      <span className="meta">Введите название вручную (каталог подсказок временно отключён).</span>
      <input
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
    </div>
  );
}
