import { afterEach, describe, expect, it, vi } from "vitest";

const { enqueueOutbox, kickNotifyDelivery } = vi.hoisted(() => ({
  enqueueOutbox: vi.fn().mockResolvedValue({ id: "obx-chat" }),
  kickNotifyDelivery: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../orchestration", () => ({
  enqueueOutbox,
  kickNotifyDelivery,
}));

import {
  assertCalculationChatAccess,
  notifyCalculationChatMessage,
  notifySupportChatMessage,
  type CalcChatAccess,
} from "../chat-notify";

const calc: CalcChatAccess = {
  id: "calc1",
  number: "#100",
  companyId: "co1",
  clientUserId: "client1",
  brokerUserId: "broker1",
};

function mockDb(emails: Record<string, string | null>) {
  return {
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(emails[where.id] != null ? { email: emails[where.id] } : null)
      ),
    },
  };
}

describe("assertCalculationChatAccess", () => {
  it("allows admin roles", () => {
    expect(() => assertCalculationChatAccess(calc, "any", "ADMIN")).not.toThrow();
    expect(() => assertCalculationChatAccess(calc, "any", "SUPER_ADMIN")).not.toThrow();
  });

  it("allows client owner and rejects other clients", () => {
    expect(() => assertCalculationChatAccess(calc, "client1", "CLIENT")).not.toThrow();
    expect(() => assertCalculationChatAccess(calc, "other", "CLIENT")).toThrow("Forbidden");
  });

  it("allows assigned broker and rejects other brokers", () => {
    expect(() => assertCalculationChatAccess(calc, "broker1", "BROKER")).not.toThrow();
    expect(() => assertCalculationChatAccess(calc, "other", "BROKER")).toThrow("Forbidden");
  });

  it("rejects unknown roles", () => {
    expect(() => assertCalculationChatAccess(calc, "x", "OPERATOR")).toThrow("Forbidden");
  });
});

describe("notifyCalculationChatMessage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fail-open when counterparty has no email", async () => {
    const db = mockDb({ broker1: null });
    await notifyCalculationChatMessage(db as never, {
      calc,
      authorRole: "CLIENT",
      bodyPreview: "hello",
    });
    expect(enqueueOutbox).not.toHaveBeenCalled();
    expect(kickNotifyDelivery).not.toHaveBeenCalled();
  });

  it("enqueues chat.message when broker replies to client", async () => {
    const db = mockDb({ client1: "client@example.com" });
    await notifyCalculationChatMessage(db as never, {
      calc,
      authorRole: "BROKER",
      bodyPreview: "reply text",
    });
    expect(enqueueOutbox).toHaveBeenCalledWith(db, {
      template: "chat.message",
      to: "client@example.com",
      payload: {
        calculationId: "calc1",
        number: "#100",
        preview: "reply text",
      },
      calculationId: "calc1",
      companyId: "co1",
    });
    expect(kickNotifyDelivery).toHaveBeenCalledWith({
      template: "chat.message",
      to: "client@example.com",
      payload: {
        calculationId: "calc1",
        number: "#100",
        preview: "reply text",
      },
      outboxId: "obx-chat",
    });
  });
});

describe("notifySupportChatMessage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NOTIFY_OPS_EMAIL;
  });

  it("uses NOTIFY_OPS_EMAIL for new client ticket", async () => {
    process.env.NOTIFY_OPS_EMAIL = "ops@example.com";
    const db = mockDb({});
    await notifySupportChatMessage(db as never, {
      threadId: "t1",
      subject: "Help",
      authorRole: "CLIENT",
      clientUserId: "client1",
      bodyPreview: "need help",
      isNewTicket: true,
    });
    expect(enqueueOutbox).toHaveBeenCalledWith(db, {
      template: "chat.support_new",
      to: "ops@example.com",
      payload: {
        threadId: "t1",
        subject: "Help",
        preview: "need help",
      },
    });
  });

  it("fail-open when staff reply and client email missing", async () => {
    const db = mockDb({ client1: null });
    await notifySupportChatMessage(db as never, {
      threadId: "t1",
      subject: "Help",
      authorRole: "ADMIN",
      clientUserId: "client1",
      bodyPreview: "we reply",
    });
    expect(enqueueOutbox).not.toHaveBeenCalled();
  });

  it("notifies client on staff reply", async () => {
    const db = mockDb({ client1: "client@example.com" });
    await notifySupportChatMessage(db as never, {
      threadId: "t1",
      subject: "Help",
      authorRole: "ADMIN",
      clientUserId: "client1",
      bodyPreview: "we reply",
    });
    expect(enqueueOutbox).toHaveBeenCalledWith(db, {
      template: "chat.support_reply",
      to: "client@example.com",
      payload: {
        threadId: "t1",
        subject: "Help",
        preview: "we reply",
      },
    });
  });
});
