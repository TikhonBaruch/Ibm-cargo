#!/usr/bin/env ts-node
/**
 * Upsert TnvedCode from demo-pack.json (default), full jsonl (--full), or lab classifier (--lab).
 * Bypasses HTTP import limit 500. Usage:
 *   npm run tnved:load
 *   npm run tnved:load -- --full
 *   npm run tnved:load -- --lab
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  tnvedCodeSchema,
  upsertTnvedBatch,
  type TnvedImportItem,
} from "../src/lib/ved/tnved";
import { TNVED_DEMO_RATE_SOURCE } from "../src/lib/ved/tnved-fns";
import { TNVED_TWS_RATE_SOURCE } from "../src/lib/ved/tnved-tws";
import {
  labCatalogToImportItems,
  notesByCodeFromLabSearch,
} from "../src/lib/ved/tnved-lab-catalog";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
} catch {
  /* optional */
}

const root = path.resolve(__dirname, "..");
const CHUNK = Number(process.env.TNVED_LOAD_CHUNK || "80");
const prisma = new PrismaClient();

function dbHint() {
  const raw = process.env.DATABASE_URL || "";
  try {
    const u = new URL(raw);
    const db = u.pathname.replace(/^\//, "").split("?")[0];
    return `${u.hostname}:${u.port || "5432"}/${db}`;
  } catch {
    return "unparsed";
  }
}

function readLabItems(): TnvedImportItem[] {
  const jsonPath = path.join(root, "public/lbm-bro/data/tnved.json");
  const indexPath = path.join(root, "public/lbm-bro/data/tnved-index.json");
  const aliasPath = path.join(root, "src/lbm-bro/lib/hs-aliases.json");
  if (!existsSync(jsonPath)) throw new Error(`Missing ${jsonPath}`);
  const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    items: [string, string][];
  };
  const index = existsSync(indexPath)
    ? (JSON.parse(readFileSync(indexPath, "utf8")) as {
        entries?: Array<[string, string, string[], number]>;
        aliasTokens?: Record<string, string[]>;
      })
    : undefined;
  const aliases = existsSync(aliasPath)
    ? (JSON.parse(readFileSync(aliasPath, "utf8")) as Array<{ code: string; keys: string[] }>)
    : [];
  const notesByCode = notesByCodeFromLabSearch({ aliases, index });
  return labCatalogToImportItems(raw.items, notesByCode);
}

function readItems(): { label: string; items: TnvedImportItem[]; wipeRates: boolean; fast: boolean } {
  const lab = process.argv.includes("--lab");
  const full = process.argv.includes("--full");
  if (lab) {
    return {
      label: "public/lbm-bro/data/tnved.json",
      items: readLabItems(),
      wipeRates: false,
      fast: true,
    };
  }
  if (full) {
    const p = path.join(root, "scripts/data/tnved/normalized/codes.jsonl");
    if (!existsSync(p)) throw new Error(`Missing ${p}. Run npm run tnved:normalize`);
    const items = readFileSync(p, "utf8")
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as TnvedImportItem)
      .sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
    return { label: p, items, wipeRates: true, fast: false };
  }
  const p = path.join(root, "scripts/fixtures/tnved/demo-pack.json");
  const pack = JSON.parse(readFileSync(p, "utf8")) as { items: TnvedImportItem[] };
  return { label: p, items: pack.items, wipeRates: true, fast: false };
}

/** Chunked INSERT … ON CONFLICT. Same fields as upsertTnvedBatch; omitted notes keep existing. */
async function upsertTnvedChunkSql(chunk: TnvedImportItem[]) {
  const rows = chunk.map((row) => tnvedCodeSchema.parse(row));
  const values = Prisma.join(
    rows.map((row) => {
      const notes = row.notes === undefined ? null : (row.notes ?? null);
      return Prisma.sql`(${row.code}, ${row.codeDisplay}, ${row.level}, ${row.parentCode ?? null}, ${row.titleRu}, ${row.titleEn ?? null}, ${row.isLeaf}, ${row.isActive}, ${notes}, NOW())`;
    }),
  );
  const result = await prisma.$executeRaw`
    INSERT INTO "tnved_codes"
      (code, "codeDisplay", level, "parentCode", "titleRu", "titleEn", "isLeaf", "isActive", notes, "updatedAt")
    VALUES ${values}
    ON CONFLICT (code) DO UPDATE SET
      "codeDisplay" = EXCLUDED."codeDisplay",
      level = EXCLUDED.level,
      "parentCode" = EXCLUDED."parentCode",
      "titleRu" = EXCLUDED."titleRu",
      "titleEn" = COALESCE(EXCLUDED."titleEn", "tnved_codes"."titleEn"),
      "isLeaf" = EXCLUDED."isLeaf",
      "isActive" = EXCLUDED."isActive",
      notes = COALESCE(EXCLUDED.notes, "tnved_codes".notes),
      "updatedAt" = NOW()
  `;
  return Number(result);
}

async function main() {
  const { label, items, wipeRates, fast } = readItems();
  if (!items.length) throw new Error("no items");
  const chunkSize = fast ? Number(process.env.TNVED_LOAD_CHUNK || "400") : CHUNK;
  console.log(`target ${dbHint()} · ${items.length} rows from ${label} · chunk ${chunkSize}`);
  if (wipeRates) {
    await prisma.tnvedDutyRate.deleteMany({
      where: { source: { in: ["seed-heuristic-v1", TNVED_DEMO_RATE_SOURCE, TNVED_TWS_RATE_SOURCE] } },
    });
  }
  let upserted = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    if (fast) {
      upserted += await upsertTnvedChunkSql(chunk);
    } else {
      const result = await upsertTnvedBatch(prisma, chunk);
      upserted += result.upserted;
    }
    console.log(`  chunk ${i / chunkSize + 1} +${chunk.length} (total ${Math.min(i + chunk.length, items.length)}/${items.length})`);
  }
  const active = await prisma.tnvedCode.count({ where: { isActive: true } });
  console.log(`loaded ${upserted} from ${label}; active ${active}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
