#!/usr/bin/env ts-node
/**
 * Load FTS preliminary-decision workbooks into TnvedFts* (C39), reconcile, actualize notes.
 *
 *   npm run tnved:fts-pr -- --dir "/path/to/ТНВЭД-ФТС" --load
 *   npm run tnved:fts-pr -- --reconcile --actualize
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import {
  buildFtsPrNotesPatch,
  parseAsOfFromFileName,
  pickCurrentSourceFile,
  rowsFromSheetObjects,
  summarizeReconcile,
  tokensFromFtsDescription,
  type FtsPrRow,
} from "../src/lib/ved/tnved-fts-pr";

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
function flag(name: string) {
  return args.includes(name);
}
function opt(name: string, fallback = ""): string {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}

const doLoad = flag("--load");
const doReconcile = flag("--reconcile") || flag("--actualize");
const doActualize = flag("--actualize");
const dir = opt("--dir", "/home/andrey/Загрузки/ТНВЭД-ФТС");
const outDir = path.join(root, ".tmp-fts-scan");
mkdirSync(outDir, { recursive: true });

const prisma = new PrismaClient();
const CHUNK = 400;

function dbHint() {
  const raw = process.env.DATABASE_URL || "";
  try {
    const u = new URL(raw);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "unparsed";
  }
}

function sha1File(p: string): string {
  return createHash("sha1").update(readFileSync(p)).digest("hex");
}

function listWorkbooks(base: string): string[] {
  const out: string[] = [];
  function walk(d: string) {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, name.name);
      if (name.isDirectory()) {
        if (name.name.startsWith(".")) continue;
        walk(p);
        continue;
      }
      if (/\.xlsx?$/i.test(name.name) && !name.name.startsWith("~$")) out.push(p);
    }
  }
  walk(base);
  return out.sort((a, b) => a.localeCompare(b, "ru"));
}

function readWorkbook(filePath: string) {
  const wb = XLSX.readFile(filePath, { cellDates: false });
  const sheet = wb.SheetNames[0];
  const objs = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "", raw: false }) as Record<
    string,
    unknown
  >[];
  return rowsFromSheetObjects(objs);
}

async function upsertSnapshot(opts: {
  sourceFile: string;
  sourceSha: string;
  asOf: Date | null;
  schemaKind: string;
  rows: FtsPrRow[];
  isCurrent: boolean;
}) {
  const existing = await prisma.tnvedFtsSnapshot.findUnique({ where: { sourceSha: opts.sourceSha } });
  let snapshotId: string;
  if (existing) {
    await prisma.tnvedFtsDecision.deleteMany({ where: { snapshotId: existing.id } });
    await prisma.tnvedFtsSnapshot.update({
      where: { id: existing.id },
      data: {
        sourceFile: opts.sourceFile,
        asOf: opts.asOf,
        schemaKind: opts.schemaKind,
        rowCount: opts.rows.length,
        uniqueCodes: new Set(opts.rows.map((r) => r.code)).size,
        isCurrent: opts.isCurrent,
        loadedAt: new Date(),
      },
    });
    snapshotId = existing.id;
  } else {
    const created = await prisma.tnvedFtsSnapshot.create({
      data: {
        sourceFile: opts.sourceFile,
        sourceSha: opts.sourceSha,
        asOf: opts.asOf,
        schemaKind: opts.schemaKind,
        rowCount: opts.rows.length,
        uniqueCodes: new Set(opts.rows.map((r) => r.code)).size,
        isCurrent: opts.isCurrent,
      },
    });
    snapshotId = created.id;
  }

  for (let i = 0; i < opts.rows.length; i += CHUNK) {
    const slice = opts.rows.slice(i, i + CHUNK);
    await prisma.tnvedFtsDecision.createMany({
      data: slice.map((r) => ({
        snapshotId,
        code: r.code,
        description: r.description,
        country: r.country || null,
        justification: r.justification || null,
        descFingerprint: r.descFingerprint,
        rowIndex: r.rowIndex,
      })),
    });
  }
  return snapshotId;
}

async function loadDir(base: string) {
  if (!existsSync(base)) throw new Error(`dir not found: ${base}`);
  const files = listWorkbooks(base);
  const basenames = files.map((f) => path.basename(f));
  const currentName = pickCurrentSourceFile(basenames);
  console.log(`load dir=${base} workbooks=${files.length} current=${currentName || "none"} db=${dbHint()}`);

  // clear isCurrent first
  await prisma.tnvedFtsSnapshot.updateMany({ data: { isCurrent: false } });

  const bySha = new Map<string, string>();
  const report: Array<Record<string, unknown>> = [];
  let loaded = 0;
  let skippedDup = 0;

  for (const filePath of files) {
    const sourceFile = path.relative(base, filePath) || path.basename(filePath);
    const sourceSha = sha1File(filePath);
    if (bySha.has(sourceSha)) {
      skippedDup++;
      report.push({ sourceFile, status: "dup_sha", sameAs: bySha.get(sourceSha) });
      continue;
    }
    bySha.set(sourceSha, sourceFile);
    try {
      const parsed = readWorkbook(filePath);
      const isCurrent = path.basename(filePath) === currentName;
      await upsertSnapshot({
        sourceFile,
        sourceSha,
        asOf: parseAsOfFromFileName(path.basename(filePath)),
        schemaKind: parsed.schemaKind,
        rows: parsed.rows,
        isCurrent,
      });
      loaded++;
      report.push({
        sourceFile,
        status: "ok",
        rows: parsed.rows.length,
        uniqueCodes: parsed.uniqueCodes,
        schema: parsed.schemaKind,
        isCurrent,
      });
      process.stdout.write(isCurrent ? "C" : ".");
    } catch (e) {
      report.push({
        sourceFile,
        status: "error",
        error: String((e as Error)?.message || e).slice(0, 300),
      });
      process.stdout.write("E");
    }
  }
  console.log("");

  // If no CRU marked, mark newest asOf
  const current = await prisma.tnvedFtsSnapshot.findFirst({ where: { isCurrent: true } });
  if (!current) {
    const newest = await prisma.tnvedFtsSnapshot.findFirst({ orderBy: [{ asOf: "desc" }, { loadedAt: "desc" }] });
    if (newest) {
      await prisma.tnvedFtsSnapshot.update({ where: { id: newest.id }, data: { isCurrent: true } });
    }
  }

  const summary = {
    at: new Date().toISOString(),
    db: dbHint(),
    dir: base,
    files: files.length,
    loaded,
    skippedDup,
    current: currentName,
    report,
  };
  writeFileSync(path.join(outDir, "fts-pr-load-report.json"), JSON.stringify(summary, null, 2));
  console.log(`loaded=${loaded} skippedDup=${skippedDup} report=.tmp-fts-scan/fts-pr-load-report.json`);
  return summary;
}

async function reconcileAndActualize() {
  const snap = await prisma.tnvedFtsSnapshot.findFirst({
    where: { isCurrent: true },
    include: { decisions: { select: { code: true, description: true } } },
  });
  if (!snap) throw new Error("no isCurrent snapshot — run --load first");

  const codes = snap.decisions.map((d) => d.code);
  const uniq = [...new Set(codes)];
  const mainRows = await prisma.tnvedCode.findMany({
    where: { code: { in: uniq } },
    select: { code: true, isActive: true, notes: true },
  });
  const main = new Map(mainRows.map((r) => [r.code, r]));
  const stats = summarizeReconcile({
    currentFile: snap.sourceFile,
    codes,
    main: new Map([...main].map(([k, v]) => [k, { isActive: v.isActive }])),
  });

  // Temporal reclass: same fingerprint different code vs previous current-like CRU
  const prior = await prisma.tnvedFtsSnapshot.findFirst({
    where: { isCurrent: false, sourceFile: { startsWith: "CRU" } },
    orderBy: { asOf: "desc" },
    include: { decisions: { select: { code: true, descFingerprint: true } } },
  });
  const reclass: Array<{ fp: string; from: string; to: string }> = [];
  if (prior) {
    const priorByFp = new Map<string, string>();
    for (const d of prior.decisions) {
      if (!priorByFp.has(d.descFingerprint)) priorByFp.set(d.descFingerprint, d.code);
    }
    const curByFp = new Map<string, string>();
    const curDec = await prisma.tnvedFtsDecision.findMany({
      where: { snapshotId: snap.id },
      select: { code: true, descFingerprint: true },
    });
    for (const d of curDec) {
      if (!curByFp.has(d.descFingerprint)) curByFp.set(d.descFingerprint, d.code);
    }
    for (const [fp, to] of curByFp) {
      const from = priorByFp.get(fp);
      if (from && from !== to) reclass.push({ fp: fp.slice(0, 12), from, to });
    }
  }

  let notesUpdated = 0;
  if (doActualize) {
    // Activate inactive codes that FTS points to
    if (stats.inactiveInMain.length) {
      await prisma.tnvedCode.updateMany({
        where: { code: { in: stats.inactiveInMain } },
        data: { isActive: true },
      });
    }

    const byCode = new Map<string, string[]>();
    for (const d of snap.decisions) {
      const list = byCode.get(d.code) || [];
      list.push(d.description);
      byCode.set(d.code, list);
    }

    for (const [code, descs] of byCode) {
      const row = main.get(code);
      if (!row) continue;
      const tokens: string[] = [];
      const seen = new Set<string>();
      for (const desc of descs) {
        for (const t of tokensFromFtsDescription(desc, 12)) {
          if (seen.has(t)) continue;
          seen.add(t);
          tokens.push(t);
          if (tokens.length >= 40) break;
        }
        if (tokens.length >= 40) break;
      }
      const next = buildFtsPrNotesPatch(row.notes, descs.length, tokens);
      if (!next || next === row.notes) continue;
      await prisma.tnvedCode.update({ where: { code }, data: { notes: next } });
      notesUpdated++;
    }
  }

  const out = {
    at: new Date().toISOString(),
    db: dbHint(),
    snapshot: { id: snap.id, file: snap.sourceFile, rows: snap.rowCount, unique: snap.uniqueCodes },
    reconcile: stats,
    reclassVsPriorCru: reclass,
    actualize: doActualize
      ? { notesUpdated, reactivated: stats.inactiveInMain.length, skippedMissing: stats.missingInMain.length }
      : null,
  };
  writeFileSync(path.join(outDir, "fts-pr-reconcile-report.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  return out;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing (use app/.env)");
  if (!doLoad && !doReconcile && !doActualize) {
    console.log("Usage: npm run tnved:fts-pr -- --dir <path> --load [--reconcile] [--actualize]");
    process.exit(1);
  }
  if (doLoad) await loadDir(dir);
  if (doReconcile || doActualize) await reconcileAndActualize();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
