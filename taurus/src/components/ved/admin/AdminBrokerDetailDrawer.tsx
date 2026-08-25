"use client";

import { useEffect, useState } from "react";
import { VedDetailDrawer } from "../VedDetailDrawer";
import type { AdminBrokerRow } from "./types";

export function AdminBrokerDetailDrawer({
  broker,
  busy,
  onClose,
  onModerate,
  onSetAccepting,
  onSaveProfile,
}: {
  broker: AdminBrokerRow;
  busy: boolean;
  onClose: () => void;
  onModerate: (status: "APPROVED" | "REJECTED" | "PENDING") => void;
  onSetAccepting: (accepting: boolean) => void;
  onSaveProfile: (patch: {
    specialization: string;
    languages: string;
    about: string;
  }) => void;
}) {
  const [specialization, setSpecialization] = useState(broker.specialization || "");
  const [languages, setLanguages] = useState(broker.languages || "");
  const [about, setAbout] = useState(broker.about || "");

  useEffect(() => {
    setSpecialization(broker.specialization || "");
    setLanguages(broker.languages || "");
    setAbout(broker.about || "");
  }, [broker]);

  return (
    <VedDetailDrawer
      open
      title={broker.user.name || "Брокер"}
      subtitle="Админ · брокер"
      onClose={onClose}
    >
      <div className="space-y-5 rounded-[24px] border border-black/[0.04] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm text-[var(--kb-muted)]">
          {broker.user.email || "—"}
          {broker.user.phone ? ` · ${broker.user.phone}` : ""} · ★ {broker.rating} ·{" "}
          {broker.moderationStatus} ·{" "}
          {broker.acceptingJobs === false ? "не принимает" : "принимает"}
        </p>

        <div className="flex flex-wrap gap-2">
          {broker.moderationStatus !== "APPROVED" && (
            <button
              type="button"
              disabled={busy}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              onClick={() => onModerate("APPROVED")}
            >
              Одобрить
            </button>
          )}
          {broker.moderationStatus !== "REJECTED" && (
            <button
              type="button"
              disabled={busy}
              className="rounded-full border border-red-500 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"
              onClick={() => onModerate("REJECTED")}
            >
              Отклонить
            </button>
          )}
          {broker.moderationStatus !== "PENDING" && (
            <button
              type="button"
              disabled={busy}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              onClick={() => onModerate("PENDING")}
            >
              В ожидание
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            className="rounded-full border border-[#2b72f4]/40 px-3 py-1.5 text-xs font-semibold text-[#2b72f4] disabled:opacity-50"
            onClick={() => onSetAccepting(broker.acceptingJobs === false)}
          >
            {broker.acceptingJobs === false ? "Включить приём" : "Пауза приёма"}
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--kb-muted)]">Специализация</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--kb-muted)]">Языки</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--kb-muted)]">О себе</span>
            <textarea
              className="min-h-[96px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            className="rounded-full bg-[#2b72f4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => onSaveProfile({ specialization, languages, about })}
          >
            Сохранить профиль
          </button>
        </div>
      </div>
    </VedDetailDrawer>
  );
}
