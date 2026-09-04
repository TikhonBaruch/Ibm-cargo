"use client";

import { formatHsCode } from "@/lib/ved/tnved";
import { maskHsCodeForClient } from "@/lib/ved/tnved-client-hs-mask";

/** Client-only: first 3 digits clear, rest blurred + • (10-digit codes). */
export function ClientMaskedHsCode({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const parts = maskHsCodeForClient(code);
  if (!parts) {
    return <span className={className}>{formatHsCode(code) || code}</span>;
  }
  return (
    <span
      className={className}
      title="Полный 10-значный код подтвердит брокер"
      aria-label={`${parts.head}, остаток кода скрыт`}
    >
      <span>{parts.head}</span>
      <span className="hs-client-mask-tail" aria-hidden="true">
        {parts.tail}
      </span>
    </span>
  );
}
