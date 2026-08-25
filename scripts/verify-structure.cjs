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
  "docs/knowledge/plan-go-live-mvp.md",
  "docs/knowledge/plan-max-standalone-mvp.md",
  "docs/knowledge/plan-full-split-ibm-cargo.md",
  "docs/knowledge/plan-zero-llm-coupling.md",
  "docs/knowledge/plan-taurus-backup-core.md",
  "docs/knowledge/plan-chat-partial.md",
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

// --- AI services documented (D36: LBM-owned, zero nested llm coupling) ---
try {
  const llmReadme = read("containers/llm/README.md");
  if (!llmReadme.includes("LBM-owned") || !llmReadme.includes("D36")) {
    errors.push("containers/llm/README.md must state LBM-owned + D36 (no nested ./llm sync)");
  }
  if (/\bsync:ai-matrix\b/.test(llmReadme) && !/retired|no nested|нулев/i.test(llmReadme)) {
    errors.push("containers/llm/README.md must not promote sync:ai-matrix coupling");
  }
} catch {
  errors.push("cannot read containers/llm/README.md");
}

try {
  const syncStub = read("scripts/sync-ai-matrix.cjs");
  if (!syncStub.includes("RETIRED") || !syncStub.includes("D36")) {
    errors.push("scripts/sync-ai-matrix.cjs must be D36-retired stub (no ./llm copy)");
  }
  if (/copyFileSync|matrixRoot|services\/classification/.test(syncStub)) {
    errors.push("scripts/sync-ai-matrix.cjs must not copy from nested ./llm");
  }
} catch {
  errors.push("cannot read scripts/sync-ai-matrix.cjs");
}

try {
  const compose = read("docker-compose.yml");
  if (compose.includes("TNVED_DATA_DIR:-./llm/") || /TNVED_DATA_DIR:-\.\/llm\//.test(compose)) {
    errors.push("docker-compose.yml must not default TNVED_DATA_DIR to nested ./llm (D36)");
  }
  if (!compose.includes("containers/llm/data/tnved/normalized")) {
    errors.push("docker-compose.yml must default corpus mount to containers/llm/data (D36)");
  }
} catch {
  errors.push("cannot read docker-compose.yml for D36 corpus path");
}

try {
  const packages = read("src/lib/ved/PACKAGES.md");
  for (const needle of ["domain", "orch", "mesh", "llm", "capability"]) {
    if (!packages.includes(needle)) {
      errors.push(`PACKAGES.md missing concept: ${needle}`);
    }
  }
  if (!packages.includes("D36") || !/zero|нулев|HTTP only|только HTTP/i.test(packages)) {
    errors.push("PACKAGES.md must document D36 zero nested-llm coupling");
  }
} catch {
  errors.push("cannot read src/lib/ved/PACKAGES.md");
}

try {
  const { execSync } = require("node:child_process");
  const tracked = execSync("git ls-files llm", {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (tracked) {
    errors.push(
      "nested llm/ must not be git-tracked (D36 full split — remove tree; see plan-full-split-ibm-cargo.md)"
    );
  }
} catch {
  /* not a git checkout — skip */
}

try {
  const decisions = read("docs/knowledge/decisions.md");
  if (!decisions.includes("D35")) errors.push("decisions.md missing D35");
  if (!decisions.includes("D36")) errors.push("decisions.md missing D36");
  if (!decisions.includes("D37")) errors.push("decisions.md missing D37");
  if (!/backup|read-only|не трогать/i.test(decisions)) {
    errors.push("decisions.md D37 must state taurus backup read-only");
  }
  if (!/нулев|zero coupling|nested \.\/llm/i.test(decisions)) {
    errors.push("decisions.md D36 must state zero coupling to nested ./llm");
  }
  if (!decisions.includes("plan-full-split")) {
    errors.push("decisions.md D36 must link plan-full-split-ibm-cargo.md");
  }
} catch {
  errors.push("cannot read decisions.md for D35/D36");
}

try {
  const agents = read("AGENTS.md");
  if (/Канон live LBM:\s*https:\/\/taurus/i.test(agents)) {
    errors.push("AGENTS.md must not list taurus as live canon (D37 backup)");
  }
  if (!/backup|D37|не трогать/i.test(agents)) {
    errors.push("AGENTS.md must document D37 taurus backup read-only");
  }
} catch {
  errors.push("cannot read AGENTS.md for D37");
}

try {
  const dualPath = read("docs/knowledge/dual-path-parity.md");
  if (/llm\/services\/classification/.test(dualPath) || /Matrix source for `sync:ai-matrix`/.test(dualPath)) {
    errors.push("dual-path-parity.md must not reference nested llm/services matrix sync (D36)");
  }
} catch {
  errors.push("cannot read dual-path-parity.md for D36 customs-fees canon");
}

try {
  const dataModel = read("docs/knowledge/data-model.md");
  if (/\| \*\*Corpus lookup\*\* \| `llm\/data\//.test(dataModel)) {
    errors.push("data-model.md corpus path must be containers/llm/data (D36)");
  }
} catch {
  errors.push("cannot read data-model.md for D36 corpus path");
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
