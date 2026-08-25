/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  companyFindMany: vi.fn(),
  companyFindFirst: vi.fn(),
  companyCreate: vi.fn(),
  proposalFindMany: vi.fn(),
  proposalFindFirst: vi.fn(),
  proposalFindUnique: vi.fn(),
  proposalCreate: vi.fn(),
  proposalUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import {
  approveManufacturerProposal,
  createManufacturerProposal,
  listManufacturerDirectory,
} from "../manufacturer-directory";

function prismaStub() {
  return {
    company: {
      findMany: mock.companyFindMany,
      findFirst: mock.companyFindFirst,
      create: mock.companyCreate,
    },
    manufacturerProposal: {
      findMany: mock.proposalFindMany,
      findFirst: mock.proposalFindFirst,
      findUnique: mock.proposalFindUnique,
      create: mock.proposalCreate,
      update: mock.proposalUpdate,
    },
    $transaction: mock.transaction,
  } as never;
}

describe("manufacturer-directory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("directory merges own pending before approved", async () => {
    mock.companyFindMany.mockResolvedValue([{ id: "c1", name: "Acme" }]);
    mock.proposalFindMany.mockResolvedValue([{ id: "p1", name: "NewCo", country: null }]);
    const rows = await listManufacturerDirectory(prismaStub(), { userId: "u1" });
    expect(rows[0]?.kind).toBe("pending");
    expect(rows.some((r) => r.kind === "approved" && r.name === "Acme")).toBe(true);
  });

  it("create proposal returns duplicate pending", async () => {
    mock.companyFindFirst.mockResolvedValue(null);
    mock.proposalFindFirst.mockResolvedValue({
      id: "p1",
      name: "NewCo",
      country: null,
      note: null,
      status: "PENDING",
      sourceRole: "CLIENT",
      createdAt: new Date(),
    });
    const row = await createManufacturerProposal(prismaStub(), {
      userId: "u1",
      role: "CLIENT",
      raw: { name: "NewCo" },
    });
    expect(row.duplicate).toBe(true);
    expect(mock.proposalCreate).not.toHaveBeenCalled();
  });

  it("approve creates company and links proposal", async () => {
    mock.proposalFindUnique.mockResolvedValue({
      id: "p1",
      name: "NewCo",
      status: "PENDING",
      approvedCompanyId: null,
    });
    mock.companyFindFirst.mockResolvedValue(null);
    const company = { id: "c9", name: "NewCo", kind: "MANUFACTURER" };
    const updated = {
      id: "p1",
      status: "APPROVED",
      approvedCompanyId: "c9",
      proposedByUser: { id: "u1" },
      approvedCompany: company,
    };
    mock.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        company: { create: vi.fn().mockResolvedValue(company) },
        manufacturerProposal: { update: vi.fn().mockResolvedValue(updated) },
      };
      return fn(tx);
    });
    const result = await approveManufacturerProposal(prismaStub(), {
      proposalId: "p1",
      actorUserId: "admin1",
    });
    expect(result.company?.id).toBe("c9");
    expect(result.proposal.status).toBe("APPROVED");
  });
});
