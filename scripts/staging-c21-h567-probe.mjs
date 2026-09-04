#!/usr/bin/env node
/**
 * C21b staging H5–H7 live probe (post-deploy).
 * Canon: docs/knowledge/staging.md §C21b
 *
 *   TEST_API_URL=https://ibm-cargo-phi.vercel.app node scripts/staging-c21-h567-probe.mjs
 */
import "./lib/install-vercel-bypass.mjs";

const OIDC = process.env.VERCEL_OIDC_TOKEN?.trim() || "";
if (OIDC && !globalThis.__lbmOidcBypassInstalled) {
  globalThis.__lbmOidcBypassInstalled = true;
  const orig = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init = {}) => {
    const headers = new Headers(init.headers ?? undefined);
    if (!headers.has("x-vercel-trusted-oidc-idp-token")) {
      headers.set("x-vercel-trusted-oidc-idp-token", OIDC);
    }
    return orig(input, { ...init, headers });
  };
}

const BASE = (process.env.TEST_API_URL || "https://ibm-cargo-phi.vercel.app").replace(/\/$/, "");
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";

const H5 = [
  { q: "очки", prefix: "9004" },
  { q: "носки", prefix: "6115" },
  { q: "морс", prefix: "2202" },
  { q: "HDD", prefix: "8471" },
  { q: "воздушный фильтр", prefix: "8421" },
  { q: "бижутерия", prefix: "7117", altPrefix: "7113" },
];

const H6 = [
  { q: "очки", wantPack: "optics", wantLayer: "A~" },
  { q: "носки", wantPack: "hosiery", wantLayer: "A~" },
  { q: "hdmi кабель", wantPack: "power", wantLayer: "A~" },
  { q: "плащ", wantPack: "outerwear", wantLayer: "A~" },
];

const H7 = [
  { q: "очки", pack: "optics", minSteps: 2, note: "composition after form" },
  { q: "лампочка", pack: "led", minSteps: 1 },
  { q: "hdmi кабель", pack: "power", minSteps: 1 },
  { q: "бижутерия", pack: "jewelry", minSteps: 2, note: "7117 fork" },
];

function cookieJar(res, jar) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login() {
  const jar = new Map();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  cookieJar(csrfRes, jar);
  const { csrfToken } = await csrfRes.json();
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      csrfToken,
      email: CLIENT_EMAIL,
      password: CLIENT_PASSWORD,
      json: "true",
      callbackUrl: `${BASE}/cabinet`,
    }),
    redirect: "manual",
  });
  cookieJar(loginRes, jar);
  if (![200, 302].includes(loginRes.status)) {
    throw new Error(`login failed: ${loginRes.status}`);
  }
  return jar;
}

async function searchTop(jar, q) {
  const res = await fetch(
    `${BASE}/api/v1/tnved/search?q=${encodeURIComponent(q)}&limit=5`,
    { headers: { Cookie: cookieHeader(jar) } },
  );
  if (!res.ok) throw new Error(`search ${q}: ${res.status}`);
  const data = await res.json();
  const codes = (data.items || []).map((i) => String(i.code || "").replace(/\D/g, ""));
  return codes;
}

async function attrSuggest(jar, q) {
  const res = await fetch(`${BASE}/api/v1/calculations/attr-suggest`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader(jar),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description: q }),
  });
  if (!res.ok) throw new Error(`attr-suggest ${q}: ${res.status}`);
  return res.json();
}

function attrLayer(body) {
  const cp = body?.attrs?.extra?.clarifyPack;
  const notes = body?.notes || [];
  const clarifyOnly = notes.some((n) => /clarify-only/i.test(n)) || Boolean(cp);
  if (clarifyOnly || cp) return "A~";
  if (body?.attrs?.hsHint) return "A+";
  if (body?.attrs?.purpose === "уточните назначение товара") return "A0";
  return "A+";
}

async function runH5(jar) {
  console.log("\n## H5 live search");
  let pass = 0;
  for (const row of H5) {
    const codes = await searchTop(jar, row.q);
    const top = codes[0] || "";
    const ok =
      top.startsWith(row.prefix) ||
      (row.altPrefix && top.startsWith(row.altPrefix)) ||
      codes.some(
        (c) =>
          c.startsWith(row.prefix) ||
          (row.altPrefix && c.startsWith(row.altPrefix)),
      );
    console.log(`${ok ? "PASS" : "FAIL"}\t${row.q}\t→\t${top || "-"} (want ${row.prefix}${row.altPrefix ? "/" + row.altPrefix : ""})`);
    if (ok) pass++;
  }
  return { pass, total: H5.length };
}

async function runH6(jar) {
  console.log("\n## H6 live attr-suggest");
  let pass = 0;
  for (const row of H6) {
    const body = await attrSuggest(jar, row.q);
    const pack = body?.attrs?.extra?.clarifyPack ?? null;
    const layer = attrLayer(body);
    const ok = pack === row.wantPack && layer === row.wantLayer;
    console.log(
      `${ok ? "PASS" : "FAIL"}\t${row.q}\tpack=${pack ?? "null"} layer=${layer} (want ${row.wantPack}/${row.wantLayer})`,
    );
    if (ok) pass++;
  }
  return { pass, total: H6.length };
}

async function runH7Offline() {
  console.log("\n## H7 NewCalc chips (domain mirror — local WIP / preview bundle)");
  const { execFileSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const dir = dirname(fileURLToPath(import.meta.url));
  const out = execFileSync("npx", ["tsx", join(dir, "staging-c21-h7-offline.ts")], {
    encoding: "utf8",
    cwd: join(dir, ".."),
  });
  console.log(out.trim());
  const m = out.match(/H7_OFFLINE (\d+)\/(\d+)/);
  return { pass: m ? Number(m[1]) : 0, total: m ? Number(m[2]) : H7.length };
}

async function main() {
  console.log(`[staging-c21-h567] base=${BASE}`);
  const health = await fetch(`${BASE}/health`, { redirect: "manual" });
  const loc = health.headers.get("location") || "";
  if (/vercel\.com\/(sso|login)/i.test(loc)) {
    console.error("SSO_BLOCK — set VERCEL_AUTOMATION_BYPASS_SECRET or use ibm-cargo-phi custom domain");
    process.exit(1);
  }

  const jar = await login();
  console.log("login OK");

  const h5 = await runH5(jar);
  const h6 = await runH6(jar);
  const h7 = await runH7Offline();

  const totalPass = h5.pass + h6.pass + h7.pass;
  const total = h5.total + h6.total + h7.total;
  console.log(`\n# summary H5 ${h5.pass}/${h5.total} · H6 ${h6.pass}/${h6.total} · H7 ${h7.pass}/${h7.total} · total ${totalPass}/${total}`);

  if (totalPass < total) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
