#!/usr/bin/env node
/**
 * Structure / ownership gate for VED stability scaffold (D18).
 * Failures exit 2 so CI distinguishes from unit failures (exit 1).
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function walkTsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walkTsFiles(p, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

// --- Knowledge present ---
const knowledgeRequired = [
  "docs/knowledge/README.md",
  "docs/knowledge/decisions.md",
  "docs/knowledge/branches.md",
  "docs/knowledge/skeleton.md",
  "docs/knowledge/testing.md",
  "docs/knowledge/testing-branches.md",
  "docs/knowledge/core-dialogues.md",
  "docs/knowledge/db-process.md",
  "docs/knowledge/data-model.md",
  "docs/knowledge/calculation-fields.md",
  "docs/knowledge/design.md",
  "docs/knowledge/design-baseline.md",
  "docs/knowledge/design-interactive.md",
  "docs/knowledge/design-parity.md",
  "docs/knowledge/design-patterns.md",
  "docs/knowledge/plan-lbm-bro-visual.md",
  "docs/knowledge/environments.md",
  "docs/knowledge/staging.md",
  "docs/knowledge/roadmap.md",
  "docs/knowledge/runbook.md",
  "docs/knowledge/plan-mvp-polish.md",
  "docs/knowledge/plan-track-a-p0.md",
  "docs/knowledge/plan-tech-debt.md",
  "docs/knowledge/plan-cabinets-d32.md",
  "docs/knowledge/plan-consolidate-orders.md",
  "docs/knowledge/feature-cycle.md",
  "docs/knowledge/plan-parallel-ownership.md",
  "docs/knowledge/target-client.md",
  "docs/knowledge/chain-verification.md",
  "docs/knowledge/admin-ops.md",
  "docs/knowledge/dual-path-parity.md",
  "docs/knowledge/deploy.md",
  "docs/knowledge/plan-vercel-services.md",
  "docs/knowledge/containerization.md",
  "docs/knowledge/web-slim.md",
  "docs/knowledge/cabinets/README.md",
  "docs/knowledge/cabinets/ux-saas.md",
  "docs/knowledge/cabinets/ui-guide.md",
  "docs/knowledge/cabinets/admin/schema.md",
  "src/lib/ved/PACKAGES.md",
  "AGENTS.md",
];
for (const f of knowledgeRequired) {
  if (!exists(f)) errors.push(`missing knowledge file: ${f}`);
}

// --- AI matrix mirrors documented ---
try {
  const llmReadme = read("containers/llm/README.md");
  if (!llmReadme.includes("services/classification") || !llmReadme.includes("sync:ai-matrix")) {
    errors.push("containers/llm/README.md must document llm matrix canon + sync:ai-matrix");
  }
} catch {
  errors.push("cannot read containers/llm/README.md");
}
try {
  const packages = read("src/lib/ved/PACKAGES.md");
  for (const needle of ["domain", "orch", "mesh", "llm", "capability"]) {
    if (!packages.includes(needle)) {
      errors.push(`PACKAGES.md missing concept: ${needle}`);
    }
  }
} catch {
  errors.push("cannot read src/lib/ved/PACKAGES.md");
}

try {
  const decisions = read("docs/knowledge/decisions.md");
  if (!decisions.includes("D35")) errors.push("decisions.md missing D35");
} catch {
  errors.push("cannot read decisions.md for D35");
}

// --- Containers layout ---
const containers = ["api", "ai", "worker", "broker", "client", "web", "gateway", "llm", "logistics", "ocr"];
for (const c of containers) {
  if (!exists(`containers/${c}`)) errors.push(`missing container: containers/${c}`);
}

// --- UI ownership ---
if (!exists("src/components/ved/client")) errors.push("missing src/components/ved/client/");
if (!exists("src/components/ved/broker")) errors.push("missing src/components/ved/broker/");
if (!exists("src/components/ved/ClientCabinet.tsx")) errors.push("missing ClientCabinet.tsx");
if (!exists("src/components/ved/BrokerCabinet.tsx")) errors.push("missing BrokerCabinet.tsx");

try {
  const clientCab = read("src/components/ved/ClientCabinet.tsx");
  if (!clientCab.includes("./client/")) {
    errors.push("ClientCabinet must import panes from ./client/");
  }
} catch {
  /* already reported missing */
}

