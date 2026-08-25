/**
 * Real PrismaClient for DB integration tests (no Prisma mocks).
 * Only local Postgres — never sweb / Neon / hosted prod URLs.
 */
import { PrismaClient } from "@prisma/client";

const UNSAFE =
  /sweb|neon\.tech|supabase|vercel-storage|railway|render\.com|amazonaws|pooler\.supabase/i;

export function resolveSafeTestDatabaseUrl(): string | null {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!url || UNSAFE.test(url)) return null;
  if (!/localhost|127\.0\.0\.1|\[::1\]|@postgres[:/]/i.test(url)) return null;
  return url;
}

export function dbIntegrationEnabled(): boolean {
  return process.env.RUN_DB_INTEGRATION === "1" && Boolean(resolveSafeTestDatabaseUrl());
}

export function createTestPrisma(): PrismaClient {
  const url = resolveSafeTestDatabaseUrl();
  if (!url) {
    throw new Error(
      "DB integration needs TEST_DATABASE_URL or local DATABASE_URL (localhost/127.0.0.1/postgres)"
    );
  }
  return new PrismaClient({
    datasourceUrl: url,
    log: ["error"],
  });
}

export type ShippingFixtureIds = {
  companyId: string;
  userId: string;
  calculationId: string;
  shippingIds: string[];
};

export function emptyFixtureIds(): ShippingFixtureIds {
  return { companyId: "", userId: "", calculationId: "", shippingIds: [] };
}

/** Delete only rows this test created (no TRUNCATE — seed data stays). */
export async function cleanupShippingFixture(
  db: PrismaClient,
  ids: ShippingFixtureIds
): Promise<void> {
  const shippingIds = ids.shippingIds.filter(Boolean);
  if (shippingIds.length) {
    await db.shippingRequest.deleteMany({ where: { id: { in: shippingIds } } });
  }
  if (ids.calculationId) {
    await db.shippingRequest.deleteMany({ where: { calculationId: ids.calculationId } });
    await db.calculation.deleteMany({ where: { id: ids.calculationId } });
  }
  if (ids.userId) {
    await db.user.deleteMany({ where: { id: ids.userId } });
  }
  if (ids.companyId) {
    await db.shippingRequest.deleteMany({ where: { companyId: ids.companyId } });
    await db.calculation.deleteMany({ where: { companyId: ids.companyId } });
    await db.user.deleteMany({ where: { companyId: ids.companyId } });
    await db.company.deleteMany({ where: { id: ids.companyId } });
  }
}

export async function seedShippingCalc(
  db: PrismaClient,
  status: "DONE" | "QUEUED" | "DRAFT"
): Promise<ShippingFixtureIds> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const company = await db.company.create({
    data: { name: `itest-ship-co-${stamp}`, kind: "CLIENT" },
  });
  const user = await db.user.create({
    data: {
      email: `itest-ship-${stamp}@example.com`,
      name: "Shipping ITest",
      role: "CLIENT",
      companyId: company.id,
      password: "itest-not-a-login",
    },
  });
  const calc = await db.calculation.create({
    data: {
      number: `IT-SHIP-${stamp}`,
      title: `ITest waybill ${stamp}`,
      description: "DB integration fixture — shipping waybill",
      status,
      clientUserId: user.id,
      companyId: company.id,
      doneAt: status === "DONE" ? new Date() : null,
    },
  });
  return {
    companyId: company.id,
    userId: user.id,
    calculationId: calc.id,
    shippingIds: [],
  };
}
