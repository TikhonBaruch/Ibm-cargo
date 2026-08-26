/**
 * Live smoke: searchTnvedCodes ranking on dedicated DB (no secrets printed).
 * cd app && npx tsx scripts/smoke-tnved-search.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { searchTnvedCodes, listTnvedChapters } from "../src/lib/ved/tnved";

config({ path: resolve(process.cwd(), ".env") });
const dedicatedUrl = process.env.DATABASE_URL;
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (dedicatedUrl) process.env.DATABASE_URL = dedicatedUrl;

const prisma = new PrismaClient();

async function main() {
  const chapters = await listTnvedChapters(prisma);
  console.log("chapters:", chapters.length);

  for (const q of ["ноутбук", "iphone", "футболка", "8471"]) {
    const items = await searchTnvedCodes(prisma, { q, limit: 5 });
    const top = items[0];
    console.log(
      JSON.stringify({
        q,
        top: top?.code ?? null,
        kind: top?.matchMeta?.kind ?? null,
        score: top?.matchMeta?.score ?? null,
        title: top?.titleRu?.slice(0, 50) ?? null,
      })
    );
  }
}

main()
  .catch((e) => {
    console.error("FAIL:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
