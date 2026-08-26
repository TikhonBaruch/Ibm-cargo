#!/usr/bin/env ts-node
/**
 * Sync missing TN VED branches from lbm-bro catalog + hs-aliases into Prisma TnvedCode.
 *
 * - Leaves: every hs-aliases code
 * - Dependencies: full ancestor chain 2→4→6→8→10 from public/lbm-bro/data/tnved.json
 * - notes: alias keys (synonyms) for directory search
 *
 * Usage: cd app && npx tsx scripts/tnved-sync-lbm-bro-aliases.ts
 * Dry-run:  npx tsx scripts/tnved-sync-lbm-bro-aliases.ts --dry
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  buildTnvedImportItem,
  hsCodeAncestors,
  upsertTnvedBatch,
  type TnvedImportItem,
} from "../src/lib/ved/tnved";
import { TNVED_GROUPS } from "../src/lbm-bro/lib/tnved-groups";

config({ path: path.resolve(__dirname, "../.env") });

const dry = process.argv.includes("--dry");
const root = path.resolve(__dirname, "..");
const CHUNK = 80;
const RATE_SOURCE = "seed-lbm-bro-aliases";

type HsAlias = { code: string; keys: string[]; why?: string; risk?: string };

function loadTitleMap() {
  const raw = JSON.parse(readFileSync(path.join(root, "public/lbm-bro/data/tnved.json"), "utf8")) as {
    items: [string, string][];
  };
  return new Map(raw.items.map(([c, t]) => [String(c).replace(/\D/g, ""), String(t)]));
}

function chapterTitle(code2: string) {
  const hit = TNVED_GROUPS.find((g) => g[0] === code2);
  return hit?.[1] || `Группа ТН ВЭД ${code2}`;
}

function titleFor(code: string, titles: Map<string, string>, alias?: HsAlias) {
  const fromJson = titles.get(code);
  if (fromJson) return fromJson;
  if (code.length === 2) return chapterTitle(code);
  if (alias?.why) return alias.why;
  return `Позиция ТН ВЭД ${code}`;
}

function notesFor(alias: HsAlias | undefined, existing?: string | null) {
  const keys = (alias?.keys || [])
    .map((k) => k.replace(/^=/, "").trim())
    .filter((k) => k.length >= 2);
  const parts = [...keys];
  if (alias?.risk && alias.risk !== "Уточните описание товара") {
    parts.push(`риск: ${alias.risk}`);
  }
  const syn = parts.join("; ");
  if (!syn) return existing ?? null;
  if (!existing) return syn;
  if (existing.includes(syn.slice(0, 20))) return existing;
  return `${existing} | ${syn}`.slice(0, 4000);
}

async function main() {
  const titles = loadTitleMap();
  const aliases = JSON.parse(
    readFileSync(path.join(root, "src/lbm-bro/lib/hs-aliases.json"), "utf8")
  ) as HsAlias[];
  const byAliasCode = new Map(aliases.map((a) => [a.code.replace(/\D/g, ""), a]));

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.tnvedCode.findMany({
      select: { code: true, notes: true },
    });
    const existingSet = new Set(existing.map((r) => r.code));
    const existingNotes = new Map(existing.map((r) => [r.code, r.notes]));

    const needed = new Set<string>();
    for (const a of aliases) {
      const leaf = a.code.replace(/\D/g, "");
      if (![2, 4, 6, 8, 10].includes(leaf.length)) continue;
      for (const node of hsCodeAncestors(leaf)) needed.add(node);
    }

    const missing = [...needed]
      .filter((c) => !existingSet.has(c))
      .sort((a, b) => a.length - b.length || a.localeCompare(b));

    const updateLeaves = [...byAliasCode.keys()].filter((c) => existingSet.has(c));

    console.log("lbm-bro titles:", titles.size);
    console.log("alias leaves:", byAliasCode.size);
    console.log("db before:", existingSet.size);
    console.log("tree nodes required:", needed.size);
    console.log("missing to insert:", missing.length);
    console.log("existing alias leaves to refresh notes:", updateLeaves.length);

    const inserts: TnvedImportItem[] = missing.map((code) => {
      const alias = byAliasCode.get(code);
      const level = code.length as 2 | 4 | 6 | 8 | 10;
      const item = buildTnvedImportItem({
        code,
        titleRu: titleFor(code, titles, alias),
        notes: notesFor(alias, null) || undefined,
        vatPct: 22,
        // duty unknown — keep null (opendata canon)
      });
      item.level = level;
      item.isLeaf = level === 10;
      if (alias && level === 10) {
        item.rate = {
          code,
          dutyKind: "AD_VALOREM",
          dutyPct: null,
          vatPct: 22,
          source: RATE_SOURCE,
        };
      }
      return item;
    });

    // Refresh notes on existing alias leaves (synonyms for search)
    const refreshes: TnvedImportItem[] = [];
    for (const code of updateLeaves) {
      const alias = byAliasCode.get(code)!;
      const title = titleFor(code, titles, alias);
      const notes = notesFor(alias, existingNotes.get(code));
      refreshes.push(
        buildTnvedImportItem({
          code,
          titleRu: title,
          notes: notes || undefined,
          vatPct: 22,
        })
      );
    }

    if (dry) {
      console.log(
        "dry-run sample missing:",
        missing.slice(0, 25).map((c) => `${c}:${titleFor(c, titles, byAliasCode.get(c)).slice(0, 40)}`)
      );
      return;
    }

    // Prefer official titles from lbm-bro for refreshes too
    let upserted = 0;
    const all = [...inserts, ...refreshes].sort(
      (a, b) => a.level - b.level || a.code.localeCompare(b.code)
    );
    for (let i = 0; i < all.length; i += CHUNK) {
      const chunk = all.slice(i, i + CHUNK);
      const result = await upsertTnvedBatch(prisma, chunk);
      upserted += result.upserted;
      console.log(`  chunk ${i / CHUNK + 1} +${result.upserted} (total ${upserted})`);
    }

    const after = await prisma.tnvedCode.count();
    const dbNow = new Set(
      (await prisma.tnvedCode.findMany({ select: { code: true } })).map((r) => r.code)
    );
    const aliasMissingAfter = [...byAliasCode.keys()].filter((c) => !dbNow.has(c));
    console.log("db after:", after);
    console.log("alias leaves still missing:", aliasMissingAfter.length, aliasMissingAfter.slice(0, 10));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
