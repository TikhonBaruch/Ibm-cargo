"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { Calc, ClientFeedbackReaction } from "./types";

export function OrderResultFeedback({
  selected,
  busy,
  onSubmit,
}: {
  selected: Calc;
  busy: boolean;
  onSubmit: (reaction: ClientFeedbackReaction, comment?: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [pendingReaction, setPendingReaction] = useState<ClientFeedbackReaction | null>(null);
  const [localSubmitted, setLocalSubmitted] = useState(false);

  if (!["AI_READY", "AWAITING_PAYMENT", "QUEUED", "IN_REVIEW", "SLA_RISK", "DONE"].includes(selected.status)) {
    return null;
  }
  if (selected.status !== "DONE" && !selected.hsCode && !selected.items?.some((i) => i.hsCodeAi || i.attrs?.hsHint)) {
    return null;
  }

  const submitted = Boolean(selected.clientFeedbackAt) || localSubmitted;
  const savedReaction = selected.clientFeedbackReaction;

  if (submitted) {
    const label =
      savedReaction === "NEEDS_WORK"
        ? "Спасибо — мы учтём, что результат нужно доработать."
        : "Спасибо — рады, что просчёт оказался полезным.";
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-[#0f172a]">
        <p className="font-medium">{label}</p>
        {selected.clientFeedbackComment && (
          <p className="mt-1 text-xs text-[#7a7f89]">{selected.clientFeedbackComment}</p>
        )}
      </div>
    );
  }

  const submit = async (reaction: ClientFeedbackReaction) => {
    setPendingReaction(reaction);
    try {
      await onSubmit(reaction, comment.trim() || undefined);
      setLocalSubmitted(true);
    } finally {
      setPendingReaction(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[#2b72f4]/15 bg-[#2b72f4]/[0.04] px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-[#0f172a]">
          {selected.status === "DONE" ? "Как вам собранный ответ?" : "Черновик ТН ВЭД похож на товар?"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#7a7f89]">
          Ваша реакция нужна, чтобы сделать процесс удобнее, дешевле и эффективнее — мы учитываем
          её при улучшении AI-черновиков и работы брокеров.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || pendingReaction != null}
          onClick={() => void submit("HELPFUL")}
          className="inline-flex items-center gap-2 rounded-full bg-[#2b72f4] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
          {pendingReaction === "HELPFUL" ? "Отправка…" : "Полезно"}
        </button>
        <button
          type="button"
          disabled={busy || pendingReaction != null}
          onClick={() => void submit("NEEDS_WORK")}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0f172a] disabled:opacity-50"
        >
          <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
          {pendingReaction === "NEEDS_WORK" ? "Отправка…" : "Нужно доработать"}
        </button>
      </div>

      <label className="block text-xs text-[#7a7f89]">
        Комментарий (необязательно)
        <textarea
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#0f172a]"
          rows={2}
          maxLength={2000}
          placeholder="Что улучшить в коде, платежах или PDF?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={busy || pendingReaction != null}
        />
      </label>
    </div>
  );
}
