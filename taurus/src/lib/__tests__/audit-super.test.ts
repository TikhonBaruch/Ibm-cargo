import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { logAction } from "../audit";

describe("audit hide SUPER_ADMIN", () => {
  it("does not write when userRole is SUPER_ADMIN", async () => {
    await logAction({
      action: "LOGIN",
      entity: "auth",
      userRole: "SUPER_ADMIN",
      userId: "x",
      userName: "hidden",
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("writes for ADMIN", async () => {
    await logAction({
      action: "UPDATE",
      entity: "platform_settings",
      userRole: "ADMIN",
      userId: "a",
      userName: "Admin",
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
