"use client";

import { useMemo, useState } from "react";
import {
  analyzeBrokerDossier,
  buildDossierRequestMessage,
  DOSSIER_SPECIAL_LABELS,
  type DossierSpecialFlag,
} from "@/lib/ved/broker-dossier";
import type { Calc } from "./types";

const SPECIAL_FLAGS: DossierSpecialFlag[] = ["alcohol", "engine", "parts", "volume"];

export function BrokerDossierPane({
  calc,
  confidenceThreshold,
  busy,
  onRequest,
}: {
  calc: Calc;
  confidenceThreshold: number;
  busy: boolean;
  onRequest: (message: string) => Promise<void>;
}) {
  const [flags, setFlags] = useState<DossierSpecialFlag[]>(["parts"]);
  const [sending, setSending] = useState(false);

  const analysis = useMemo(
    () =>
      analyzeBrokerDossier({
        confidence: calc.confidence,
        hsCode: calc.hsCodeFinal || calc.hsCode,
        items: calc.items,
        confidenceThreshold,
      }),
    [calc.confidence, calc.hsCode, calc.hsCodeFinal, calc.items, confidenceThreshold]
  );

  if (!["IN_REVIEW", "SLA_RISK"].includes(calc.status)) return null;
  if (!analysis.thin && analysis.gaps.length === 0) return null;

  const toggle = (id: DossierSpecialFlag) => {
    setFlags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const send = async () => {
    setSending(true);
    try {
      await onRequest(buildDossierRequestMessage(analysis, flags));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-amber-800/80">
          Недостаточно данных
        </div>
        <p className="mt-1 text-xs leading-relaxed">
          ИИ не справился с уверенной классификацией, производителя нет в каталоге. Соберите
          вес, состав и особые элементы — так QC быстрее и дешевле, чем утверждать вслепую.
        </p>
      </div>
      <ul className="space-y-1 text-xs">
        {analysis.gaps.map((g) => (
          <li key={g.id}>
            {g.severity === "critical" ? "●" : "○"} {g.label}
          </li>
        ))}
      </ul>
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-amber-800/70">
          Спросить отдельно
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          {SPECIAL_FLAGS.map((id) => (
            <label key={id} className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={flags.includes(id)}
                onChange={() => toggle(id)}
              />
              {DOSSIER_SPECIAL_LABELS[id]}
            </label>
          ))}
        </div>
      </div>
      <button
        type="button"
        disabled={busy || sending || calc.status === "QUEUED"}
        onClick={() => void send()}
        className="rounded-full bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {sending ? "Отправка…" : "Запросить у клиента"}
      </button>
    </div>
  );
}
