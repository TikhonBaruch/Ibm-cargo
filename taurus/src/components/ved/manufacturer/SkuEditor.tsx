"use client";

import { SKU_FEATURE_KIND_LABELS, SKU_PACK_LEVEL_LABELS, type ManufacturerSku } from "./types";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[var(--kb-muted)]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2b72f4]";

function numOrUndef(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function SkuEditor({
  form,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  form: Partial<ManufacturerSku>;
  busy: boolean;
  onChange: (patch: Partial<ManufacturerSku>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const features = form.features || [];
  const packagings = form.packagings || [];

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Артикул SKU *">
          <input
            className={inputClass}
            value={form.sku || ""}
            onChange={(e) => onChange({ sku: e.target.value })}
            required
          />
        </Field>
        <Field label="GTIN / EAN">
          <input
            className={inputClass}
            value={form.gtin || ""}
            onChange={(e) => onChange({ gtin: e.target.value })}
          />
        </Field>
        <Field label="Название *">
          <input
            className={inputClass}
            value={form.name || ""}
            onChange={(e) => onChange({ name: e.target.value })}
            required
          />
        </Field>
        <Field label="Статус">
          <select
            className={inputClass}
            value={form.status || "DRAFT"}
            onChange={(e) =>
              onChange({ status: e.target.value as ManufacturerSku["status"] })
            }
          >
            <option value="DRAFT">Черновик</option>
            <option value="PUBLISHED">Опубликован</option>
            <option value="ARCHIVED">Архив</option>
          </select>
        </Field>
        <Field label="Бренд">
          <input
            className={inputClass}
            value={form.brand || ""}
            onChange={(e) => onChange({ brand: e.target.value })}
          />
        </Field>
        <Field label="Модель">
          <input
            className={inputClass}
            value={form.model || ""}
            onChange={(e) => onChange({ model: e.target.value })}
          />
        </Field>
        <Field label="Вариант / комплектация">
          <input
            className={inputClass}
            value={form.variant || ""}
            onChange={(e) => onChange({ variant: e.target.value })}
          />
        </Field>
        <Field label="Страна (ISO2)">
          <input
            className={inputClass}
            maxLength={2}
            value={form.originCountry || ""}
            onChange={(e) => onChange({ originCountry: e.target.value.toUpperCase() })}
          />
        </Field>
      </div>

      <Field label="Таможенное наименование">
        <input
          className={inputClass}
          value={form.customsName || ""}
          onChange={(e) => onChange({ customsName: e.target.value })}
        />
      </Field>
      <Field label="Описание">
        <textarea
          className={inputClass}
          rows={3}
          value={form.description || ""}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>

      <h3 className="text-sm font-semibold">Физика изделия</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Нетто, кг">
          <input
            className={inputClass}
            type="number"
            min={0}
            step="0.001"
            value={form.netWeightKg ?? ""}
            onChange={(e) => onChange({ netWeightKg: numOrUndef(e.target.value) })}
          />
        </Field>
        <Field label="Брутто, кг">
          <input
            className={inputClass}
            type="number"
            min={0}
            step="0.001"
            value={form.grossWeightKg ?? ""}
            onChange={(e) => onChange({ grossWeightKg: numOrUndef(e.target.value) })}
          />
        </Field>
        <Field label="Объём, м³">
          <input
            className={inputClass}
            type="number"
            min={0}
            step="0.0001"
            value={form.volumeM3 ?? ""}
            onChange={(e) => onChange({ volumeM3: numOrUndef(e.target.value) })}
          />
        </Field>
        <Field label="Длина, мм">
          <input
            className={inputClass}
            type="number"
            min={0}
            value={form.lengthMm ?? ""}
            onChange={(e) => onChange({ lengthMm: numOrUndef(e.target.value) })}
          />
        </Field>
        <Field label="Ширина, мм">
          <input
            className={inputClass}
            type="number"
            min={0}
            value={form.widthMm ?? ""}
            onChange={(e) => onChange({ widthMm: numOrUndef(e.target.value) })}
          />
        </Field>
        <Field label="Высота, мм">
          <input
            className={inputClass}
            type="number"
            min={0}
            value={form.heightMm ?? ""}
            onChange={(e) => onChange({ heightMm: numOrUndef(e.target.value) })}
          />
        </Field>
      </div>

      <h3 className="text-sm font-semibold">Состав и признаки классификации</h3>
      <Field label="Состав (текст)">
        <textarea
          className={inputClass}
          rows={2}
          value={form.compositionText || ""}
          onChange={(e) => onChange({ compositionText: e.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Материал">
          <input
            className={inputClass}
            value={form.material || ""}
            onChange={(e) => onChange({ material: e.target.value })}
          />
        </Field>
        <Field label="Назначение">
          <input
            className={inputClass}
            value={form.purpose || ""}
            onChange={(e) => onChange({ purpose: e.target.value })}
          />
        </Field>
        <Field label="HS-подсказка производителя">
          <input
            className={inputClass}
            value={form.hsHint || ""}
            onChange={(e) => onChange({ hsHint: e.target.value })}
          />
        </Field>
        <Field label="Площадка / завод">
          <input
            className={inputClass}
            value={form.factoryName || ""}
            onChange={(e) => onChange({ factoryName: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Техспеки">
        <textarea
          className={inputClass}
          rows={2}
          value={form.technicalSpecs || ""}
          onChange={(e) => onChange({ technicalSpecs: e.target.value })}
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Декларируемые / учитываемые части</h3>
          <button
            type="button"
            className="text-sm text-[#2b72f4]"
            onClick={() =>
              onChange({
                features: [...features, { kind: "COMPOSITION", separatelyDeclared: false }],
              })
            }
          >
            + признак
          </button>
        </div>
        {features.map((f, i) => (
          <div key={i} className="grid gap-2 rounded-2xl bg-[#f5f7fa] p-3 sm:grid-cols-6">
            <select
              className={inputClass}
              value={f.kind}
              onChange={(e) => {
                const next = [...features];
                next[i] = { ...f, kind: e.target.value };
                onChange({ features: next });
              }}
            >
              {Object.entries(SKU_FEATURE_KIND_LABELS).map(([k, lab]) => (
                <option key={k} value={k}>
                  {lab}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              placeholder="Значение"
              value={f.value || ""}
              onChange={(e) => {
                const next = [...features];
                next[i] = { ...f, value: e.target.value };
                onChange({ features: next });
              }}
            />
            <input
              className={inputClass}
              placeholder="Ед."
              value={f.unit || ""}
              onChange={(e) => {
                const next = [...features];
                next[i] = { ...f, unit: e.target.value };
                onChange({ features: next });
              }}
            />
            <input
              className={inputClass}
              type="number"
              placeholder="% доли"
              value={f.sharePct ?? ""}
              onChange={(e) => {
                const next = [...features];
                next[i] = { ...f, sharePct: numOrUndef(e.target.value) };
                onChange({ features: next });
              }}
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={Boolean(f.separatelyDeclared)}
                onChange={(e) => {
                  const next = [...features];
                  next[i] = { ...f, separatelyDeclared: e.target.checked };
                  onChange({ features: next });
                }}
              />
              Отд. позиция ДТ
            </label>
            <button
              type="button"
              className="text-xs text-red-600"
              onClick={() => onChange({ features: features.filter((_, j) => j !== i) })}
            >
              Удалить
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Упаковка и транспорт</h3>
          <button
            type="button"
            className="text-sm text-[#2b72f4]"
            onClick={() => onChange({ packagings: [...packagings, { level: "MASTER" }] })}
          >
            + уровень
          </button>
        </div>
        {packagings.map((p, i) => (
          <div key={i} className="grid gap-2 rounded-2xl bg-[#f5f7fa] p-3 sm:grid-cols-4">
            <select
              className={inputClass}
              value={p.level}
              onChange={(e) => {
                const next = [...packagings];
                next[i] = { ...p, level: e.target.value };
                onChange({ packagings: next });
              }}
            >
              {Object.entries(SKU_PACK_LEVEL_LABELS).map(([k, lab]) => (
                <option key={k} value={k}>
                  {lab}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              placeholder="Тип (короб, европаллета)"
              value={p.packType || ""}
              onChange={(e) => {
                const next = [...packagings];
                next[i] = { ...p, packType: e.target.value };
                onChange({ packagings: next });
              }}
            />
            <input
              className={inputClass}
              type="number"
              placeholder="шт. в родителе"
              value={p.qtyPerParent ?? ""}
              onChange={(e) => {
                const next = [...packagings];
                next[i] = { ...p, qtyPerParent: numOrUndef(e.target.value) };
                onChange({ packagings: next });
              }}
            />
            <input
              className={inputClass}
              type="number"
              placeholder="Вес, кг"
              value={p.weightKg ?? ""}
              onChange={(e) => {
                const next = [...packagings];
                next[i] = { ...p, weightKg: numOrUndef(e.target.value) };
                onChange({ packagings: next });
              }}
            />
            <input
              className={inputClass}
              type="number"
              placeholder="Д, мм"
              value={p.lengthMm ?? ""}
              onChange={(e) => {
                const next = [...packagings];
                next[i] = { ...p, lengthMm: numOrUndef(e.target.value) };
                onChange({ packagings: next });
              }}
            />
            <input
              className={inputClass}
              type="number"
              placeholder="Ш, мм"
              value={p.widthMm ?? ""}
              onChange={(e) => {
                const next = [...packagings];
                next[i] = { ...p, widthMm: numOrUndef(e.target.value) };
                onChange({ packagings: next });
              }}
            />
            <input
              className={inputClass}
              type="number"
              placeholder="В, мм"
              value={p.heightMm ?? ""}
              onChange={(e) => {
                const next = [...packagings];
                next[i] = { ...p, heightMm: numOrUndef(e.target.value) };
                onChange({ packagings: next });
              }}
            />
            <button
              type="button"
              className="text-xs text-red-600"
              onClick={() => onChange({ packagings: packagings.filter((_, j) => j !== i) })}
            >
              Удалить
            </button>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold">Партия (для будущей консолидации)</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="MOQ, шт">
          <input
            className={inputClass}
            type="number"
            min={1}
            value={form.moq ?? ""}
            onChange={(e) => onChange({ moq: numOrUndef(e.target.value) })}
          />
        </Field>
        <Field label="Кратность">
          <input
            className={inputClass}
            type="number"
            min={1}
            value={form.packMultiple ?? ""}
            onChange={(e) => onChange({ packMultiple: numOrUndef(e.target.value) })}
          />
        </Field>
        <Field label="Инкотермс">
          <input
            className={inputClass}
            value={form.incoterms || ""}
            onChange={(e) => onChange({ incoterms: e.target.value })}
            placeholder="EXW"
          />
        </Field>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !form.sku || !form.name}
          className="rounded-full bg-[#2b72f4] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Сохранение…" : "Сохранить"}
        </button>
        <button type="button" className="text-sm text-[var(--kb-muted)]" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
