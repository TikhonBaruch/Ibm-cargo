#!/usr/bin/env node
/**
 * Manual H7 NewCalc chips on prod (Playwright).
 *   node scripts/staging-c21-h7-browser.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.TEST_API_URL || "https://ibm-cargo-phi.vercel.app").replace(/\/$/, "");
const EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const PASS = process.env.CLIENT_PASSWORD || "demo1234";

const CASES = [
  {
    q: "очки",
    expectMeta: /назначение|форма|состав/i,
    expectOptions: [/солнцезащит|корригир|оправ/i],
    secondStep: true,
  },
  { q: "лампочка", expectOptions: [/светодиод|LED|накалив|галоген/i] },
  { q: "hdmi кабель", expectOptions: [/HDMI|USB|питани|силовой|кабел/i] },
  {
    q: "бижутерия",
    expectOptions: [/драг|бижутер|металл|серебр|золот/i],
    secondStep: true,
  },
];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
  const email = page.locator('input[type="email"], input[name="email"]').first();
  const password = page.locator('input[type="password"], input[name="password"]').first();
  await email.fill(EMAIL);
  await password.fill(PASS);
  await page.locator('button[type="submit"], button:has-text("Войти")').first().click();
  await page.waitForURL(/cabinet|client/, { timeout: 45000 }).catch(() => {});
  // Some builds land on /cabinet; force new calc.
  await page.goto(`${BASE}/cabinet/new`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("textarea", { timeout: 30000 });
}

async function runCase(page, row) {
  const ta = page.locator("textarea").first();
  await ta.fill("");
  await ta.fill(row.q);
  await ta.blur();

  // Wait for clarify panel (pack chips or AI).
  const panel = page.locator("text=Уточняем для точности кода");
  await panel.waitFor({ timeout: 25000 });

  const body = await page.locator("body").innerText();
  const hasMeta =
    !row.expectMeta || row.expectMeta.test(body) || /Сначала назначение|Ответьте/i.test(body);
  const hasOpt = row.expectOptions.some((re) => re.test(body));

  let progressiveOk = true;
  if (row.secondStep && hasOpt) {
    // Click first chip/button-like option under clarify.
    const chip = page
      .locator(".field button, .clarify-chip, [role='option'], .chip, label + div button")
      .filter({ hasText: row.expectOptions[0] })
      .first();
    if (await chip.count()) {
      await chip.click();
      await page.waitForTimeout(800);
      const after = await page.locator("body").innerText();
      progressiveOk = /состав|материал|пластик|металл|стекло/i.test(after);
    }
  }

  const ok = hasMeta && hasOpt && progressiveOk;
  console.log(
    `${ok ? "PASS" : "FAIL"}\t${row.q}\tmeta=${hasMeta}\topt=${hasOpt}\tprogressive=${progressiveOk}`,
  );
  if (!ok) {
    const snippet = body
      .split("\n")
      .filter((l) => /уточн|очк|ламп|hdmi|бижут|форм|состав|назнач/i.test(l))
      .slice(0, 12)
      .join(" | ");
    console.log(`  snippet: ${snippet.slice(0, 300)}`);
  }
  return ok;
}

async function main() {
  console.log(`[h7-browser] base=${BASE}`);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || "/snap/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  try {
    await login(page);
    console.log("login + /cabinet/new OK");
    let pass = 0;
    for (const row of CASES) {
      const ok = await runCase(page, row);
      if (ok) pass++;
      // Soft reset description between cases
      await page.goto(`${BASE}/cabinet/new`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("textarea", { timeout: 20000 });
    }
    console.log(`# H7_BROWSER ${pass}/${CASES.length}`);
    process.exit(pass === CASES.length ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
