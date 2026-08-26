#!/usr/bin/env ts-node
/**
 * Upsert TnvedCode from demo-pack.json (default) or full jsonl (--full).
 * Bypasses HTTP import limit 500. Usage:
 *   npm run tnved:load
 *   npm run tnved:load -- --full
 */
import { config as loadEnv } from "dotenv";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { upsertTnvedBatch, type TnvedImportItem } from "../src/lib/ved/tnved";
import { TNVED_DEMO_RATE_SOURCE } from "../src/lib/ved/tnved-fns";
import { TNVED_TWS_RATE_SOURCE } from "../src/lib/ved/tnved-tws";

const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env") });
// Keep dedicated DB/S3 from .env even if .env.local exists
const dedicatedUrl = process.env.DATABASE_URL;
loadEnv({ path: path.join(root, ".env.local"), override: true });
if (dedicatedUrl) process.env.DATABASE_URL = dedicatedUrl;
const CHUNK = Number(process.env.TNVED_LOAD_CHUNK || "80");
const prisma = new PrismaClient();

function readItems(): { label: string; items: TnvedImportItem[] } {
  const full = process.argv.includes("--full");
  if (full) {
    const p = path.join(root, "scripts/data/tnved/normalized/codes.jsonl");
    if (!existsSync(p)) throw new Error(`Missing ${p}. Run npm run tnved:normalize`);
    const items = readFileSync(p, "utf8")
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as TnvedImportItem)
      .sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
    return { label: p, items };
  }
  const p = path.join(root, "scripts/fixtures/tnved/demo-pack.json");
  const pack = JSON.parse(readFileSync(p, "utf8")) as { items: TnvedImportItem[] };
  return { label: p, items: pack.items };
}

async function main() {
  const { label, items } = readItems();
  if (!items.length) throw new Error("no items");
  await prisma.tnvedDutyRate.deleteMany({
    where: { source: { in: ["seed-heuristic-v1", TNVED_DEMO_RATE_SOURCE, TNVED_TWS_RATE_SOURCE] } },
  });
  let upserted = 0;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const result = await upsertTnvedBatch(prisma, chunk);
    upserted += result.upserted;
    console.log(`  chunk ${i / CHUNK + 1} +${result.upserted} (total ${upserted})`);
  }
  console.log(`loaded ${upserted} from ${path.relative(root, label)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
