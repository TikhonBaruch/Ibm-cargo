import { prisma } from "@/lib/prisma";
import { PLATFORM_SETTING_KEYS } from "./domain";

export async function getPlatformSettings() {
  const keys = Object.values(PLATFORM_SETTING_KEYS);
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: [...keys] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const num = (key: string, fallback: number) => {
    const v = map[key];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
    if (v && typeof v === "object" && "value" in (v as object)) {
      const inner = (v as { value: unknown }).value;
      if (typeof inner === "number") return inner;
    }
    return fallback;
  };
  const bool = (key: string, fallback: boolean) => {
    const v = map[key];
    if (typeof v === "boolean") return v;
    return fallback;
  };

  const defaultSlaHours = num(PLATFORM_SETTING_KEYS.defaultSlaHours, 4);
  return {
    confidenceThreshold: num(PLATFORM_SETTING_KEYS.confidenceThreshold, 0.75),
    defaultSlaHours,
    /** Falls back to default SLA hours when unset (Phase 2 preferred timeout). */
    preferredClaimHours: num(PLATFORM_SETTING_KEYS.preferredClaimHours, defaultSlaHours),
    usdRate: num(PLATFORM_SETTING_KEYS.usdRate, 90),
    cnyRate: num(PLATFORM_SETTING_KEYS.cnyRate, 12.5),
    eurRate: num(PLATFORM_SETTING_KEYS.eurRate, 98),
    fxBufferPct: num(PLATFORM_SETTING_KEYS.fxBufferPct, 2),
    marketplaceEnabled: bool(PLATFORM_SETTING_KEYS.marketplaceEnabled, true),
    autoAssignBrokers: bool(PLATFORM_SETTING_KEYS.autoAssignBrokers, true),
    maintenanceMode: bool(PLATFORM_SETTING_KEYS.maintenanceMode, false),
    paymentsEnabled: bool(PLATFORM_SETTING_KEYS.paymentsEnabled, true),
    llmEnrichEnabled: bool(PLATFORM_SETTING_KEYS.llmEnrichEnabled, true),
    notifyEnabled: bool(PLATFORM_SETTING_KEYS.notifyEnabled, true),
    mockTopupAllowed: bool(PLATFORM_SETTING_KEYS.mockTopupAllowed, true),
  };
}

export async function setPlatformSetting(key: string, value: unknown) {
  return prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}
