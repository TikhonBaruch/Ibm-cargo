"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { Calc } from "./types";

/** Client reaction on HS draft or assembled result — visible once submitted. */
export function BrokerClientFeedback({ calc }: { calc: Calc }) {
  if (!calc.clientFeedbackAt) return null;

  const helpful = calc.clientFeedbackReaction === "HELPFUL";

  return (
    <div
      className={`rounded-2xl border px-3 py-3 text-sm ${
        helpful
          ? "border-emerald-100 bg-emerald-50/80 text-emerald-900"
          : "border-amber-100 bg-amber-50/80 text-amber-950"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-[#7a7f89]">
        Отклик клиента на черновик / результат
      </div>
      <div className="mt-1 flex items-center gap-2 font-medium">
        {helpful ? (
          <>
            <ThumbsUp className="h-4 w-4" aria-hidden />
            Полезно
          </>
        ) : (
          <>
            <ThumbsDown className="h-4 w-4" aria-hidden />
            Нужно доработать
          </>
        )}
        <span className="text-xs font-normal text-[#7a7f89]">
          {new Date(calc.clientFeedbackAt).toLocaleString("ru-RU")}
        </span>
      </div>
      {calc.clientFeedbackComment && (
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed opacity-90">
          {calc.clientFeedbackComment}
        </p>
      )}
      <p className="mt-2 text-[10px] leading-relaxed text-[#7a7f89]">
        Учитывайте при похожих товарах — отклики делают процесс удобнее и точнее для следующих
        клиентов.
      </p>
    </div>
  );
}
