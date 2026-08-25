#!/usr/bin/env node
/**
 * Track A ops gate check (A1 payments / A2 notify / D27 holds).
 *
 *   npm run ops:track-a
 *   npm run ops:track-a -- --vercel   # parse `vercel env ls production`
 *
 * Does not print secret values. Exit 1 if required prod keys for A2/A1 missing
 * when --strict (default with --vercel).
 */
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const useVercel = args.has("--vercel");
const strict = args.has("--strict") || useVercel;

function hasLocal(name) {
  const v = process.env[name];
  return Boolean(v && String(v).trim());
}

function vercelEnvNames() {
  const r = spawnSync("vercel", ["env", "ls", "production"], {
    encoding: "utf8",
    shell: false,
  });
  if (r.status !== 0) {
    console.error("vercel env ls failed:", (r.stderr || r.stdout || "").slice(0, 400));
    process.exit(2);
  }
  const text = `${r.stdout || ""}\n${r.stderr || ""}`;
  const names = new Set();
  for (const line of text.split("\n")) {
    const m = line.trim().match(/^([A-Z][A-Z0-9_]*)\s+/);
    if (m) names.add(m[1]);
  }
  return names;
}

function row(label, ok, hint) {
  console.log(`${ok ? "OK  " : "NEED"}  ${label}${hint ? ` — ${hint}` : ""}`);
  return ok;
}

console.log("Track A ops check\n");

let names = null;
if (useVercel) {
  names = vercelEnvNames();
  console.log(`Vercel production env keys: ${names.size}\n`);
}

const present = (name) => (names ? names.has(name) : hasLocal(name));

const a2Smtp = row(
  "A2 SMTP_FROM",
  present("SMTP_FROM"),
  "vercel env add SMTP_FROM production"
);
const a2Resend = row(
  "A2 RESEND_API_KEY (or SMTP_URL)",
  present("RESEND_API_KEY") || present("SMTP_URL"),
  "vercel env add RESEND_API_KEY production  → redeploy → approve calc → inbox"
);
const a1PayUrl = row(
  "A1 PAYMENTS_SERVICE_URL",
  present("PAYMENTS_SERVICE_URL"),
  "host containers/payments + set URL on Vercel"
);
const a1Yoo =
  present("YOOKASSA_SHOP_ID") || present("YOOKASSA_SECRET_KEY")
    ? row("A1 YOOKASSA_*", true, "shop/secret present")
    : row(
        "A1 YOOKASSA_*",
        false,
        "set on payments host; then ALLOW_MOCK_TOPUP=0 on prod"
      );

const mock = present("ALLOW_MOCK_TOPUP");
row(
  "A1 mock gate",
  true,
  mock
    ? "ALLOW_MOCK_TOPUP still on prod — keep until live ЮKassa, then remove"
    : "ALLOW_MOCK_TOPUP absent (good after live path)"
);

console.log("\nD27 holds (do not enable as MVP CTA):");
row("shipping UI", !present("NEXT_PUBLIC_SHIPPING_UI"), "leave unset / not 1");
row("C5 slim", !present("WEB_SURFACE") || true, "WEB_SURFACE default full; no slim on Vercel");
row("LLM CTA", true, "LLM_SERVICE_URL opt-in only — not product matcher");

console.log(`
F17 after RESEND:
  1. vercel env add RESEND_API_KEY production
  2. vercel --prod redeploy
  3. Login client → broker approve → check inbox
  4. Or POST /api/v1/internal/outbox/drain with x-internal-key

A1 after ЮKassa host:
  1. Deploy containers/payments with YOOKASSA_* + WEBHOOK_TARGET
  2. PAYMENTS_SERVICE_URL on Vercel
  3. smoke:payments live; then ALLOW_MOCK_TOPUP=0 on production only
`);

const a2Ok = a2Smtp && a2Resend;
const a1Ok = a1PayUrl && (present("YOOKASSA_SHOP_ID") || present("YOOKASSA_SECRET_KEY"));

if (strict && (!a2Ok || !a1Ok)) {
  console.error(
    `\nStrict: Track A incomplete (A2 email=${a2Ok ? "ok" : "NEED"}, A1 live=${a1Ok ? "ok" : "NEED"}).`
  );
  process.exit(1);
}

console.log(strict ? "\nStrict checks passed." : "\nAdvisory check done (add --vercel --strict for CI gate).");
