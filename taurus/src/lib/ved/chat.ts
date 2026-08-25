import type { PrismaClient } from "@prisma/client";
import {
  allowedSupportActions,
  isActiveSupportStatus,
  nextSupportTicketPatch,
  replySupportTicketPatch,
  supportTicketStatusWhere,
  type SupportTicketAction,
} from "./support-ticket";

/** Broker inbox: threads for assigned calcs (IN_REVIEW / DONE / SLA_RISK). */
export async function listBrokerChatThreads(db: PrismaClient, brokerUserId: string) {
  return db.chatThread.findMany({
    where: {
      kind: "CALCULATION",
      calculation: {
        brokerUserId,
        status: { in: ["IN_REVIEW", "DONE", "SLA_RISK"] },
      },
    },
    include: {
      calculation: {
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          clientUser: { select: { name: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: { select: { id: true, name: true, role: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

const messagePreviewInclude = {
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: { author: { select: { id: true, name: true, role: true } } },
  },
};

function clientSupportOwnerWhere(clientUserId: string, companyId?: string | null) {
  return {
    OR: [
      { createdByUserId: clientUserId },
      ...(companyId ? [{ companyId }] : []),
      { messages: { some: { authorId: clientUserId } } },
    ],
  };
}

/**
 * Client support inbox.
 * Prefer companyId / createdByUserId (schema); fall back to message author for legacy rows.
 * Default box = active (OPEN + WAITING_CLIENT).
 */
export async function listClientSupportThreads(
  db: PrismaClient,
  opts: { clientUserId: string; companyId?: string | null; box?: string | null }
) {
  const { clientUserId, companyId, box } = opts;
  return db.chatThread.findMany({
    where: {
      kind: "SUPPORT",
      ...clientSupportOwnerWhere(clientUserId, companyId),
      ...supportTicketStatusWhere(box ?? "active"),
    },
    include: messagePreviewInclude,
    orderBy: { updatedAt: "desc" },
  });
}

/** Admin / staff SUPPORT inbox. Default box = all (no status filter) when omitted. */
export async function listAdminSupportThreads(db: PrismaClient, opts?: { box?: string | null }) {
  const box = opts?.box;
  return db.chatThread.findMany({
    where: {
      kind: "SUPPORT",
      ...(box ? supportTicketStatusWhere(box) : {}),
    },
    include: {
      ...messagePreviewInclude,
      createdByUser: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function getSupportThread(db: PrismaClient, threadId: string) {
  return db.chatThread.findFirst({
    where: { id: threadId, kind: "SUPPORT" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, role: true } } },
      },
      createdByUser: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
    },
  });
}

export async function replySupportThread(
  db: PrismaClient,
  opts: { threadId: string; authorId: string; body: string; waitingOn?: "CLIENT" | "BROKER" | null }
) {
  const thread = await db.chatThread.findFirst({
    where: { id: opts.threadId, kind: "SUPPORT" },
  });
  if (!thread) throw new Error("Support thread not found");
  if (!isActiveSupportStatus(thread.ticketStatus)) {
    throw new Error("Ticket is closed");
  }
  const waitingOn = opts.waitingOn ?? "CLIENT";
  const patch = replySupportTicketPatch(waitingOn);
  const message = await db.chatMessage.create({
    data: {
      threadId: thread.id,
      authorId: opts.authorId,
      body: opts.body,
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
  await db.chatThread.update({
    where: { id: thread.id },
    data: patch,
  });
  return { ...message, waitingOn: patch.waitingOn, ticketStatus: patch.ticketStatus };
}

export async function setSupportTicketStatus(
  db: PrismaClient,
  opts: {
    threadId: string;
    actorUserId: string;
    action: SupportTicketAction;
    role: "CLIENT" | "ADMIN";
  }
) {
  const thread = await db.chatThread.findFirst({
    where: { id: opts.threadId, kind: "SUPPORT" },
  });
  if (!thread) throw new Error("Support thread not found");
  const allowed = allowedSupportActions(thread.ticketStatus, opts.role);
  if (!allowed.includes(opts.action)) {
    throw new Error("Ticket action not allowed");
  }
  const patch = nextSupportTicketPatch(thread.ticketStatus, opts.action);
  return db.$transaction(async (tx) => {
    await tx.chatMessage.create({
      data: {
        threadId: thread.id,
        authorId: opts.actorUserId,
        body: patch.systemBody,
        isSystem: true,
      },
    });
    const updated = await tx.chatThread.update({
      where: { id: thread.id },
      data: {
        ticketStatus: patch.ticketStatus,
        waitingOn: patch.waitingOn,
        ...("resolvedAt" in patch ? { resolvedAt: patch.resolvedAt } : {}),
        ...("archivedAt" in patch ? { archivedAt: patch.archivedAt } : {}),
      },
    });
    return updated;
  });
}

/** Unread for client KPI: active threads waiting on CLIENT (broker/staff replied). */
export async function countClientUnread(
  db: PrismaClient,
  opts: { clientUserId: string; companyId?: string | null }
) {
  const { clientUserId, companyId } = opts;
  const [calcUnread, supportUnread] = await Promise.all([
    db.chatThread.count({
      where: {
        kind: "CALCULATION",
        waitingOn: "CLIENT",
        calculation: { clientUserId },
      },
    }),
    db.chatThread.count({
      where: {
        kind: "SUPPORT",
        waitingOn: "CLIENT",
        ticketStatus: { in: ["OPEN", "WAITING_CLIENT"] },
        ...clientSupportOwnerWhere(clientUserId, companyId),
      },
    }),
  ]);
  return calcUnread + supportUnread;
}

/** Unread for broker nav: CALCULATION threads waiting on BROKER. */
export async function countBrokerUnread(db: PrismaClient, brokerUserId: string) {
  return db.chatThread.count({
    where: {
      kind: "CALCULATION",
      waitingOn: "BROKER",
      calculation: {
        brokerUserId,
        status: { in: ["IN_REVIEW", "DONE", "SLA_RISK"] },
      },
    },
  });
}

/** Unread for admin SUPPORT nav: active tickets waiting on staff. */
export async function countAdminUnread(db: PrismaClient) {
  return db.chatThread.count({
    where: {
      kind: "SUPPORT",
      waitingOn: "BROKER",
      ticketStatus: "OPEN",
    },
  });
}

export async function createSupportTicket(
  db: PrismaClient,
  opts: { userId: string; companyId?: string | null; subject: string; body: string }
) {
  return db.$transaction(async (tx) => {
    let companyId = opts.companyId ?? null;
    if (!companyId) {
      const user = await tx.user.findUnique({
        where: { id: opts.userId },
        select: { companyId: true },
      });
      companyId = user?.companyId ?? null;
    }
    const thread = await tx.chatThread.create({
      data: {
        kind: "SUPPORT",
        subject: opts.subject.slice(0, 200),
        waitingOn: "BROKER",
        ticketStatus: "OPEN",
        companyId,
        createdByUserId: opts.userId,
      },
    });
    const message = await tx.chatMessage.create({
      data: {
        threadId: thread.id,
        authorId: opts.userId,
        body: opts.body,
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });
    return { thread, message, waitingOn: "BROKER" as const, ticketStatus: "OPEN" as const };
  });
}
