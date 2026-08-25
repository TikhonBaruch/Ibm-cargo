"use client";

import { VedEmptyState } from "../VedShell";
import type { AdminBrokerRow } from "./types";

export function BrokersPane({
  brokers,
  selectedBrokerId,
  busy,
  onOpenBroker,
  onModerate,
  onSetAccepting,
}: {
  brokers: AdminBrokerRow[];
  selectedBrokerId?: string;
  busy: boolean;
  onOpenBroker: (id: string) => void;
  onModerate: (brokerProfileId: string, status: "APPROVED" | "REJECTED" | "PENDING") => void;
  onSetAccepting: (brokerProfileId: string, acceptingJobs: boolean) => void;
}) {
  return (
    <section>
      {brokers.length === 0 ? (
        <div className="rounded-[28px] border border-black/[0.04] bg-white shadow-sm">
          <VedEmptyState
            title="Нет брокеров"
            hint="Создайте пользователя с ролью BROKER в разделе «Пользователи», затем одобрите профиль здесь."
          />
        </div>
      ) : (
        <ul className="space-y-2 text-sm">
          {brokers.map((b) => {
            const active = selectedBrokerId === b.id;
            return (
              <li key={b.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-selected={active}
                  className={`flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-[28px] border px-4 py-3 text-left shadow-sm ${
                    active
                      ? "border-[#2b72f4]/40 bg-[rgba(43,114,244,0.08)] shadow-[inset_3px_0_0_#2b72f4]"
                      : "border-black/[0.04] bg-white hover:border-[#2b72f4]/30"
                  }`}
                  onClick={() => onOpenBroker(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenBroker(b.id);
                    }
                  }}
                >
                  <span>
                    {b.user.name} · {b.specialization || "—"} · ★ {b.rating} · {b.moderationStatus} ·{" "}
                    {b.acceptingJobs === false ? "не принимает" : "принимает"}
                  </span>
                  <span className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    {b.moderationStatus !== "APPROVED" && (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        onClick={() => onModerate(b.id, "APPROVED")}
                      >
                        Одобрить
                      </button>
                    )}
                    {b.moderationStatus !== "REJECTED" && (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-full border border-red-500 px-3 py-1 text-xs font-semibold text-red-600 disabled:opacity-50"
                        onClick={() => onModerate(b.id, "REJECTED")}
                      >
                        Отклонить
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-full border border-[#2b72f4]/40 px-3 py-1 text-xs font-semibold text-[#2b72f4] disabled:opacity-50"
                      onClick={() => onSetAccepting(b.id, b.acceptingJobs === false)}
                    >
                      {b.acceptingJobs === false ? "Включить" : "Пауза"}
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
