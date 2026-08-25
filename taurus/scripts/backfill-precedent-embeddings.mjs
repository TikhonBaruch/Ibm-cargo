#!/usr/bin/env node
/**
 * Backfill pgvector embeddings for existing verified_determinations rows.
 *   DATABASE_URL=postgresql://lbm:lbm@localhost:5432/lbm node scripts/backfill-precedent-embeddings.mjs
 */
import { PrismaClient } from "@prisma/client";
import {
  embedCanonicalText,
  isPrecedentEmbeddingEnabled,
  toVectorLiteral,
  PRECEDENT_EMBED_DIM,
} from "../containers/api/src/precedent-embeddings.js";

const prisma = new PrismaClient();
const BATCH = Number(process.env.PRECEDENT_BACKFILL_BATCH || "20");

async function main() {
  if (!isPrecedentEmbeddingEnabled()) {
    console.log("SKIP: OPENAI_API_KEY not set");
    return;
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, "canonicalText" FROM verified_determinations
     WHERE embedding IS NULL
     ORDER BY "approvedAt" DESC
     LIMIT ${BATCH}`
  );
  console.log(`Backfill ${rows.length} rows (batch=${BATCH})`);
  let ok = 0;
  for (const row of rows) {
    const vec = await embedCanonicalText(row.canonicalText);
    if (!vec) {
      console.log(`  skip ${row.id} (embed failed)`);
      continue;
    }
    const literal = toVectorLiteral(vec);
    await prisma.$executeRawUnsafe(
      `UPDATE verified_determinations SET embedding = $1::vector(${PRECEDENT_EMBED_DIM}) WHERE id = $2`,
      literal,
      row.id
    );
    ok += 1;
    console.log(`  ok ${row.id}`);
  }
  console.log(`Done: ${ok}/${rows.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
