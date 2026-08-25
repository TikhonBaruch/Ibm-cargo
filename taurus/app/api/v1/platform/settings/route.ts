import { NextRequest, NextResponse } from "next/server";
import { requireRole, ADMIN_ROLES } from "@/lib/require-role";
import { getPlatformSettings, setPlatformSetting } from "@/lib/ved/settings";
import { PLATFORM_SETTING_KEYS } from "@/lib/ved/domain";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { logUpdate } from "@/lib/audit";
import { z } from "zod";

export async function GET() {
  const { session, error } = await requireRole([...ADMIN_ROLES, "BROKER", "CLIENT"]);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string };
  const proxied = await proxyDomainApi("/v1/platform/settings", {
    method: "GET",
    userId: user.id || "anonymous",
    role: user.role,
  });
  if (proxied) return forwardDomainResponse(proxied);
  return NextResponse.json(await getPlatformSettings());
}

const schema = z.object({
  confidenceThreshold: z.number().min(0.5).max(0.95).optional(),
  defaultSlaHours: z.number().int().positive().optional(),
  preferredClaimHours: z.number().int().positive().optional(),
  usdRate: z.number().positive().optional(),
  cnyRate: z.number().positive().optional(),
  eurRate: z.number().positive().optional(),
  fxBufferPct: z.number().min(0).max(10).optional(),
  marketplaceEnabled: z.boolean().optional(),
  autoAssignBrokers: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  paymentsEnabled: z.boolean().optional(),
  llmEnrichEnabled: z.boolean().optional(),
  notifyEnabled: z.boolean().optional(),
  mockTopupAllowed: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const body = schema.parse(await req.json());
  const user = session!.user as { id?: string; role?: string };

  const proxied = await proxyDomainApi("/v1/platform/settings", {
    method: "PATCH",
    userId: user.id!,
    role: user.role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  if (body.confidenceThreshold != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.confidenceThreshold, body.confidenceThreshold);
  }
  if (body.defaultSlaHours != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.defaultSlaHours, body.defaultSlaHours);
  }
  if (body.preferredClaimHours != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.preferredClaimHours, body.preferredClaimHours);
  }
  if (body.usdRate != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.usdRate, body.usdRate);
  }
  if (body.cnyRate != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.cnyRate, body.cnyRate);
  }
  if (body.eurRate != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.eurRate, body.eurRate);
  }
  if (body.fxBufferPct != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.fxBufferPct, body.fxBufferPct);
  }
  if (body.marketplaceEnabled != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.marketplaceEnabled, body.marketplaceEnabled);
  }
  if (body.autoAssignBrokers != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.autoAssignBrokers, body.autoAssignBrokers);
  }
  if (body.maintenanceMode != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.maintenanceMode, body.maintenanceMode);
  }
  if (body.paymentsEnabled != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.paymentsEnabled, body.paymentsEnabled);
  }
  if (body.llmEnrichEnabled != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.llmEnrichEnabled, body.llmEnrichEnabled);
  }
  if (body.notifyEnabled != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.notifyEnabled, body.notifyEnabled);
  }
  if (body.mockTopupAllowed != null) {
    await setPlatformSetting(PLATFORM_SETTING_KEYS.mockTopupAllowed, body.mockTopupAllowed);
  }

  const actor = session!.user as { id?: string; name?: string | null; role?: string };
  await logUpdate(
    "platform_settings",
    "ved",
    actor.id || "unknown",
    actor.name || actor.id || "admin",
    actor.role || "ADMIN",
    JSON.stringify(body)
  );

  return NextResponse.json(await getPlatformSettings());
}
