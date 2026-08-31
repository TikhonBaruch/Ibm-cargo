#!/usr/bin/env node
/**
 * C35c B1 ops: count verified_determinations (БД-2).
 *
 *   DATABASE_URL=… npm run ops:precedent-count
 *   DATABASE_URL=… npm run ops:precedent-count -- --days 14
 *
 * Does not print secrets. Exit 2 if DATABASE_URL missing / DB unreachable.
 */
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const daysIdx = args.indexOf("--days");
const rawDays = daysIdx >= 0 && args[daysIdx + 1] ? Number(args[daysIdx + 1]) : 14;
const days = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 14;

if (!process.env.DATABASE_URL?.trim()) {
  console.error("NEED  DATABASE_URL — set to the app DB (compose/sweb), not secrets in git");
  process.exit(2);
}

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.verifiedDetermination.count();
  const byQuality = await prisma.verifiedDetermination.groupBy({
    by: ["quality"],
    _count: { _all: true },
  });
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const recent = await prisma.verifiedDetermination.count({
    where: { approvedAt: { gte: sinceDate } },
  });
  const topHs = await prisma.verifiedDetermination.groupBy({
    by: ["hsCodeDigits"],
    _count: { _all: true },
    orderBy: { _count: { hsCodeDigits: "desc" } },
    take: 10,
  });

  console.log("Precedent БД-2 ops count (C35c B1)\n");
  console.log(`OK    total verified_determinations = ${total}`);
  console.log(`OK    approved last ${days}d        = ${recent}`);
  for (const row of byQuality) {
    console.log(`OK    quality=${String(row.quality).padEnd(14)} count=${row._count._all}`);
  }
  console.log("\nTop hsCodeDigits:");
  for (const row of topHs) {
    console.log(`  ${row.hsCodeDigits}  ×${row._count._all}`);
  }
  console.log(
    "\nRecipe: run before/after N broker approve → total must ↑; then smoke:precedent-csv."
  );
}

main()
  .catch((e) => {
    console.error("FAIL ", e.message || e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
