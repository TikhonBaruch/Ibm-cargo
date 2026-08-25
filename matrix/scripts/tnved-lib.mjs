/**
 * Shared helpers for TN VED corpus scripts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const TNVED_ROOT = path.join(ROOT, "data", "tnved");

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function writeJsonl(file, rows) {
  ensureDir(path.dirname(file));
  const body = rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
  fs.writeFileSync(file, body, "utf8");
}

export function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function fetchText(url, opts = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "kargo-llm-tnved-corpus/0.1 (+https://github.com/local; open-data research)",
      Accept: opts.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(opts.headers || {}),
    },
    signal: AbortSignal.timeout(opts.timeoutMs || 60000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return { text: await res.text(), finalUrl: res.url, contentType: res.headers.get("content-type") || "" };
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip tags lightly for note body snippets. */
export function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export function digitsOnly(code) {
  return String(code || "").replace(/\D/g, "");
}

export function levelFromCode(code) {
  const d = digitsOnly(code);
  if (d.length === 2) return 2;
  if (d.length === 4) return 4;
  if (d.length === 6) return 6;
  if (d.length === 8) return 8;
  if (d.length === 10) return 10;
  return d.length;
}

export function parentCodeOf(code) {
  const d = digitsOnly(code);
  if (d.length <= 2) return null;
  if (d.length === 4) return d.slice(0, 2);
  if (d.length === 6) return d.slice(0, 4);
  if (d.length === 8) return d.slice(0, 6);
  if (d.length === 10) return d.slice(0, 8);
  return null;
}

export function displayCode(code) {
  const d = digitsOnly(code);
  if (d.length === 10) return `${d.slice(0, 4)} ${d.slice(4, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  if (d.length === 8) return `${d.slice(0, 4)} ${d.slice(4, 6)} ${d.slice(6)}`;
  if (d.length === 6) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return d;
}
