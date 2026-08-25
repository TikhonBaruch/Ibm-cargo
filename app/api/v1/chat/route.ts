import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { z } from "zod";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import {
  createSupportTicket,
  countBrokerUnread,
  countClientUnread,
  countAdminUnread,
  getSupportThread,
  listAdminSupportThreads,
  listBrokerChatThreads,
  listClientSupportThreads,
  replySupportThread,
  setSupportTicketStatus,
} from "@/lib/ved/chat";
import {
  assertCalculationChatAccess,
  notifyCalculationChatMessage,
  notifySupportChatMessage,
} from "@/lib/ved/chat-notify";
import { supportStatusHttpCode } from "@/lib/ved/support-ticket";

function isStaff(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

async function clientOwnsSupportThread(
  userId: string,
  thread: { createdByUserId: string | null; companyId: string | null; messages?: Array<{ authorId: string | null }> }
) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  return (
    thread.createdByUserId === userId ||
    Boolean(me?.companyId && thread.companyId === me.companyId) ||
    Boolean(thread.messages?.some((m) => m.authorId === userId))
  );
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole(["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;
  const calculationId = req.nextUrl.searchParams.get("calculationId");
  const threadId = req.nextUrl.searchParams.get("threadId");
  const scope = req.nextUrl.searchParams.get("scope");
  const box = req.nextUrl.searchParams.get("box");

  const proxied = await proxyDomainApi("/v1/chat", {
    method: "GET",
    userId,
    role,
    query: req.nextUrl.searchParams,
  });
  if (proxied) return forwardDomainResponse(proxied);

  if (scope === "threads" && role === "BROKER") {
    const threads = await listBrokerChatThreads(prisma, userId);
    return NextResponse.json(threads);
  }

  if (scope === "support") {
    if (isStaff(role)) {
      const threads = await listAdminSupportThreads(prisma, { box });
      return NextResponse.json(threads);
    }
    if (role === "CLIENT") {
      const me = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true },
      });
      const threads = await listClientSupportThreads(prisma, {
        clientUserId: userId,
        companyId: me?.companyId,
        box,
      });
      return NextResponse.json(threads);
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope === "unread" && role === "CLIENT") {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    const count = await countClientUnread(prisma, {
      clientUserId: userId,
      companyId: me?.companyId,
    });
    return NextResponse.json({ count });
  }

  if (scope === "unread" && role === "BROKER") {
    const count = await countBrokerUnread(prisma, userId);
    return NextResponse.json({ count });
  }

  if (scope === "unread" && isStaff(role)) {
    const count = await countAdminUnread(prisma);
    return NextResponse.json({ count });
  }

  if (threadId) {
    const thread = await getSupportThread(prisma, threadId);
    if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (role === "CLIENT") {
      const allowed = await clientOwnsSupportThread(userId, thread);
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (!isStaff(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(thread);
  }

  if (!calculationId) return NextResponse.json({ error: "calculationId required" }, { status: 400 });

  const calc = await prisma.calculation.findUnique({
    where: { id: calculationId },
    select: {
      id: true,
      number: true,
      companyId: true,
      clientUserId: true,
      brokerUserId: true,
    },
  });
  if (!calc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    assertCalculationChatAccess(calc, userId, role);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const thread = await prisma.chatThread.findFirst({
    where: { calculationId, kind: "CALCULATION" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  return NextResponse.json(thread);
}

const postSchema = z.union([
  z.object({
    kind: z.literal("SUPPORT"),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(4000),
  }),
  z.object({
    kind: z.literal("SUPPORT_REPLY"),
    threadId: z.string().min(1),
    body: z.string().min(1).max(4000),
  }),
  z.object({
    kind: z.literal("SUPPORT_STATUS"),
    threadId: z.string().min(1),
    action: z.enum(["resolve", "archive", "reopen"]),
  }),
  z.object({
    kind: z.literal("CALCULATION").optional(),
    calculationId: z.string(),
    body: z.string().min(1).max(4000),
    attachmentUrl: z.string().max(2000).optional(),
  }),
]);

const SUPPORT_KINDS = new Set(["SUPPORT", "SUPPORT_REPLY", "SUPPORT_STATUS"]);

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;
  const raw = await req.json();
  // Backward-compat: posts without kind stay CALCULATION.
  const data = postSchema.parse(SUPPORT_KINDS.has(raw?.kind) ? raw : { kind: "CALCULATION", ...raw });

  const proxied = await proxyDomainApi("/v1/chat", {
    method: "POST",
    userId,
    role,
    body: SUPPORT_KINDS.has(data.kind || "") ? data : { ...data, kind: undefined },
  });
  if (proxied) return forwardDomainResponse(proxied);

  if (data.kind === "SUPPORT") {
    if (role !== "CLIENT" && !isStaff(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const result = await createSupportTicket(prisma, {
      userId,
      subject: data.subject,
      body: data.body,
    });
    try {
      await notifySupportChatMessage(prisma, {
        threadId: result.thread.id,
        subject: result.thread.subject ?? "",
        authorRole: role || "CLIENT",
        clientUserId: userId,
        bodyPreview: data.body,
        isNewTicket: true,
      });
    } catch {
      /* fail-open */
    }
    return NextResponse.json(result, { status: 201 });
  }

  if (data.kind === "SUPPORT_REPLY") {
    if (!isStaff(role) && role !== "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (role === "CLIENT") {
      const existing = await getSupportThread(prisma, data.threadId);
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const allowed = await clientOwnsSupportThread(userId, existing);
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      const result = await replySupportThread(prisma, {
        threadId: data.threadId,
        authorId: userId,
        body: data.body,
        waitingOn: role === "CLIENT" ? "BROKER" : "CLIENT",
      });
      try {
        const thread = await getSupportThread(prisma, data.threadId);
        if (thread) {
          await notifySupportChatMessage(prisma, {
            threadId: thread.id,
            subject: thread.subject ?? "",
            authorRole: role || "CLIENT",
            clientUserId: thread.createdByUserId,
            bodyPreview: data.body,
            isNewTicket: false,
          });
        }
      } catch {
        /* fail-open */
      }
      return NextResponse.json(result, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      return NextResponse.json({ error: msg }, { status: supportStatusHttpCode(msg) });
    }
  }

  if (data.kind === "SUPPORT_STATUS") {
    if (!isStaff(role) && role !== "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actorRole = isStaff(role) ? "ADMIN" : "CLIENT";
    if (actorRole === "CLIENT" && data.action === "archive") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const existing = await getSupportThread(prisma, data.threadId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (role === "CLIENT") {
      const allowed = await clientOwnsSupportThread(userId, existing);
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      const result = await setSupportTicketStatus(prisma, {
        threadId: data.threadId,
        actorUserId: userId,
        action: data.action,
        role: actorRole,
      });
      return NextResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      return NextResponse.json({ error: msg }, { status: supportStatusHttpCode(msg) });
    }
  }

  let thread = await prisma.chatThread.findFirst({
    where: { calculationId: data.calculationId, kind: "CALCULATION" },
  });
  const calcRow = await prisma.calculation.findUnique({
    where: { id: data.calculationId },
    select: {
      id: true,
      number: true,
      companyId: true,
      clientUserId: true,
      brokerUserId: true,
    },
  });
  if (!calcRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    assertCalculationChatAccess(calcRow, userId, role || "");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!thread) {
    thread = await prisma.chatThread.create({
      data: {
        kind: "CALCULATION",
        calculationId: calcRow.id,
        subject: `Чат · ${calcRow.number}`,
      },
    });
  }

  const waitingOn = role === "CLIENT" ? "BROKER" : role === "BROKER" ? "CLIENT" : null;

  const message = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      authorId: userId,
      body: data.body,
      attachmentUrl: data.attachmentUrl || null,
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  if (waitingOn) {
    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { waitingOn },
    });
  }

  try {
    await notifyCalculationChatMessage(prisma, {
      calc: calcRow,
      authorRole: role || "",
      bodyPreview: data.body,
    });
  } catch {
    /* fail-open */
  }

  return NextResponse.json({ ...message, waitingOn }, { status: 201 });
}
