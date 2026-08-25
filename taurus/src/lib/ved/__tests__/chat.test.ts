import { describe, expect, it, vi } from "vitest";
import {
  countBrokerUnread,
  countAdminUnread,
  countClientUnread,
  createSupportTicket,
  listAdminSupportThreads,
  listBrokerChatThreads,
  listClientSupportThreads,
  replySupportThread,
  setSupportTicketStatus,
} from "../chat";
import {
  allowedSupportActions,
  nextSupportTicketPatch,
  supportTicketStatusWhere,
  ticketStatusLabel,
} from "../support-ticket";

describe("listBrokerChatThreads", () => {
  it("filters threads by broker assignment and active statuses", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await listBrokerChatThreads({ chatThread: { findMany } } as never, "broker-1");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          kind: "CALCULATION",
          calculation: {
            brokerUserId: "broker-1",
            status: { in: ["IN_REVIEW", "DONE", "SLA_RISK"] },
          },
        },
      })
    );
  });
});

describe("countBrokerUnread", () => {
  it("counts CALCULATION threads waiting on BROKER for assignee", async () => {
    const count = vi.fn().mockResolvedValue(2);
    const n = await countBrokerUnread({ chatThread: { count } } as never, "broker-1");
    expect(n).toBe(2);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          kind: "CALCULATION",
          waitingOn: "BROKER",
          calculation: {
            brokerUserId: "broker-1",
            status: { in: ["IN_REVIEW", "DONE", "SLA_RISK"] },
          },
        },
      })
    );
  });
});

describe("countAdminUnread", () => {
  it("counts OPEN SUPPORT threads waiting on staff", async () => {
    const count = vi.fn().mockResolvedValue(3);
    const n = await countAdminUnread({ chatThread: { count } } as never);
    expect(n).toBe(3);
    expect(count).toHaveBeenCalledWith({
      where: { kind: "SUPPORT", waitingOn: "BROKER", ticketStatus: "OPEN" },
    });
  });
});

describe("countClientUnread", () => {
  it("counts CALC + active SUPPORT waiting on CLIENT", async () => {
    const count = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const n = await countClientUnread(
      { chatThread: { count } } as never,
      { clientUserId: "client-1", companyId: "co-1" }
    );
    expect(n).toBe(3);
    expect(count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          kind: "SUPPORT",
          waitingOn: "CLIENT",
          ticketStatus: { in: ["OPEN", "WAITING_CLIENT"] },
        }),
      })
    );
  });
});

describe("listClientSupportThreads", () => {
  it("filters SUPPORT by owner and active box by default", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await listClientSupportThreads(
      { chatThread: { findMany } } as never,
      { clientUserId: "client-1", companyId: "co-1" }
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          kind: "SUPPORT",
          OR: [
            { createdByUserId: "client-1" },
            { companyId: "co-1" },
            { messages: { some: { authorId: "client-1" } } },
          ],
          ticketStatus: { in: ["OPEN", "WAITING_CLIENT"] },
        },
      })
    );
  });

  it("lists archive box as RESOLVED + ARCHIVED", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await listClientSupportThreads(
      { chatThread: { findMany } } as never,
      { clientUserId: "client-1", box: "archive" }
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ticketStatus: { in: ["RESOLVED", "ARCHIVED"] },
        }),
      })
    );
  });
});

describe("listAdminSupportThreads", () => {
  it("lists all SUPPORT when box omitted", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await listAdminSupportThreads({ chatThread: { findMany } } as never);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { kind: "SUPPORT" },
      })
    );
  });

  it("filters admin open box", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await listAdminSupportThreads({ chatThread: { findMany } } as never, { box: "open" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { kind: "SUPPORT", ticketStatus: "OPEN" },
      })
    );
  });
});

