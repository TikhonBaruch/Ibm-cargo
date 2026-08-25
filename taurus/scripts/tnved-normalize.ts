#!/usr/bin/env ts-node
/**
 * Parse FNS TNVED TXT (raw/) → jsonl (gitignored) + demo-pack.json (committed fixture).
 * Usage: npm run tnved:normalize
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import path from "path";
import {
  decodeIbm866,
  parseFnsDumpTexts,
  buildDemoPack,
  TNVED_FNS_SOURCE,
} from "../src/lib/ved/tnved-fns";

const root = path.resolve(__dirname, "..");
const rawDir = path.join(root, "scripts/data/tnved/raw");
const outDir = path.join(root, "scripts/data/tnved/normalized");
const demoPath = path.join(root, "scripts/fixtures/tnved/demo-pack.json");

function findRaw(prefix: string): string {
  const names = readdirSync(rawDir);
  const hit = names.find((n) => n.toUpperCase().startsWith(prefix.toUpperCase()));
  if (!hit) throw new Error(`Missing ${prefix}* in ${rawDir}. Run npm run tnved:fetch`);
  return path.join(rawDir, hit);
}

function main() {
  const asOf = process.env.TNVED_AS_OF || "2026-04-27";
  const tnved2 = decodeIbm866(readFileSync(findRaw("TNVED2")));
  const tnved3 = decodeIbm866(readFileSync(findRaw("TNVED3")));
  const tnved4 = decodeIbm866(readFileSync(findRaw("TNVED4")));
  const nodes = parseFnsDumpTexts({ tnved2, tnved3, tnved4 });
  mkdirSync(outDir, { recursive: true });
  mkdirSync(path.dirname(demoPath), { recursive: true });
  const jsonl = nodes.map((n) => JSON.stringify(n)).join("\n") + "\n";
  const jsonlPath = path.join(outDir, "codes.jsonl");
  writeFileSync(jsonlPath, jsonl);
  const pack = buildDemoPack(nodes, { asOf });
  writeFileSync(demoPath, JSON.stringify(pack, null, 2) + "\n");
  const leaves = nodes.filter((n) => n.isLeaf).length;
  console.log(
    `${TNVED_FNS_SOURCE} nodes=${nodes.length} leaves=${leaves} demoLeaves=${pack.leafCount}`
  );
  console.log(`  jsonl ${path.relative(root, jsonlPath)}`);
  console.log(`  demo  ${path.relative(root, demoPath)}`);
  const laptop = pack.items.find((i) => i.code === "8471300000");
  if (!laptop) throw new Error("demo-pack missing 8471300000");
  if (/ноутбук/i.test(laptop.titleRu) && laptop.titleRu.length < 40) {
    throw new Error("titleRu looks like a marketing stub, not FNS official line");
  }
  if (pack.items.some((i) => /Позиция ТН ВЭД/i.test(i.titleRu))) {
    throw new Error("stub ancestor title leaked into demo-pack");
  }
}

main();
