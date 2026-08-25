/**
 * Company balance ledger: TOPUP / TARIFF_CHARGE with insufficient-balance guard.
 * Used by payCalculation and mock company top-up (MVP, no acquiring).
 * Row lock + optional same-tx work: D23 / docs/knowledge/db-process.md.
 */
import { prisma } from "@/lib/prisma";
import type { LedgerKind, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function creditCompany<T = unknown>(opts: {
  companyId: string;
  amountRub: number;
  kind: LedgerKind;
  description: string;
  calculationId?: string;
  createdById?: string;
  /** Extra work in the same interactive transaction (e.g. pay status update). */
  after?: (tx: Tx, ledgerEntry: { id: string; balanceAfter: number }) => Promise<T>;
}): Promise<T extends undefined ? Awaited<ReturnType<Tx["ledgerEntry"]["create"]>> : T> {
  if (opts.amountRub === 0) throw new Error("amount must be non-zero");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "companies" WHERE id = ${opts.companyId} FOR UPDATE`;
    const company = await tx.company.findUniqueOrThrow({ where: { id: opts.companyId } });
    const balanceAfter = company.balanceRub + opts.amountRub;
    if (balanceAfter < 0) {
      throw new Error("Insufficient balance");
    }
    await tx.company.update({
      where: { id: opts.companyId },
      data: { balanceRub: balanceAfter },
    });
    const entry = await tx.ledgerEntry.create({
      data: {
        companyId: opts.companyId,
        kind: opts.kind,
        amountRub: opts.amountRub,
        balanceAfter,
        description: opts.description,
        calculationId: opts.calculationId,
        createdById: opts.createdById,
      },
    });
    if (opts.after) {
      return (await opts.after(tx, entry)) as T extends undefined
        ? Awaited<ReturnType<Tx["ledgerEntry"]["create"]>>
        : T;
    }
    return entry as T extends undefined ? Awaited<ReturnType<Tx["ledgerEntry"]["create"]>> : T;
  });
}
