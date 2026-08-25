/**
 * Manufacturer directory + proposals (client/broker propose, ADMIN approve).
 * Permanent Company(kind=MANUFACTURER) only after approve — see plan-manufacturer-proposals.md.
 */
import { z } from "zod";
import type { PrismaClient, UserRole } from "@prisma/client";

export const MANUFACTURER_PROPOSAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ManufacturerProposalStatus = (typeof MANUFACTURER_PROPOSAL_STATUSES)[number];

const PROPOSER_ROLES = ["CLIENT", "BROKER"] as const;

function httpStatus(message: string, status: number) {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export const createManufacturerProposalSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    country: z.string().trim().max(80).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const rejectManufacturerProposalSchema = z
  .object({
    reason: z.string().trim().min(2).max(400).optional(),
  })
  .strict();

export type ManufacturerDirectoryHint = {
  id: string;
  name: string;
  kind: "approved" | "pending";
  country?: string | null;
  companyId?: string | null;
  proposalId?: string | null;
};

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export async function listManufacturerDirectory(
  prisma: PrismaClient,
  opts: { userId: string; q?: string; limit?: number }
): Promise<ManufacturerDirectoryHint[]> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const q = (opts.q || "").trim();
  const whereName = q
    ? { name: { contains: q, mode: "insensitive" as const } }
    : {};

  const [companies, ownPending] = await Promise.all([
    prisma.company.findMany({
      where: { kind: "MANUFACTURER", ...whereName },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: limit,
    }),
    prisma.manufacturerProposal.findMany({
      where: {
        proposedByUserId: opts.userId,
        status: "PENDING",
        ...whereName,
      },
      select: { id: true, name: true, country: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const approved: ManufacturerDirectoryHint[] = companies.map((c) => ({
    id: `co:${c.id}`,
    name: c.name,
    kind: "approved" as const,
    companyId: c.id,
  }));

  const pending: ManufacturerDirectoryHint[] = ownPending.map((p) => ({
    id: `pr:${p.id}`,
    name: p.name,
    kind: "pending" as const,
    country: p.country,
    proposalId: p.id,
  }));

  const seen = new Set<string>();
  const out: ManufacturerDirectoryHint[] = [];
  for (const row of [...pending, ...approved]) {
    const key = row.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export async function createManufacturerProposal(
  prisma: PrismaClient,
  opts: {
    userId: string;
    role: string;
    raw: unknown;
  }
) {
  if (!PROPOSER_ROLES.includes(opts.role as (typeof PROPOSER_ROLES)[number])) {
    throw httpStatus("Only CLIENT or BROKER can propose manufacturers", 403);
  }
  const parsed = createManufacturerProposalSchema.safeParse(opts.raw);
  if (!parsed.success) throw httpStatus(parsed.error.issues[0]?.message || "Invalid body", 400);

  const name = normalizeName(parsed.data.name);

  const existingCompany = await prisma.company.findFirst({
    where: { kind: "MANUFACTURER", name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existingCompany) {
    throw httpStatus(
      `Производитель «${existingCompany.name}» уже в постоянном каталоге`,
      409
    );
  }

  const dupPending = await prisma.manufacturerProposal.findFirst({
    where: {
      proposedByUserId: opts.userId,
      status: "PENDING",
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (dupPending) {
    return {
      id: dupPending.id,
      name: dupPending.name,
      country: dupPending.country,
      note: dupPending.note,
      status: dupPending.status,
      sourceRole: dupPending.sourceRole,
      createdAt: dupPending.createdAt,
      duplicate: true as const,
    };
  }

  const row = await prisma.manufacturerProposal.create({
    data: {
      name,
      country: parsed.data.country?.trim() || null,
      note: parsed.data.note?.trim() || null,
      sourceRole: opts.role as UserRole,
      proposedByUserId: opts.userId,
    },
  });

  return {
    id: row.id,
    name: row.name,
    country: row.country,
    note: row.note,
    status: row.status,
    sourceRole: row.sourceRole,
    createdAt: row.createdAt,
    duplicate: false as const,
  };
}

export async function listManufacturerProposalsForAdmin(
  prisma: PrismaClient,
  opts: { status?: string; q?: string; limit?: number }
) {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  const status = opts.status && opts.status !== "all" ? opts.status : undefined;
  if (status && !MANUFACTURER_PROPOSAL_STATUSES.includes(status as ManufacturerProposalStatus)) {
    throw httpStatus("Invalid status filter", 400);
  }
  const q = (opts.q || "").trim();

  const rows = await prisma.manufacturerProposal.findMany({
    where: {
      ...(status ? { status: status as ManufacturerProposalStatus } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    include: {
      proposedByUser: { select: { id: true, name: true, email: true, role: true } },
      reviewedByUser: { select: { id: true, name: true } },
      approvedCompany: { select: { id: true, name: true, kind: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit,
  });

  return rows;
}

export async function listApprovedManufacturerCompanies(
  prisma: PrismaClient,
  opts?: { q?: string; limit?: number }
) {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 200);
  const q = (opts?.q || "").trim();
  return prisma.company.findMany({
    where: {
      kind: "MANUFACTURER",
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    select: {
      id: true,
      name: true,
      inn: true,
      contactEmail: true,
      contactPhone: true,
      createdAt: true,
      _count: { select: { manufacturerSkus: true, users: true } },
    },
    orderBy: { name: "asc" },
    take: limit,
  });
}

export async function approveManufacturerProposal(
  prisma: PrismaClient,
  opts: { proposalId: string; actorUserId: string }
) {
  const proposal = await prisma.manufacturerProposal.findUnique({
    where: { id: opts.proposalId },
  });
  if (!proposal) throw httpStatus("Proposal not found", 404);
  if (proposal.status === "APPROVED" && proposal.approvedCompanyId) {
    const company = await prisma.company.findUnique({
      where: { id: proposal.approvedCompanyId },
      select: { id: true, name: true, kind: true },
    });
    return { proposal, company };
  }
  if (proposal.status !== "PENDING") {
    throw httpStatus("Only PENDING proposals can be approved", 409);
  }

  const name = normalizeName(proposal.name);
  let company = await prisma.company.findFirst({
    where: { kind: "MANUFACTURER", name: { equals: name, mode: "insensitive" } },
  });

  const result = await prisma.$transaction(async (tx) => {
    if (!company) {
      company = await tx.company.create({
        data: {
          name,
          kind: "MANUFACTURER",
          contactPhone: null,
          contactEmail: null,
        },
      });
    }
    const updated = await tx.manufacturerProposal.update({
      where: { id: proposal.id },
      data: {
        status: "APPROVED",
        approvedCompanyId: company!.id,
        reviewedByUserId: opts.actorUserId,
        reviewedAt: new Date(),
        rejectReason: null,
      },
      include: {
        proposedByUser: { select: { id: true, name: true, email: true, role: true } },
        approvedCompany: { select: { id: true, name: true, kind: true } },
      },
    });
    return { proposal: updated, company };
  });

  return result;
}

export async function rejectManufacturerProposal(
  prisma: PrismaClient,
  opts: { proposalId: string; actorUserId: string; raw?: unknown }
) {
  const parsed = rejectManufacturerProposalSchema.safeParse(opts.raw ?? {});
  if (!parsed.success) throw httpStatus(parsed.error.issues[0]?.message || "Invalid body", 400);

  const proposal = await prisma.manufacturerProposal.findUnique({
    where: { id: opts.proposalId },
  });
  if (!proposal) throw httpStatus("Proposal not found", 404);
  if (proposal.status !== "PENDING") {
    throw httpStatus("Only PENDING proposals can be rejected", 409);
  }

  return prisma.manufacturerProposal.update({
    where: { id: proposal.id },
    data: {
      status: "REJECTED",
      reviewedByUserId: opts.actorUserId,
      reviewedAt: new Date(),
      rejectReason: parsed.data.reason?.trim() || null,
    },
    include: {
      proposedByUser: { select: { id: true, name: true, email: true, role: true } },
      reviewedByUser: { select: { id: true, name: true } },
    },
  });
}
