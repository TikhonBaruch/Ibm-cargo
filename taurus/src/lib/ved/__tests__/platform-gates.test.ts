import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brokerProfile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ved/settings", () => ({
  getPlatformSettings: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getPlatformSettings } from "@/lib/ved/settings";
import {
  assertBrokerAcceptingJobs,
  assertNotInMaintenance,
  assertPaymentsEnabled,
  isMockTopupAllowedBySettings,
  isBrokerQueueVisible,
  resolveBrokersListFilter,
} from "../platform-gates";

describe("platform-gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks create/pay in maintenance for clients", async () => {
    vi.mocked(getPlatformSettings).mockResolvedValue({
      maintenanceMode: true,
    } as Awaited<ReturnType<typeof getPlatformSettings>>);
    await expect(assertNotInMaintenance("CLIENT")).rejects.toThrow(/maintenance/i);
    await expect(assertNotInMaintenance("ADMIN")).resolves.toBeUndefined();
  });

  it("hides broker queue when acceptingJobs is false", () => {
    expect(isBrokerQueueVisible(false)).toBe(false);
    expect(isBrokerQueueVisible(true)).toBe(true);
    expect(isBrokerQueueVisible(undefined)).toBe(true);
    expect(isBrokerQueueVisible(null)).toBe(true);
  });

  it("blocks claim when broker paused acceptingJobs", async () => {
    vi.mocked(prisma.brokerProfile.findUnique).mockResolvedValue({
      acceptingJobs: false,
    } as never);
    await expect(assertBrokerAcceptingJobs("broker_1", "BROKER")).rejects.toThrow(
      /not accepting/i
    );
    await expect(assertBrokerAcceptingJobs("broker_1", "ADMIN")).resolves.toBeUndefined();
  });

  it("hides marketplace brokers for clients when disabled", async () => {
    vi.mocked(getPlatformSettings).mockResolvedValue({
      marketplaceEnabled: false,
    } as Awaited<ReturnType<typeof getPlatformSettings>>);
    await expect(
      resolveBrokersListFilter({ all: false, role: "CLIENT" })
    ).resolves.toEqual({ empty: true });
  });

  it("lists approved accepting brokers for client marketplace", async () => {
    vi.mocked(getPlatformSettings).mockResolvedValue({
      marketplaceEnabled: true,
    } as Awaited<ReturnType<typeof getPlatformSettings>>);
    await expect(
      resolveBrokersListFilter({ all: false, role: "CLIENT" })
    ).resolves.toEqual({
      empty: false,
      where: { moderationStatus: "APPROVED", acceptingJobs: true },
    });
  });

  it("blocks payments when paymentsEnabled is false", async () => {
    vi.mocked(getPlatformSettings).mockResolvedValue({
      paymentsEnabled: false,
    } as Awaited<ReturnType<typeof getPlatformSettings>>);
    await expect(assertPaymentsEnabled()).rejects.toThrow(/Payments are temporarily disabled/i);
  });

  it("mock topup requires setting and env", async () => {
    vi.mocked(getPlatformSettings).mockResolvedValue({
      mockTopupAllowed: false,
    } as Awaited<ReturnType<typeof getPlatformSettings>>);
    await expect(isMockTopupAllowedBySettings()).resolves.toBe(false);
  });
});
