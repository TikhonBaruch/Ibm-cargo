import { prisma } from "@/lib/prisma";
import { getPlatformSettings } from "./settings";

/** Block client create/pay when platform maintenance is on (admins still operate). */
export async function assertNotInMaintenance(actorRole?: string) {
  if (actorRole === "ADMIN" || actorRole === "SUPER_ADMIN") return;
  const settings = await getPlatformSettings();
  if (settings.maintenanceMode) {
    throw new Error("Platform is in maintenance mode");
  }
}

/** Block topup / tariff charge when admin disabled payments. */
export async function assertPaymentsEnabled() {
  const settings = await getPlatformSettings();
  if (settings.paymentsEnabled === false) {
    throw new Error("Payments are temporarily disabled by platform admin");
  }
}

/** Whether mock ledger topup is allowed: SiteSetting AND env/runtime gate. */
export async function isMockTopupAllowedBySettings(): Promise<boolean> {
  const settings = await getPlatformSettings();
  if (settings.mockTopupAllowed === false) return false;
  const flag = (process.env.ALLOW_MOCK_TOPUP || "").toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if ((process.env.DEMO_MODE || "").toLowerCase() === "1") return true;
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return false;
  }
  return true;
}

/** Queue list is hidden when the broker paused accepting jobs (`acceptingJobs === false`). */
export function isBrokerQueueVisible(acceptingJobs: boolean | null | undefined): boolean {
  return acceptingJobs !== false;
}

/** Brokers who paused jobs cannot claim from queue. */
export async function assertBrokerAcceptingJobs(brokerUserId: string, actorRole?: string) {
  if (actorRole === "ADMIN" || actorRole === "SUPER_ADMIN") return;
  const profile = await prisma.brokerProfile.findUnique({
    where: { userId: brokerUserId },
    select: { acceptingJobs: true },
  });
  if (profile && profile.acceptingJobs === false) {
    throw new Error("Broker is not accepting jobs");
  }
}

export type BrokersListFilter =
  | { empty: true }
  | { empty: false; where: { moderationStatus: "APPROVED"; acceptingJobs: true } };

/** Client marketplace listing filters. Admins use `all=1` bypass. */
export async function resolveBrokersListFilter(opts: {
  all: boolean;
  role: string;
}): Promise<BrokersListFilter | { empty: false; where: undefined }> {
  if (opts.all) return { empty: false, where: undefined };
  const settings = await getPlatformSettings();
  if (!settings.marketplaceEnabled && opts.role === "CLIENT") {
    return { empty: true };
  }
  return {
    empty: false,
    where: { moderationStatus: "APPROVED", acceptingJobs: true },
  };
}
