/** SUPPORT ticket lifecycle — not Calculation D8. Keep in sync with containers/api/src/support-ticket.js */

export const SUPPORT_TICKET_STATUSES = ["OPEN", "WAITING_CLIENT", "RESOLVED", "ARCHIVED"] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_TICKET_ACTIONS = ["resolve", "archive", "reopen"] as const;
export type SupportTicketAction = (typeof SUPPORT_TICKET_ACTIONS)[number];

export const ACTIVE_SUPPORT_STATUSES: SupportTicketStatus[] = ["OPEN", "WAITING_CLIENT"];
export const ARCHIVE_SUPPORT_STATUSES: SupportTicketStatus[] = ["RESOLVED", "ARCHIVED"];

export const SUPPORT_SYSTEM_BODIES: Record<SupportTicketAction, string> = {
  resolve: "Обращение закрыто",
  archive: "Обращение перенесено в архив",
  reopen: "Обращение открыто снова",
};

export function isSupportTicketStatus(value: string | null | undefined): value is SupportTicketStatus {
  return SUPPORT_TICKET_STATUSES.includes(value as SupportTicketStatus);
}

export function isActiveSupportStatus(status: string | null | undefined): boolean {
  return status === "OPEN" || status === "WAITING_CLIENT";
}

export function supportTicketStatusWhere(box?: string | null): {
  ticketStatus: SupportTicketStatus | { in: SupportTicketStatus[] };
} | Record<string, never> {
  switch ((box || "").toLowerCase()) {
    case "archive":
      return { ticketStatus: { in: ["RESOLVED", "ARCHIVED"] } };
    case "waiting_client":
      return { ticketStatus: "WAITING_CLIENT" };
    case "resolved":
      return { ticketStatus: "RESOLVED" };
    case "archived":
      return { ticketStatus: "ARCHIVED" };
    case "open":
      return { ticketStatus: "OPEN" };
    case "inbox":
    case "active":
      return { ticketStatus: { in: ["OPEN", "WAITING_CLIENT"] } };
    case "all":
      return {};
    default:
      return { ticketStatus: { in: ["OPEN", "WAITING_CLIENT"] } };
  }
}

export function nextSupportTicketPatch(current: string, action: SupportTicketAction) {
  if (action === "resolve") {
    if (!isActiveSupportStatus(current)) {
      throw new Error("Ticket cannot be closed");
    }
    return {
      ticketStatus: "RESOLVED" as const,
      waitingOn: null,
      resolvedAt: new Date(),
      systemBody: SUPPORT_SYSTEM_BODIES.resolve,
    };
  }
  if (action === "archive") {
    if (current === "ARCHIVED") {
      throw new Error("Ticket already archived");
    }
    return {
      ticketStatus: "ARCHIVED" as const,
      waitingOn: null,
      archivedAt: new Date(),
      systemBody: SUPPORT_SYSTEM_BODIES.archive,
    };
  }
  if (current !== "RESOLVED" && current !== "ARCHIVED") {
    throw new Error("Ticket is already open");
  }
  return {
    ticketStatus: "OPEN" as const,
    waitingOn: "BROKER" as const,
    resolvedAt: null,
    archivedAt: null,
    systemBody: SUPPORT_SYSTEM_BODIES.reopen,
  };
}

export function allowedSupportActions(
  status: string | null | undefined,
  role: "CLIENT" | "ADMIN"
): SupportTicketAction[] {
  const current = status || "OPEN";
  if (role === "CLIENT") {
    if (isActiveSupportStatus(current)) return ["resolve"];
    if (current === "RESOLVED" || current === "ARCHIVED") return ["reopen"];
    return [];
  }
  const out: SupportTicketAction[] = [];
  if (isActiveSupportStatus(current)) out.push("resolve");
  if (current !== "ARCHIVED") out.push("archive");
  if (current === "RESOLVED" || current === "ARCHIVED") out.push("reopen");
  return out;
}

export function ticketStatusLabel(status: string | null | undefined, audience: "client" | "admin"): string {
  const s = status || "OPEN";
  if (audience === "client") {
    if (s === "OPEN") return "Ждём поддержку";
    if (s === "WAITING_CLIENT") return "Ваш ход";
    if (s === "RESOLVED") return "Закрыто";
    if (s === "ARCHIVED") return "Архив";
  } else {
    if (s === "OPEN") return "Нужен ответ";
    if (s === "WAITING_CLIENT") return "Ждёт клиента";
    if (s === "RESOLVED") return "Закрыто";
    if (s === "ARCHIVED") return "Архив";
  }
  return s;
}

export function ticketStatusChipClass(status: string | null | undefined): string {
  const s = status || "OPEN";
  if (s === "OPEN") return "bg-amber-50 text-amber-900";
  if (s === "WAITING_CLIENT") return "bg-[#e8f0fe] text-[#1a5fd4]";
  if (s === "RESOLVED") return "bg-emerald-50 text-emerald-800";
  return "bg-slate-100 text-slate-600";
}

export function replySupportTicketPatch(waitingOn: "CLIENT" | "BROKER") {
  if (waitingOn === "CLIENT") {
    return { ticketStatus: "WAITING_CLIENT" as const, waitingOn: "CLIENT" as const };
  }
  return { ticketStatus: "OPEN" as const, waitingOn: "BROKER" as const };
}

export function supportStatusHttpCode(message: string): number {
  const msg = String(message || "");
  if (msg.includes("not found")) return 404;
  if (
    msg.includes("closed") ||
    msg.includes("cannot") ||
    msg.includes("already") ||
    msg.includes("not allowed")
  ) {
    return 409;
  }
  return 400;
}
