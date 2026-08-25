"use client";

import { useEffect, useState } from "react";
import { VedDetailDrawer } from "../VedDetailDrawer";
import { StatusPill, VedEmptyState } from "../VedShell";
import { CLIENT_SEGMENT_HINTS, CLIENT_SEGMENT_LABELS, type ClientSegment } from "@/lib/ved/sku-order";
import type { AdminCompanyDetail } from "./types";

const SEGMENTS: ClientSegment[] = ["RETAIL_SMALL", "SINGLE", "WHOLESALE"];

type ProfileForm = {
  name: string;
  inn: string;
  kpp: string;
  legalAddress: string;
  contactEmail: string;
  contactPhone: string;
  clientSegment: ClientSegment;
};

function formFromCompany(c: AdminCompanyDetail): ProfileForm {
  return {
    name: c.name || "",
    inn: c.inn || "",
    kpp: c.kpp || "",
    legalAddress: c.legalAddress || "",
    contactEmail: c.contactEmail || "",
    contactPhone: c.contactPhone || "",
    clientSegment: (c.clientSegment as ClientSegment) || "SINGLE",
  };
}

export function AdminCompanyDetailDrawer({
  company,
  adjustAmount,
  adjustReason,
  busy,
  onClose,
  onAdjustAmount,
  onAdjustReason,
  onSubmitAdjust,
  onSaveProfile,
  onOpenBooking,
}: {
  company: AdminCompanyDetail;
  adjustAmount: string;
  adjustReason: string;
  busy: boolean;
  onClose: () => void;
  onAdjustAmount: (v: string) => void;
  onAdjustReason: (v: string) => void;
  onSubmitAdjust: () => void;
  onSaveProfile: (patch: ProfileForm) => void;
  onOpenBooking: (calcId: string) => void;
}) {
  const factory = company.kind === "MANUFACTURER";
  const [form, setForm] = useState(() => formFromCompany(company));

  useEffect(() => {
    setForm(formFromCompany(company));
  }, [company]);

  const stats = company.manufacturerStats;

  return (
    <VedDetailDrawer
      open
      title={company.name}
      subtitle={factory ? "Админ · производитель" : "Админ · импортёр"}
      onClose={onClose}
    >
      <div className="space-y-5 rounded-[24px] border border-black/[0.04] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm text-[var(--kb-muted)]">
          ИНН {company.inn || "—"} · баланс{" "}
          <strong className="text-[var(--kb-ink)]">
            {company.balanceRub.toLocaleString("ru-RU")} ₽
          </strong>
          {factory && stats ? (
            <>
              {" "}
              · SKU {stats.skuPublished}/{stats.skuTotal} · запросов {stats.requestsSubmitted} · пулов{" "}
              {stats.poolsOpen}
            </>
          ) : (
            company._count?.calculations != null && <> · заявок {company._count.calculations}</>
          )}
        </p>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Реквизиты</h3>
          {(
            [
              ["name", "Название"],
              ["inn", "ИНН"],
              ["kpp", "КПП"],
              ["legalAddress", "Юр. адрес"],
              ["contactEmail", "Email"],
              ["contactPhone", "Телефон"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1 block text-xs text-[var(--kb-muted)]">{label}</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          {!factory && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Режим кабинета
              </p>
              {SEGMENTS.map((code) => (
                <label
                  key={code}
                  className={`flex cursor-pointer gap-3 rounded-2xl border px-3 py-2.5 text-sm ${
                    form.clientSegment === code
                      ? "border-[#2b72f4] bg-[#e8f0fe]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="adminClientSegment"
                    className="mt-1"
                    checked={form.clientSegment === code}
                    onChange={() => setForm({ ...form, clientSegment: code })}
                  />
                  <span>
                    <span className="font-medium">{CLIENT_SEGMENT_LABELS[code]}</span>
                    <span className="mt-0.5 block text-xs text-[var(--kb-muted)]">
                      {CLIENT_SEGMENT_HINTS[code]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={busy || form.name.trim().length < 2}
            className="rounded-full bg-[#2b72f4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => onSaveProfile(form)}
          >
            Сохранить
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={adjustAmount}
            onChange={(e) => onAdjustAmount(e.target.value)}
            placeholder="Сумма ±₽"
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={adjustReason}
            onChange={(e) => onAdjustReason(e.target.value)}
            placeholder="Причина корректировки"
          />
          <button
            type="button"
            disabled={busy || !adjustReason.trim()}
            className="rounded-full border border-[#2b72f4]/40 px-4 py-2 text-sm font-semibold text-[#2b72f4] disabled:opacity-50"
            onClick={onSubmitAdjust}
          >
            Скорректировать
          </button>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Пользователи</h3>
          <ul className="space-y-1 text-sm">
            {company.users.map((u) => (
              <li key={u.id}>
                {u.name || "—"} · {u.email || "—"} · {u.role}
              </li>
            ))}
            {company.users.length === 0 && (
              <li className="text-[var(--kb-muted)]">Нет пользователей</li>
            )}
          </ul>
        </div>

        {factory && stats ? (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Каталог и сборные
            </h3>
            <p className="text-sm text-[var(--kb-muted)]">
              SKU всего {stats.skuTotal} (опубликовано {stats.skuPublished}, черновик {stats.skuDraft})
              · запросов в очереди {stats.requestsSubmitted} · открытых пулов {stats.poolsOpen}
            </p>
          </div>
        ) : (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Заявки</h3>
            {company.calculations.length === 0 ? (
              <VedEmptyState
                title="Нет заявок"
                hint="Просчёты компании появятся после создания клиентом."
              />
            ) : (
              <ul className="space-y-1 text-sm">
                {company.calculations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="text-[#2b72f4] hover:underline"
                      onClick={() => onOpenBooking(c.id)}
                    >
                      {c.number}
                    </button>{" "}
                    · {c.title} · <StatusPill status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ledger</h3>
          {company.ledgerEntries.length === 0 ? (
            <VedEmptyState
              title="Ledger пуст"
              hint="Операции появятся после оплаты тарифа или корректировки баланса."
            />
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
              {company.ledgerEntries.map((e) => (
                <li key={e.id} className="rounded-lg bg-slate-50 px-2 py-1.5">
                  {new Date(e.createdAt).toLocaleString("ru-RU")} · {e.kind} ·{" "}
                  {e.amountRub > 0 ? "+" : ""}
                  {e.amountRub.toLocaleString("ru-RU")} ₽ → {e.balanceAfter.toLocaleString("ru-RU")} ·{" "}
                  {e.description || "—"}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </VedDetailDrawer>
  );
}
