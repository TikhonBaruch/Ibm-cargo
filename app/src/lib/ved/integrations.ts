import { prisma } from "@/lib/prisma";
import { getPlatformSettings } from "@/lib/ved/settings";
import { getOrchestrationHealth } from "@/lib/ved/orch-health";

function maskServiceUrl(raw: string | undefined): string | null {
  const u = (raw || "").trim();
  if (!u) return null;
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return "(configured)";
  }
}

export async function getIntegrationsSnapshot() {
  const settings = await getPlatformSettings();
  const health = await getOrchestrationHealth(prisma, { windowMinutes: 60 });

  const recent = await prisma.serviceCall.findMany({
    where: { service: { in: ["payments", "llm", "notify"] } },
    orderBy: { createdAt: "desc" },
    take: 36,
    select: {
      id: true,
      service: true,
      operation: true,
      status: true,
      durationMs: true,
      error: true,
      createdAt: true,
      finishedAt: true,
      requestMeta: true,
      responseMeta: true,
    },
  });

  const sanitize = (row: (typeof recent)[number]) => ({
    id: row.id,
    service: row.service,
    operation: row.operation,
    status: row.status,
    durationMs: row.durationMs,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    requestMeta: row.requestMeta
      ? {
          keys: Object.keys(row.requestMeta as object).slice(0, 12),
        }
      : null,
    responseMeta: row.responseMeta
      ? {
          keys: Object.keys(row.responseMeta as object).slice(0, 12),
        }
      : null,
  });

  const dep = (name: string) => health.deps.find((d) => d.service === name) || null;

  return {
    toggles: {
      paymentsEnabled: settings.paymentsEnabled,
      llmEnrichEnabled: settings.llmEnrichEnabled,
      notifyEnabled: settings.notifyEnabled,
      mockTopupAllowed: settings.mockTopupAllowed,
      marketplaceEnabled: settings.marketplaceEnabled,
      autoAssignBrokers: settings.autoAssignBrokers,
      maintenanceMode: settings.maintenanceMode,
    },
    payments: {
      host: maskServiceUrl(process.env.PAYMENTS_SERVICE_URL),
      configured: Boolean((process.env.PAYMENTS_SERVICE_URL || "").trim()),
      health: dep("payments"),
      recent: recent.filter((r) => r.service === "payments").map(sanitize),
    },
    llm: {
      host: maskServiceUrl(process.env.LLM_SERVICE_URL),
      configured: Boolean((process.env.LLM_SERVICE_URL || "").trim()),
      health: dep("llm"),
      recent: recent.filter((r) => r.service === "llm").map(sanitize),
    },
    notify: {
      host: maskServiceUrl(process.env.NOTIFY_SERVICE_URL),
      configured: Boolean((process.env.NOTIFY_SERVICE_URL || "").trim()),
      health: dep("notify"),
      recent: recent.filter((r) => r.service === "notify").map(sanitize),
    },
  };
}
