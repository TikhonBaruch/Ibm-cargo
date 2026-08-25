/** SUPPORT ticket lifecycle — keep in sync with src/lib/ved/support-ticket.ts */

export const ACTIVE_SUPPORT_STATUSES = ["OPEN", "WAITING_CLIENT"];
export const ARCHIVE_SUPPORT_STATUSES = ["RESOLVED", "ARCHIVED"];

export const SUPPORT_SYSTEM_BODIES = {
  resolve: "Обращение закрыто",
  archive: "Обращение перенесено в архив",
  reopen: "Обращение открыто снова",
};

export function isActiveSupportStatus(status) {
  return status === "OPEN" || status === "WAITING_CLIENT";
}

export function supportTicketStatusWhere(box) {
  switch (String(box || "").toLowerCase()) {
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

export function nextSupportTicketPatch(current, action) {
  if (action === "resolve") {
    if (!isActiveSupportStatus(current)) {
      throw new Error("Ticket cannot be closed");
    }
    return {
      ticketStatus: "RESOLVED",
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
      ticketStatus: "ARCHIVED",
      waitingOn: null,
      archivedAt: new Date(),
      systemBody: SUPPORT_SYSTEM_BODIES.archive,
    };
  }
  if (action !== "reopen") {
    throw new Error("Unknown ticket action");
  }
  if (current !== "RESOLVED" && current !== "ARCHIVED") {
    throw new Error("Ticket is already open");
  }
  return {
    ticketStatus: "OPEN",
    waitingOn: "BROKER",
    resolvedAt: null,
    archivedAt: null,
    systemBody: SUPPORT_SYSTEM_BODIES.reopen,
  };
}

export function allowedSupportActions(status, role) {
  const current = status || "OPEN";
  if (role === "CLIENT") {
    if (isActiveSupportStatus(current)) return ["resolve"];
    if (current === "RESOLVED" || current === "ARCHIVED") return ["reopen"];
    return [];
  }
  const out = [];
  if (isActiveSupportStatus(current)) out.push("resolve");
  if (current !== "ARCHIVED") out.push("archive");
  if (current === "RESOLVED" || current === "ARCHIVED") out.push("reopen");
  return out;
}

export function replySupportTicketPatch(waitingOn) {
  if (waitingOn === "CLIENT") {
    return { ticketStatus: "WAITING_CLIENT", waitingOn: "CLIENT" };
  }
  return { ticketStatus: "OPEN", waitingOn: "BROKER" };
}

export function supportStatusHttpCode(message) {
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