try {
  const brokerCab = read("src/components/ved/BrokerCabinet.tsx");
  if (!brokerCab.includes("./broker/")) {
    errors.push("BrokerCabinet must import panes from ./broker/");
  }
} catch {
  /* already reported missing */
}

// --- Forbidden synthetic item id in src/ ---
const srcRoot = path.join(root, "src");
const srcFiles = walkTsFiles(srcRoot);
const syntheticRe = /id\s*:\s*["']synthetic["']/;
for (const file of srcFiles) {
  // Allow mentions in tests that assert rejection
  const rel = path.relative(root, file);
  if (rel.includes("__tests__") || rel.includes(".test.")) continue;
  const text = fs.readFileSync(file, "utf8");
  if (syntheticRe.test(text)) {
    errors.push(`forbidden synthetic item id in ${rel}`);
  }
}

// --- Protected mutations inventory ---
try {
  const access = read("src/lib/ved/access.ts");
  for (const needle of ["/pay", "/feedback", "/claim", "/approve", "/uploads", "/items", "/shipping", "/chat", "/reclassify"]) {
    if (!access.includes(needle)) {
      errors.push(`PROTECTED_V1_MUTATIONS inventory missing ${needle} in access.ts`);
    }
  }
} catch {
  errors.push("cannot read src/lib/ved/access.ts");
}

// --- Surface extract docs D16/D17/D20 ---
try {
  const decisions = read("docs/knowledge/decisions.md");
  if (!decisions.includes("D16")) errors.push("decisions.md missing D16");
  if (!decisions.includes("D17")) errors.push("decisions.md missing D17");
  if (!decisions.includes("D20")) errors.push("decisions.md missing D20");
  if (!decisions.includes("D32")) errors.push("decisions.md missing D32");
  if (!decisions.includes("D33")) errors.push("decisions.md missing D33");
  if (!decisions.includes("D34")) errors.push("decisions.md missing D34");
} catch {
  errors.push("cannot read decisions.md");
}

// --- No Prisma in UI surface packages ---
for (const surf of ["broker", "client", "admin"]) {
  const pkgPath = `containers/${surf}/package.json`;
  if (!exists(pkgPath)) {
    errors.push(`missing ${pkgPath}`);
    continue;
  }
  const pkg = JSON.parse(read(pkgPath));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps["@prisma/client"] || deps.prisma) {
    errors.push(`${pkgPath} must not depend on Prisma (D16/D17/D20)`);
  }
}

if (!exists("containers/admin/app/page.tsx")) {
  errors.push("missing containers/admin Next app (D20)");
}
if (!exists("src/components/ved/AdminVedCabinet.tsx")) {
  errors.push("missing AdminVedCabinet.tsx");
}

// --- No checked-in dual UI trees (Docker COPY / alias to src/components/ved) ---
for (const surf of ["broker", "client"]) {
  const dual = `containers/${surf}/src/components/ved`;
  if (exists(dual)) {
    errors.push(`forbidden dual UI tree ${dual} — use monorepo src/components/ved (Docker COPY)`);
  }
}

// --- Domain API ledger + shared AI rules (debt map P0/P1) ---
if (!exists("src/lib/ved/ai-draft-rules.json")) {
  errors.push("missing shared AI rules: src/lib/ved/ai-draft-rules.json");
}
try {
  const apiSrc = read("containers/api/src/index.js");
  if (!apiSrc.includes("async function creditCompany")) {
    errors.push("containers/api must define creditCompany (balanceAfter + transaction)");
  }
  if (!apiSrc.includes("balanceAfter")) {
    errors.push("containers/api ledger paths must set balanceAfter");
  }
  for (const needle of ["/items", "/assign", "/escalate", "/reclassify", "/platform/settings", "/brokers/me", "SUPPORT_STATUS"]) {
    if (!apiSrc.includes(needle)) {
      errors.push(`containers/api missing C1 route fragment ${needle}`);
    }
  }
} catch {
  errors.push("cannot read containers/api/src/index.js");
}
try {
  const draftJs = read("containers/ai/src/draft-engine.js");
  if (!draftJs.includes("ai-draft-rules.json")) {
    errors.push("containers/ai draft-engine must load shared ai-draft-rules.json");
  }
} catch {
  errors.push("cannot read containers/ai/src/draft-engine.js");
}

