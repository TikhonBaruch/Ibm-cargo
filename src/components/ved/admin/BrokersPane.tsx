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
  if (brokers.length === 0) {
    return (
      <section>
        <div className="card">
          <VedEmptyState
            title="Нет брокеров"
            hint="Создайте пользователя с ролью BROKER в разделе «Пользователи», затем одобрите профиль здесь."
          />
        </div>
      </section>
    );
  }

  const pending = brokers.filter((b) => b.moderationStatus === "PENDING").length;

  return (
    <section>
      {pending > 0 ? (
        <div className="alert-box warn-box">
          <strong>
            {pending} на модерации
          </strong>
          Проверьте профиль перед публикацией в каталоге.
        </div>
      ) : null}
      <div className="three">
        {brokers.map((b) => {
          const active = selectedBrokerId === b.id;
          const stars =
            b.rating > 0 ? `${"★".repeat(Math.min(5, Math.round(b.rating)))} ${b.rating.toFixed(1)}` : "Новый";
          return (
            <div
              key={b.id}
              className={`person-card col${active ? " is-open" : ""}`}
              role="button"
              tabIndex={0}
              aria-selected={active}
              onClick={() => onOpenBroker(b.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenBroker(b.id);
                }
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div className="photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/lbm-bro/assets/avatar-broker.svg" alt="" />
                </div>
                <div>
                  <strong>{b.user.name}</strong>
                  <div className="stars">{stars}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "10px 0" }}>
                {b.specialization || "Брокер ВЭД"} · {b.moderationStatus} ·{" "}
                {b.acceptingJobs === false ? "не принимает" : "принимает"}
              </p>
              <div
                style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                onClick={(e) => e.stopPropagation()}
              >
                {b.moderationStatus === "APPROVED" ? (
                  <span className="pill ok">Одобрен</span>
                ) : b.moderationStatus === "REJECTED" ? (
                  <span className="pill danger">Отклонён</span>
                ) : (
                  <span className="pill warn">Модерация</span>
                )}
                {b.moderationStatus !== "APPROVED" && (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-primary btn-sm"
                    onClick={() => onModerate(b.id, "APPROVED")}
                  >
                    Одобрить
                  </button>
                )}
                {b.moderationStatus !== "REJECTED" && (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-danger btn-sm"
                    onClick={() => onModerate(b.id, "REJECTED")}
                  >
                    Отклонить
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  className="btn btn-ghost btn-sm"
                  onClick={() => onSetAccepting(b.id, b.acceptingJobs === false)}
                >
                  {b.acceptingJobs === false ? "Включить" : "Пауза"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
