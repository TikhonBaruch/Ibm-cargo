/**
 * Integrity audit: TnvedCode tree + rates vs Track B jsonl + hs-aliases.
 * cd app && npx tsx scripts/tnved-audit-db.ts
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

config({ path: path.resolve(__dirname, "../.env") });
const dedicatedUrl = process.env.DATABASE_URL;
config({ path: path.resolve(__dirname, "../.env.local"), override: true });
if (dedicatedUrl) process.env.DATABASE_URL = dedicatedUrl;

const LEVELS = [2, 4, 6, 8, 10] as const;

function digits(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function ancestors(leaf: string) {
  const out: string[] = [];
  for (const L of LEVELS) if (leaf.length >= L) out.push(leaf.slice(0, L));
  return out;
}

function parentOf(code: string) {
  const idx = LEVELS.indexOf(code.length as (typeof LEVELS)[number]);
  if (idx <= 0) return null;
  return code.slice(0, LEVELS[idx - 1]);
}

type Jsonl = {
  code: string;
  level: number;
  parentCode?: string | null;
  isLeaf?: boolean;
  titleRu?: string;
};

function loadJsonl(p: string): Jsonl[] {
  return readFileSync(p, "utf8")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Jsonl);
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const prisma = new PrismaClient();
  const report: Record<string, unknown> = {
    dbHost: (process.env.DATABASE_URL || "").match(/@([^/:?]+)/)?.[1] || "(missing)",
  };

  try {
    const all = await prisma.tnvedCode.findMany({
      select: {
        code: true,
        codeDisplay: true,
        level: true,
        parentCode: true,
        isLeaf: true,
        isActive: true,
        titleRu: true,
      },
    });
    const byCode = new Map(all.map((r) => [r.code, r]));
    report.total = all.length;
    report.active = all.filter((r) => r.isActive).length;

    const levels: Record<number, number> = {};
    for (const r of all) levels[r.level] = (levels[r.level] || 0) + 1;
    report.levels = levels;

    const badLevel: string[] = [];
    const badLen: string[] = [];
    const badLeafFlag: string[] = [];
    const orphanParent: string[] = [];
    const wrongParent: string[] = [];
    const missingAncestor: string[] = [];
    const emptyTitle: string[] = [];
    const badDisplay: string[] = [];

    for (const r of all) {
      if (!LEVELS.includes(r.level as (typeof LEVELS)[number])) badLevel.push(r.code);
      if (r.code.length !== r.level) badLen.push(r.code);
      if (r.isLeaf !== (r.level === 10)) badLeafFlag.push(r.code);
      if (!r.titleRu?.trim()) emptyTitle.push(r.code);
      const expectedParent = parentOf(r.code);
      if ((r.parentCode || null) !== (expectedParent || null)) {
        wrongParent.push(`${r.code}->${r.parentCode} expected ${expectedParent}`);
      }
      if (r.parentCode && !byCode.has(r.parentCode)) {
        orphanParent.push(`${r.code}->${r.parentCode}`);
      }
      for (const a of ancestors(r.code)) {
        if (a !== r.code && !byCode.has(a)) missingAncestor.push(`${r.code} missing ${a}`);
      }
      if (digits(r.codeDisplay) !== r.code) badDisplay.push(`${r.code}/${r.codeDisplay}`);
    }

    const nonLeafWithoutChildren = all.filter((r) => {
      if (r.level === 10) return false;
      return !all.some((c) => c.parentCode === r.code);
    }).length;

    report.integrity = {
      badLevel: badLevel.length,
      badLen: badLen.length,
      badLeafFlag: badLeafFlag.length,
      emptyTitle: emptyTitle.length,
      orphanParent: orphanParent.length,
      wrongParent: wrongParent.length,
      missingAncestor: missingAncestor.length,
      badDisplay: badDisplay.length,
      nonLeafWithoutChildren,
      samples: {
        orphanParent: orphanParent.slice(0, 8),
        wrongParent: wrongParent.slice(0, 8),
        missingAncestor: missingAncestor.slice(0, 8),
        badLeafFlag: badLeafFlag.slice(0, 8),
        emptyTitle: emptyTitle.slice(0, 8),
      },
    };

    const rateCount = await prisma.tnvedDutyRate.count();
    const leafCount = all.filter((r) => r.isLeaf).length;
    const leavesWithRate = await prisma.tnvedCode.count({
      where: { isLeaf: true, rates: { some: {} } },
    });
    report.rates = { total: rateCount, leaves: leafCount, leavesWithRate };

    const jsonl = loadJsonl(path.join(root, "scripts/data/tnved/normalized/codes.jsonl"));
    const jsonlCodes = new Set(jsonl.map((r) => r.code));
    const dbCodes = new Set(all.map((r) => r.code));
    const onlyDb = [...dbCodes].filter((c) => !jsonlCodes.has(c)).sort();
    const onlyJsonl = [...jsonlCodes].filter((c) => !dbCodes.has(c)).sort();
    report.vsJsonl = {
      jsonlNodes: jsonl.length,
      onlyInDb: onlyDb.length,
      onlyInJsonl: onlyJsonl.length,
      onlyInDbSample: onlyDb.slice(0, 20),
      onlyInJsonlSample: onlyJsonl.slice(0, 20),
    };

    const aliases = JSON.parse(
      readFileSync(path.join(root, "src/lbm-bro/lib/hs-aliases.json"), "utf8")
    ) as Array<{ code: string }>;
    const aliasLeaves = [...new Set(aliases.map((a) => digits(a.code)))];
    const aliasMissingLeaves = aliasLeaves.filter((c) => !dbCodes.has(c));
    const aliasTreeMissing: string[] = [];
    for (const leaf of aliasLeaves) {
      for (const a of ancestors(leaf)) {
        if (!dbCodes.has(a)) aliasTreeMissing.push(`${leaf}:${a}`);
      }
    }
    report.vsAliases = {
      aliasLeaves: aliasLeaves.length,
      missingLeaves: aliasMissingLeaves.length,
      missingLeavesSample: aliasMissingLeaves.slice(0, 10),
      missingTreeNodes: aliasTreeMissing.length,
    };

    const bro = JSON.parse(
      readFileSync(path.join(root, "public/lbm-bro/data/tnved.json"), "utf8")
    ) as { items: [string, string][] };
    const broCodes = new Set(bro.items.map(([c]) => digits(c)));
    report.vsLbmBroJson = {
      broCodes: broCodes.size,
      broMissingInDb: [...broCodes].filter((c) => !dbCodes.has(c)).length,
      dbNotInBro: [...dbCodes].filter((c) => !broCodes.has(c)).length,
    };

    report.sampleChain8471300000 = ancestors("8471300000").map((c) => {
      const n = byCode.get(c);
      return n
        ? `${c} L${n.level} parent=${n.parentCode || "-"} «${n.titleRu.slice(0, 40)}»`
        : `${c} MISSING`;
    });

    const hardFail =
      orphanParent.length +
        wrongParent.length +
        missingAncestor.length +
        badLevel.length +
        badLen.length +
        emptyTitle.length +
        aliasMissingLeaves.length +
        onlyJsonl.length >
      0;

    report.verdict = hardFail ? "FAIL" : "PASS";
    console.log(JSON.stringify(report, null, 2));
    if (hardFail) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
