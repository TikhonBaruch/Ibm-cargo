"use client";

import { useState } from "react";
import { CLIENT_SEGMENT_HINTS, CLIENT_SEGMENT_LABELS, type ClientSegment } from "@/lib/ved/sku-order";
import { factoryUiEnabled } from "@/lib/ved/cabinet-features";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";

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

const NOTE_STUBS = [
  ["Статус заявки", "Push при смене этапа"],
  ["PDF на почту", "После утверждения брокером"],
  ["SMS от брокера", "Только срочные сообщения"],
  ["Двухфакторный вход", "SMS-код при входе"],
] as const;

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
  const [sw, setSw] = useState([true, true, false, true]);

  return (
    <div className="two">
      <div className="card" style={{ margin: 0 }}>
        <h3>Профиль компании</h3>
        <p className="meta" style={{ marginTop: 0, marginBottom: 12 }}>
          Реквизиты используются в просчётах и документах.
        </p>
        {(Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]).map((k) => (
          <div key={k} className="field">
            <label>{FIELD_LABELS[k]}</label>
            <input
              value={profile[k]}
              onChange={(e) => onChange({ ...profile, [k]: e.target.value })}
              placeholder={FIELD_LABELS[k]}
              autoComplete="off"
            />
          </div>
        ))}
        {factoryOn ? (
          <div className="field">
            <label>Как вы закупаете</label>
            <div className="grid" style={{ display: "grid", gap: 8 }}>
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
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={onSave}>
          Сохранить
        </button>
      </div>
      <div className="card" style={{ margin: 0 }}>
        <h3>Уведомления</h3>
        <DesignerStub
          title="Переключатели уведомлений"
          intent="Макет: push статуса, PDF на почту, SMS брокера, 2FA."
          gap="Живые уведомления идут через notify/чат. Тумблеры ниже не пишут в API."
          compact
        />
        {NOTE_STUBS.map(([t, d], i) => (
          <div key={t} className="set-row">
            <div>
              <strong>{t}</strong>
              <div className="meta">{d}</div>
            </div>
            <button
              type="button"
              className={`switch${sw[i] ? " on" : ""}`}
              onClick={() => setSw((s) => s.map((v, j) => (j === i ? !v : v)))}
              aria-label={t}
            >
              <i />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
