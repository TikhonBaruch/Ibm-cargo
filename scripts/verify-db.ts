/**
 * Connectivity check against app/.env DATABASE_URL (no secret print).
 * Run: cd app && npx tsx scripts/verify-db.ts
 *
 * Loads .env then .env.local, but never lets .env.local override DATABASE_URL / S3_*.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

config({ path: resolve(process.cwd(), ".env") });
const dedicated = {
  DATABASE_URL: process.env.DATABASE_URL,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY,
};
config({ path: resolve(process.cwd(), ".env.local"), override: true });
for (const [k, v] of Object.entries(dedicated)) {
  if (v != null && v !== "") process.env[k] = v;
}

const url = process.env.DATABASE_URL || "";
const host = url.match(/@([^/:?]+)/)?.[1] || "(missing)";
const dbName = url.match(/\/([^/?]+)(\?|$)/)?.[1] || "(missing)";
const hasS3 = Boolean(process.env.S3_BUCKET && process.env.S3_ENDPOINT);

console.log("env root: app/");
console.log("DATABASE host:", host);
console.log("DATABASE name:", dbName);
console.log("S3_BUCKET:", process.env.S3_BUCKET || "(missing)");
console.log("S3 configured:", hasS3);
if (/127\.0\.0\.1|localhost/.test(url)) {
  console.warn("WARN: DATABASE_URL points at localhost — expected dedicated LBM Postgres in app/.env");
}

const prisma = new PrismaClient();
async function main() {
  await prisma.$queryRaw`SELECT 1`;
  const tnved = await prisma.tnvedCode.count();
  const users = await prisma.user.count();
  console.log("OK prisma connect");
  console.log("tnvedCode count:", tnved);
  console.log("user count:", users);
}

main()
  .catch((e) => {
    console.error("FAIL:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