// --- Vercel: Next at repo root + Services (no dashboard-only rootDirectory) ---
try {
  const pkg = JSON.parse(read("package.json"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (!deps.next) {
    errors.push('root package.json must list "next" (Vercel: No Next.js version detected)');
  }
  if (pkg.prisma) {
    errors.push("package.json#prisma is deprecated on Prisma 6.19; seed lives in prisma.config.ts");
  }
  if (!exists("prisma.config.ts")) {
    errors.push("prisma.config.ts required (Prisma 6.19 defineConfig; do not upgrade to Prisma 7)");
  }
  const allow = pkg.allowScripts || {};
  for (const name of ["@prisma/client", "@prisma/engines", "prisma", "sharp", "tesseract.js", "unrs-resolver"]) {
    if (allow[name] !== true) {
      errors.push(`package.json allowScripts must allow ${name} (npm 11.16+ advisory; do not ignore-scripts)`);
    }
  }
  for (const pin of ["sharp@0.34.5", "sharp@0.35.3"]) {
    if (allow[pin] !== true) {
      errors.push(`package.json allowScripts must pin ${pin} (user log 0.34.5 / lockfile 0.35.3)`);
    }
  }
  if (exists("app/package.json")) {
    errors.push("app/package.json must not exist — Vercel Root Directory is repo root, not app/");
  }
  if (exists("app/vercel.json")) {
    errors.push("app/vercel.json must not exist on the root-Next layout (Vercel Root=app → no services declared)");
  }
  const nextCfg = read("next.config.mjs");
  if (/output:\s*["']standalone["']/.test(nextCfg) && !nextCfg.includes("VERCEL")) {
    errors.push("next.config.mjs must gate output:standalone (omit when VERCEL is set; keep for Docker)");
  }
  const vercel = JSON.parse(read("vercel.json"));
  if (Object.prototype.hasOwnProperty.call(vercel, "rootDirectory")) {
    errors.push("vercel.json must not set rootDirectory (invalid; Dashboard Root Directory = .)");
  }
  const fe = vercel.services && vercel.services.frontend;
  if (!fe || fe.framework !== "nextjs" || fe.root !== ".") {
    errors.push('vercel.json services.frontend must be { root: ".", framework: "nextjs" }');
  }
  const be = vercel.services && vercel.services.backend;
  if (!be || be.runtime !== "container" || be.entrypoint !== "Dockerfile.vercel") {
    errors.push("vercel.json services.backend must keep container + Dockerfile.vercel");
  }
} catch (e) {
  errors.push(`cannot validate Vercel root/services: ${e && e.message ? e.message : e}`);
}

// --- Agent rules present (tracked copies; .cursor/ is gitignored — sync via npm run sync:cursor-rules) ---
for (const rule of [
  "docs/knowledge/ved-invariants.mdc",
  "docs/knowledge/ved-ownership.mdc",
  "docs/knowledge/ved-testing.mdc",
  "docs/knowledge/ved-ui-patterns.mdc",
  "docs/knowledge/ved-feature-cycle.mdc",
  "scripts/sync-cursor-rules.cjs",
  "docker-compose.chain-03.yml",
  "docs/knowledge/plan-llm-orch-run-chain.md",
]) {
  if (!exists(rule)) errors.push(`missing rule/artifact: ${rule}`);
}

if (errors.length) {
  console.error("\n✖ test:structure failed:\n");
  for (const e of errors) console.error(`  - ${e}`);
  console.error("");
  process.exit(2);
}

console.log("✔ test:structure OK (ownership, forbidden, docs, surfaces)");
process.exit(0);
