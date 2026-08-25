"use client";

import { ticketStatusChipClass, ticketStatusLabel } from "@/lib/ved/support-ticket";

export function SupportTicketChip({
  status,
  audience,
}: {
  status?: string | null;
  audience: "client" | "admin";
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ticketStatusChipClass(status)}`}
    >
      {ticketStatusLabel(status, audience)}
    </span>
  );
}
