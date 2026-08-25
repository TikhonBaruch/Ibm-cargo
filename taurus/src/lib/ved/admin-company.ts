/**
 * Admin company detail + profile PATCH + balance ADJUSTMENT (D28 ops).
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { creditCompany } from "@/lib/ved/ledger";
import { CLIENT_SEGMENTS } from "@/lib/ved/sku-order";

export const adminCompanyPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    inn: z.string().trim().max(20).optional(),
    kpp: z.string().trim().max(20).optional(),
    legalAddress: z.string().trim().max(400).optional(),
    contactEmail: z.string().email().optional().or(z.literal("")),
    contactPhone: z.string().trim().max(40).optional(),
    clientSegment: z.enum(CLIENT_SEGMENTS).optional(),
  })
  .strict();

export type AdminCompanyPatch = z.infer<typeof adminCompanyPatchSchema>;

export type ManufacturerAdminStats = {
  skuTotal: number;
  skuPublished: number;
  skuDraft: number;
  requestsSubmitted: number;
  poolsOpen: number;
};

function httpStatus(message: string, status: number) {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export async function manufacturerStatsForAdmin(
  companyId: string
): Promise<ManufacturerAdminStats> {
  const [skuTotal, skuPublished, skuDraft, requestsSubmitted, poolsOpen] = await Promise.all([
    prisma.manufacturerSku.count({ where: { companyId } }),
    prisma.manufacturerSku.count({ where: { companyId, status: "PUBLISHED" } }),
    prisma.manufacturerSku.count({ where: { companyId, status: "DRAFT" } }),
    prisma.skuOrderRequest.count({
      where: { manufacturerSku: { companyId }, status: "SUBMITTED" },
    }),
    prisma.skuOrderPool.count({ where: { manufacturerCompanyId: companyId, status: "OPEN" } }),
  ]);
  return { skuTotal, skuPublished, skuDraft, requestsSubmitted, poolsOpen };
}

export async function getCompanyForAdmin(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      ledger: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          kind: true,
          amountRub: true,
          balanceAfter: true,
          description: true,
          calculationId: true,
          createdAt: true,
        },
      },
      calculations: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          confidence: true,
          createdAt: true,
        },
      },
      _count: { select: { calculations: true } },
    },
  });
  if (!company) return null;
  const { ledger, ...rest } = company;
  const manufacturerStats =
    company.kind === "MANUFACTURER" ? await manufacturerStatsForAdmin(companyId) : null;
  return { ...rest, ledgerEntries: ledger, manufacturerStats };
}

export async function patchCompanyForAdmin(opts: {
  companyId: string;
  raw: unknown;
  actorUserId: string;
  actorName?: string | null;
  actorRole?: string;
}) {
  const input = adminCompanyPatchSchema.parse(opts.raw);
  const keys = Object.keys(input) as (keyof AdminCompanyPatch)[];
  if (keys.length === 0) {
    throw httpStatus("No fields to update", 400);
  }

  const existing = await prisma.company.findUnique({ where: { id: opts.companyId } });
  if (!existing) throw httpStatus("Not found", 404);

  if (input.clientSegment !== undefined && existing.kind === "MANUFACTURER") {
    throw httpStatus("clientSegment only for CLIENT companies", 400);
  }

  const data: Record<string, string | null | undefined> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.inn !== undefined) data.inn = input.inn || null;
  if (input.kpp !== undefined) data.kpp = input.kpp || null;
  if (input.legalAddress !== undefined) data.legalAddress = input.legalAddress || null;
  if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail || null;
  if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone || null;
  if (input.clientSegment !== undefined) data.clientSegment = input.clientSegment;

  const updated = await prisma.company.update({
    where: { id: opts.companyId },
    data,
  });

  // Lazy import avoids circular deps in unit tests that mock ledger only.
  const { logAction } = await import("@/lib/audit");
  await logAction({
    action: "UPDATE",
    entity: "company",
    entityId: updated.id,
    userId: opts.actorUserId,
    userName: opts.actorName || undefined,
    userRole: opts.actorRole,
    details: `Admin company patch: ${keys.join(",")}${
      input.clientSegment ? ` → ${input.clientSegment}` : ""
    }`,
  });

  return getCompanyForAdmin(updated.id);
}

export async function adjustCompanyBalance(opts: {
  companyId: string;
  amountRub: number;
  reason: string;
  actorUserId: string;
}) {
  const amount = Math.trunc(opts.amountRub);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error("amountRub must be a non-zero integer");
  }
  const reason = opts.reason.trim();
  if (reason.length < 3) {
    throw new Error("reason required (min 3 chars)");
  }
  return creditCompany({
    companyId: opts.companyId,
    amountRub: amount,
    kind: "ADJUSTMENT",
    description: `Admin adjust: ${reason}`,
    createdById: opts.actorUserId,
  });
}
