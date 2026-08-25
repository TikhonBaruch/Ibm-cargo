#!/usr/bin/env node
/**
 * Host-side LLM/OCR/mesh without Docker (Mode B fallback).
 * Canonical with Docker: `npm run docker:scale`.
 *
 *   node scripts/start-mesh.cjs
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(path.join(root, ".env"));

const host = {
  LLM_SERVICE_URL: "http://127.0.0.1:4500",
  OCR_SERVICE_URL: "http://127.0.0.1:4700",
  AI_SERVICE_URL: "http://127.0.0.1:4100",
  API_SERVICE_URL: "http://127.0.0.1:4000",
  WEB_SERVICE_URL: "http://127.0.0.1:3000",
  WEB_ORIGIN: "http://127.0.0.1:3000",
  WEBHOOK_TARGET: "http://127.0.0.1:4000/v1/webhooks/payments",
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  TNVED_CODES_PATH:
    process.env.TNVED_CODES_PATH ||
    path.join(root, "llm/data/tnved/normalized/codes.jsonl"),
};

const services = [
  { name: "llm", port: 4500, file: "containers/llm/src/index.js" },
  { name: "ocr", port: 4700, file: "containers/ocr/src/index.js" },
  { name: "ai", port: 4100, file: "containers/ai/src/index.js" },
  { name: "api", port: 4000, file: "containers/api/src/index.js" },
  { name: "worker", port: 4200, file: "containers/worker/src/index.js" },
  { name: "payments", port: 4300, file: "containers/payments/src/index.js" },
  { name: "notify", port: 4400, file: "containers/notify/src/index.js" },
  { name: "logistics", port: 4600, file: "containers/logistics/src/index.js" },
];

const children = [];

function start(svc) {
  const env = {
    ...process.env,
    ...host,
    PORT: String(svc.port),
  };
  const child = spawn(process.execPath, [path.join(root, svc.file)], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `[${svc.name}]`;
  child.stdout.on("data", (buf) => process.stdout.write(`${prefix} ${buf}`));
  child.stderr.on("data", (buf) => process.stderr.write(`${prefix} ${buf}`));
  child.on("exit", (code, signal) => {
    console.error(`${prefix} exited code=${code} signal=${signal || ""}`);
  });
  children.push(child);
  console.log(`${prefix} starting :${svc.port}`);
}

for (const svc of services) start(svc);

function shutdown(signal) {
  console.log(`[mesh] ${signal} — stopping ${children.length} services`);
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
