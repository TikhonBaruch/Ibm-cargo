import { beforeAll, describe, expect, it } from "vitest";

const RUN = process.env.RUN_E2E === "1";
const BASE_URL = process.env.TEST_API_URL || "http://127.0.0.1:3000";
const d = RUN ? describe : describe.skip;

let vedDeployed = false;

async function probeVed(): Promise<boolean> {
  const [login, tariffs] = await Promise.all([
    fetch(`${BASE_URL}/login`, { redirect: "manual" }),
    fetch(`${BASE_URL}/api/v1/tariffs`, { redirect: "manual" }),
  ]);
  const loginOk = [200, 302, 307].includes(login.status);
  const tariffsOk = [200, 302, 307, 401].includes(tariffs.status);
  return loginOk && tariffsOk;
}

d("E2E Auth API", () => {
  it("returns CSRF token", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/csrf`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(typeof data.csrfToken).toBe("string");
  });

  it("returns empty session when not authenticated", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.user).toBeUndefined();
  });

  it("rejects invalid credentials without 500", async () => {
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
    const { csrfToken } = await csrfRes.json();
    const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `email=invalid@example.com&password=wrongpassword&csrfToken=${csrfToken}&json=true`,
      redirect: "manual",
    });
    expect(res.status).not.toBe(500);
  });
});

d("E2E Admin API requires auth", () => {
  const endpoints = [
    "/api/admin/posts",
    "/api/admin/users",
    "/api/admin/stats",
    "/api/admin/audit",
  ];
  it("blocks unauthenticated admin GETs", async () => {
    for (const endpoint of endpoints) {
      const res = await fetch(`${BASE_URL}${endpoint}`, { redirect: "manual" });
      expect([307, 401, 403]).toContain(res.status);
    }
  });
});

d("E2E VED API requires auth", () => {
  beforeAll(async () => {
    vedDeployed = await probeVed();
  });

  it("blocks unauthenticated POST /api/v1/calculations", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/calculations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x", description: "yyyyy" }),
      redirect: "manual",
    });
    if (!vedDeployed) {
      // Route missing until VED production deploy
      expect([404, 307, 401, 403]).toContain(res.status);
      return;
    }
    expect([307, 401, 403]).toContain(res.status);
  });

  it("public GET /api/v1/tariffs when VED is live", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/tariffs`, { redirect: "manual" });
    if (!vedDeployed) {
      expect([404, 200, 307, 401]).toContain(res.status);
      return;
    }
    // public gate → 200 JSON; deployment SSO may still 307
    expect([200, 307, 401]).toContain(res.status);
    if (res.status === 200) {
      const ct = res.headers.get("content-type") || "";
      expect(ct).toMatch(/json/i);
    }
  });
});