describe("createSupportTicket", () => {
  it("creates SUPPORT thread with company + creator ownership", async () => {
    const createThread = vi.fn().mockResolvedValue({
      id: "t1",
      kind: "SUPPORT",
      subject: "Help",
      companyId: "co-1",
      createdByUserId: "client-1",
    });
    const createMessage = vi.fn().mockResolvedValue({
      id: "m1",
      body: "Need help",
      author: { id: "client-1", name: "Client", role: "CLIENT" },
    });
    const findUser = vi.fn().mockResolvedValue({ companyId: "co-1" });
    const tx = {
      user: { findUnique: findUser },
      chatThread: { create: createThread },
      chatMessage: { create: createMessage },
    };
    const result = await createSupportTicket(
      { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } as never,
      { userId: "client-1", subject: "Help", body: "Need help" }
    );
    expect(createThread).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "SUPPORT",
          subject: "Help",
          waitingOn: "BROKER",
          ticketStatus: "OPEN",
          companyId: "co-1",
          createdByUserId: "client-1",
        }),
      })
    );
    expect(result.waitingOn).toBe("BROKER");
    expect(result.ticketStatus).toBe("OPEN");
  });
});

describe("replySupportThread", () => {
  it("rejects replies on RESOLVED tickets", async () => {
    await expect(
      replySupportThread(
        {
          chatThread: {
            findFirst: vi.fn().mockResolvedValue({ id: "t1", kind: "SUPPORT", ticketStatus: "RESOLVED" }),
          },
        } as never,
        { threadId: "t1", authorId: "u1", body: "hi", waitingOn: "BROKER" }
      )
    ).rejects.toThrow("Ticket is closed");
  });

  it("staff reply sets WAITING_CLIENT", async () => {
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({ id: "m1", body: "ok", author: { role: "ADMIN" } });
    await replySupportThread(
      {
        chatThread: {
          findFirst: vi.fn().mockResolvedValue({ id: "t1", kind: "SUPPORT", ticketStatus: "OPEN" }),
          update,
        },
        chatMessage: { create },
      } as never,
      { threadId: "t1", authorId: "admin-1", body: "ok", waitingOn: "CLIENT" }
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { ticketStatus: "WAITING_CLIENT", waitingOn: "CLIENT" },
      })
    );
  });
});

describe("setSupportTicketStatus", () => {
  it("writes system message and RESOLVED on close", async () => {
    const create = vi.fn().mockResolvedValue({});
    const update = vi.fn().mockResolvedValue({ id: "t1", ticketStatus: "RESOLVED" });
    const tx = { chatMessage: { create }, chatThread: { update } };
    await setSupportTicketStatus(
      {
        chatThread: {
          findFirst: vi.fn().mockResolvedValue({ id: "t1", kind: "SUPPORT", ticketStatus: "OPEN" }),
        },
        $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      } as never,
      { threadId: "t1", actorUserId: "u1", action: "resolve", role: "CLIENT" }
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ body: "Обращение закрыто", isSystem: true }),
      })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ticketStatus: "RESOLVED", waitingOn: null }),
      })
    );
  });

  it("rejects client archive", async () => {
    await expect(
      setSupportTicketStatus(
        {
          chatThread: {
            findFirst: vi.fn().mockResolvedValue({ id: "t1", kind: "SUPPORT", ticketStatus: "OPEN" }),
          },
        } as never,
        { threadId: "t1", actorUserId: "u1", action: "archive", role: "CLIENT" }
      )
    ).rejects.toThrow("Ticket action not allowed");
  });
});

describe("support-ticket helpers", () => {
  it("maps boxes and labels", () => {
    expect(supportTicketStatusWhere("open")).toEqual({ ticketStatus: "OPEN" });
    expect(supportTicketStatusWhere("archive")).toEqual({
      ticketStatus: { in: ["RESOLVED", "ARCHIVED"] },
    });
    expect(ticketStatusLabel("OPEN", "admin")).toBe("Нужен ответ");
    expect(ticketStatusLabel("WAITING_CLIENT", "client")).toBe("Ваш ход");
    expect(allowedSupportActions("OPEN", "CLIENT")).toEqual(["resolve"]);
    expect(allowedSupportActions("OPEN", "ADMIN")).toEqual(["resolve", "archive"]);
  });

  it("reopen clears archive timestamps", () => {
    const patch = nextSupportTicketPatch("ARCHIVED", "reopen");
    expect(patch.ticketStatus).toBe("OPEN");
    expect(patch.waitingOn).toBe("BROKER");
    expect(patch.resolvedAt).toBeNull();
    expect(patch.archivedAt).toBeNull();
  });
});
