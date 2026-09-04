#!/usr/bin/env ts-node
/**
 * Load curated card-enrich pack into TnvedEnrich* overlay; reconcile vs tnved_codes.
 *
 *   npm run tnved:card-enrich -- --load
 *   npm run tnved:card-enrich -- --reconcile
 *
 * Canon: docs/knowledge/plan-tnved-card-enrich.md — no CustomsOnline scrape.
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  factsFromPack,
  reconcileEnrichCodes,
  shaOfFacts,
  TNVED_ENRICH_SCHEMA,
} from "../src/lib/ved/tnved-card-enrich";

for (const rel of ["../app/.env", "../.env", "../.env.local"]) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("dotenv").config({ path: path.resolve(__dirname, rel) });
  } catch {
    /* optional */
  }
}

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const doLoad = args.includes("--load");
const doReconcile = args.includes("--reconcile");
const outDir = path.join(root, ".tmp-fts-scan");
mkdirSync(outDir, { recursive: true });

const prisma = new PrismaClient();

function dbHint() {
  const raw = process.env.DATABASE_URL || "";
  try {
    const u = new URL(raw);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "unparsed";
  }
}

async function loadPack() {
  const { sourceKey, asOf, schemaKind, facts } = factsFromPack();
  const sourceSha = shaOfFacts(facts);
  const uniqueCodes = new Set(facts.map((f) => f.code)).size;

  await prisma.$transaction(async (tx) => {
    await tx.tnvedEnrichSnapshot.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    });
    const existing = await tx.tnvedEnrichSnapshot.findUnique({ where: { sourceKey } });
    if (existing) {
      await tx.tnvedEnrichFact.deleteMany({ where: { snapshotId: existing.id } });
      await tx.tnvedEnrichSnapshot.delete({ where: { id: existing.id } });
    }
    const snap = await tx.tnvedEnrichSnapshot.create({
      data: {
        sourceKey,
        sourceSha,
        asOf: asOf ? new Date(`${asOf}T00:00:00.000Z`) : null,
        schemaKind: schemaKind || TNVED_ENRICH_SCHEMA,
        rowCount: facts.length,
        uniqueCodes,
        isCurrent: true,
      },
    });
    const chunk = 200;
    for (let i = 0; i < facts.length; i += chunk) {
      const slice = facts.slice(i, i + chunk);
      await tx.tnvedEnrichFact.createMany({
        data: slice.map((f) => ({
          snapshotId: snap.id,
          code: f.code,
          fieldKind: f.fieldKind,
          valueShort: f.valueShort ?? null,
          valueText: f.valueText ?? null,
          npaRef: f.npaRef ?? null,
          sourceLayer: f.sourceLayer ?? null,
          asOf: f.asOf ? new Date(`${f.asOf}T00:00:00.000Z`) : null,
        })),
      });
    }
  });

  const report = {
    ok: true,
    db: dbHint(),
    sourceKey,
    sourceSha,
    rowCount: facts.length,
    uniqueCodes,
    asOf,
  };
  writeFileSync(path.join(outDir, "card-enrich-load-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

async function reconcile() {
  const { facts } = factsFromPack();
  const codes = [...new Set(facts.map((f) => f.code))];
  const rows = await prisma.tnvedCode.findMany({
    where: { code: { in: codes } },
    select: { code: true, isActive: true },
  });
  const tree = new Map(rows.map((r) => [r.code, { isActive: r.isActive }]));
  const report = {
    db: dbHint(),
    ...reconcileEnrichCodes(codes, tree),
    at: new Date().toISOString(),
  };
  writeFileSync(
    path.join(outDir, "card-enrich-reconcile-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  if (!doLoad && !doReconcile) {
    console.error("Usage: npm run tnved:card-enrich -- --load | --reconcile");
    process.exit(2);
  }
  console.log(`tnved:card-enrich db=${dbHint()}`);
  if (doLoad) await loadPack();
  if (doReconcile) await reconcile();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
