#!/usr/bin/env ts-node
/**
 * Upsert TnvedCode from demo-pack.json (default), full jsonl (--full), or lab classifier (--lab).
 * Bypasses HTTP import limit 500. Usage:
 *   npm run tnved:load
 *   npm run tnved:load -- --full
 *   npm run tnved:load -- --lab
 *   npm run tnved:load -- --search-extras
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
  mergeNotesWithSearchExtras,
  notesByCodeFromLabSearch,
  STALE_INDEX_REMAP,
} from "../src/lib/ved/tnved-lab-catalog";
import { relationFocusCodes, relationsAsSearchExtras } from "../src/lib/ved/tnved-relations";
import { hintTreeFocusCodes, hintTreesAsSearchExtras } from "../src/lib/ved/tnved-hint-trees";
import {
  searchAliasFocusCodes,
  searchAliasesAsSearchExtras,
} from "../src/lib/ved/tnved-query-match";

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

function readAliasList(rel: string): Array<{ code: string; keys: string[]; why?: string }> {
  const p = path.join(root, rel);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, "utf8")) as Array<{ code: string; keys: string[]; why?: string }>;
}

function loadProjectSearchPack() {
  const indexPath = path.join(root, "public/lbm-bro/data/tnved-index.json");
  const index = existsSync(indexPath)
    ? (JSON.parse(readFileSync(indexPath, "utf8")) as {
        entries?: Array<[string, string, string[], number]>;
        aliasTokens?: Record<string, string[]>;
      })
    : undefined;
  const aliases = [
    ...readAliasList("src/lbm-bro/lib/hs-aliases.json"),
    ...readAliasList("src/lib/ved/tnved-invoice-aliases.json"),
    ...readAliasList("src/lib/ved/tnved-fts-2026-notes.json"),
  ];
  const synPath = path.join(root, "src/lib/ved/tnved-demo-synonyms.json");
  const heuristicPath = path.join(root, "src/lib/ved/ai-draft-rules.json");
  const synonyms = existsSync(synPath)
    ? (JSON.parse(readFileSync(synPath, "utf8")) as Record<string, string>)
    : {};
  const heuristicFile = existsSync(heuristicPath)
    ? (JSON.parse(readFileSync(heuristicPath, "utf8")) as {
        default?: { hsCode?: string; test?: string; why?: string };
        rules?: Array<{ hsCode?: string; test?: string; why?: string }>;
      })
    : { rules: [] };
  const heuristic = [heuristicFile.default, ...(heuristicFile.rules || [])].filter(Boolean) as Array<{
    hsCode?: string;
    test?: string;
    why?: string;
  }>;
  const packed = notesByCodeFromLabSearch({ aliases, index, synonyms, heuristic });
  const relationExtras = relationsAsSearchExtras();
  const hintExtras = hintTreesAsSearchExtras();
  const searchAliasExtras = searchAliasesAsSearchExtras();
  for (const extraMap of [relationExtras, hintExtras, searchAliasExtras]) {
    for (const [code, extra] of extraMap) {
      const tokens = packed.tokens.get(code) || [];
      tokens.push(...extra.tokens);
      packed.tokens.set(code, tokens);
      if (extra.why.length) {
        const why = packed.why.get(code) || [];
        why.push(...extra.why);
        packed.why.set(code, why);
      }
    }
  }
  return { packed, aliases, synonyms, heuristic };
}

function readLabItems(): TnvedImportItem[] {
  const jsonPath = path.join(root, "public/lbm-bro/data/tnved.json");
  if (!existsSync(jsonPath)) throw new Error(`Missing ${jsonPath}`);
  const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    items: [string, string][];
  };
  return labCatalogToImportItems(raw.items, loadProjectSearchPack().packed);
}

async function mergeSearchExtras() {
  const { packed, aliases, synonyms, heuristic } = loadProjectSearchPack();
  const focus = new Set<string>();
  for (const a of aliases) if (a.code) focus.add(String(a.code).replace(/\D/g, ""));
  for (const c of Object.keys(synonyms)) focus.add(c.replace(/\D/g, ""));
  for (const r of heuristic) if (r.hsCode) focus.add(String(r.hsCode).replace(/\D/g, ""));
  for (const targets of Object.values(STALE_INDEX_REMAP)) for (const t of targets) focus.add(t);
  for (const c of relationFocusCodes()) focus.add(c);
  for (const c of hintTreeFocusCodes()) focus.add(c);
  for (const c of searchAliasFocusCodes()) focus.add(c);
  let updated = 0;
  let skipped = 0;
  for (const code of focus) {
    if (![2, 4, 6, 8, 10].includes(code.length)) continue;
    const row = await prisma.tnvedCode.findUnique({
      where: { code },
      select: { code: true, notes: true },
    });
    if (!row) {
      skipped += 1;
      continue;
    }
    const next = mergeNotesWithSearchExtras(row.notes, {
      why: packed.why.get(code),
      tokens: packed.tokens.get(code),
    });
    if (!next || next === row.notes) continue;
    await prisma.tnvedCode.update({ where: { code }, data: { notes: next } });
    updated += 1;
  }
  const stats = {
    total: await prisma.tnvedCode.count({ where: { isActive: true } }),
    leaves: await prisma.tnvedCode.count({ where: { isActive: true, isLeaf: true } }),
    variations: await prisma.tnvedCode.count({ where: { isActive: true, notes: { not: null } } }),
  };
  console.log(`search extras merged ${updated}; stale-index skipped ${skipped}; ${stats.total} codes · ${stats.leaves} leaves · ${stats.variations} variations`);
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
  if (process.argv.includes("--search-extras")) {
    console.log(`target ${dbHint()} · merge project search extras`);
    await mergeSearchExtras();
    return;
  }
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
