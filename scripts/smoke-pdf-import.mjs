#!/usr/bin/env node
/**
 * Smoke: PDF table import preview (text-layer PDF → same classify pipeline).
 *   TEST_API_URL=http://localhost:3000 node scripts/smoke-pdf-import.mjs
 */
import "./lib/install-vercel-bypass.mjs";
import { PDFDocument, StandardFonts } from "pdf-lib";

const BASE = process.env.TEST_API_URL || "http://localhost:3000";
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";

function cookieJar(res, jar) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}
function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(email, password) {
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
      email,
      password,
      callbackUrl: `${BASE}/cabinet`,
      json: "true",
    }),
    redirect: "manual",
  });
  cookieJar(loginRes, jar);
  return jar;
}

async function buildPdfBase64() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 220]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = [
    "Invoice demo",
    "Naimenovanie;Cena",
    "MacBook Pro;2000",
    "iPhone 15;800",
  ];
  let y = 180;
  for (const line of lines) {
    page.drawText(line, { x: 24, y, size: 12, font });
    y -= 22;
  }
  const bytes = await doc.save();
  return Buffer.from(bytes).toString("base64");
}

async function main() {
  console.log(`PDF import smoke → ${BASE}`);
  const jar = await login(CLIENT_EMAIL, CLIENT_PASSWORD);
  console.log(" 1. Login OK");
  const pdfBase64 = await buildPdfBase64();
  const res = await fetch(`${BASE}/api/v1/imports/products/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(jar),
    },
    body: JSON.stringify({
      pdfBase64,
      filename: "invoice-demo.pdf",
      tariffCode: "STANDARD",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`preview ${res.status}: ${JSON.stringify(data)}`);
  console.log(
    ` 2. Preview ${data.rowCount} rows — first=${data.rows?.[0]?.name} hs=${data.rows?.[0]?.hsCode || "—"}`
  );
  if (!data.rowCount || data.rowCount < 1) {
    throw new Error("expected ≥1 product row from PDF");
  }
  if (!/macbook/i.test(data.rows[0]?.name || "")) {
    throw new Error(`unexpected first name: ${data.rows[0]?.name}`);
  }
  console.log("\n✅ PDF import smoke OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
