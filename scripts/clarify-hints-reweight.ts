/**
 * Nightly clarify-hints reweight from hs_feedback (P2).
 * Usage: npx tsx scripts/clarify-hints-reweight.ts
 */
import { PrismaClient } from "@prisma/client";
import { reweightClarifyHints } from "../src/lib/ved/clarify-hints/learning";

const prisma = new PrismaClient();

async function main() {
  const result = await reweightClarifyHints(prisma);
  console.log(JSON.stringify({ ok: true, ...result }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
