import { beforeAll, describe, expect, it } from "vitest";

const RUN = process.env.RUN_E2E === "1";
const BASE_URL = process.env.TEST_API_URL || "https://taurus-liart.vercel.app";
const d = RUN ? describe : describe.skip;

/** True when production has VED routes (/login + /api/v1). */
let vedDeployed = false;

async function probeVed(): Promise<boolean> {
  const [login, tariffs] = await Promise.all([
    fetch(`${BASE_URL}/login`, { redirect: "manual" }),
    fetch(`${BASE_URL}/api/v1/tariffs`, { redirect: "manual" }),
  ]);
  // VED live: login renders (200) or auth middleware redirects (307/302);
  // tariffs are public GET → 200 JSON, or gated 401/307 — not Next 404 HTML.
  const loginOk = [200, 302, 307].includes(login.status);
  const tariffsOk = [200, 302, 307, 401].includes(tariffs.status);
  return loginOk && tariffsOk;
}

d("E2E Admin page redirects", () => {
  beforeAll(async () => {
    vedDeployed = await probeVed();
  });

  it("redirects unauthenticated user from /admin", async () => {
    const res = await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
    expect([307, 302]).toContain(res.status);
    const loc = res.headers.get("location") || "";
    expect(loc).toMatch(/login/i);
  });

  it.each(["/cabinet", "/broker", "/manufacturer"])(
    "protects %s when VED middleware / layout stubs are deployed",
    async (page) => {
      const res = await fetch(`${BASE_URL}${page}`, { redirect: "manual" });
      if (!vedDeployed) {
        // Pre-VED prod may serve public mock cabinets (200).
        expect([200, 302, 307]).toContain(res.status);
        return;
      }
      expect([302, 307]).toContain(res.status);
      const loc = res.headers.get("location") || "";
      expect(loc).toMatch(/\/login/);
    }
  );

  it("login page is accessible without auth (when VED deployed)", async () => {
    const res = await fetch(`${BASE_URL}/login`, { redirect: "manual" });
    if (!vedDeployed) {
      expect([404, 200, 307]).toContain(res.status);
      return;
    }
    expect([200, 307, 302]).toContain(res.status);
  });
});
