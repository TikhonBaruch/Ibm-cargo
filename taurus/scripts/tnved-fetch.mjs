#!/usr/bin/env node
/**
 * Download official TN VED opendata listed in scripts/data/tnved/manifest.json.
 * Not CI. Not TKS/Alta. Usage: npm run tnved:fetch
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "scripts/data/tnved/manifest.json");
const rawDir = path.join(root, "scripts/data/tnved/raw");

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  await mkdir(rawDir, { recursive: true });
  const force = process.argv.includes("--force");
  for (const src of manifest.sources) {
    if (!src.fetch || !src.url || !src.filename) continue;
    const dest = path.join(rawDir, src.filename);
    process.stdout.write(`fetch ${src.id} ← ${src.url}\n`);
    const res = await fetch(src.url, {
      headers: { "user-agent": "LBM-Broker-tnved-fetch/1 (opendata; not a scraper of commercial HS UIs)" },
    });
    if (!res.ok) {
      throw new Error(`${src.id}: HTTP ${res.status} ${src.url}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const digest = sha256(buf);
    if (src.sha256 && src.sha256 !== digest) {
      const msg = `${src.id}: sha256 mismatch expected ${src.sha256} got ${digest}`;
      if (!force) throw new Error(msg);
      console.warn(msg);
    }
    await writeFile(dest, buf);
    console.log(`  wrote ${path.relative(root, dest)} (${buf.length} bytes) sha256=${digest}`);
    if (src.unzip) {
      const unzip = spawnSync("unzip", ["-o", dest, "-d", rawDir], { encoding: "utf8" });
      if (unzip.status !== 0) {
        throw new Error(`unzip failed: ${unzip.stderr || unzip.stdout}`);
      }
      console.log(`  unzipped into ${path.relative(root, rawDir)}`);
    }
  }
  console.log("done. normalize with: npm run tnved:normalize");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
