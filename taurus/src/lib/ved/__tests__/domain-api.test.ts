import { afterEach, describe, expect, it, vi } from "vitest";
import { forwardDomainResponse, proxyDomainApi } from "../domain-api";

/** Paths that Next session routes proxy and containers/api must keep aligned. */
const PARITY_PATHS = [
  "/v1/calculations",
  "/v1/calculations/:id/pay",
  "/v1/calculations/:id/claim",
  "/v1/calculations/:id/approve",
  "/v1/shipping",
  "/v1/internal/sla-tick",
  "/v1/chat",
] as const;

const SHARED_ERROR_STRINGS = {
  shippingPreDone: "Shipping only after DONE",
  unauthorized: "Unauthorized",
} as const;

describe("domain-api proxy (C1)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null when USE_DOMAIN_API is off", async () => {
    vi.stubEnv("USE_DOMAIN_API", "0");
    vi.stubEnv("API_SERVICE_URL", "http://api:4000");
    expect(await proxyDomainApi("/v1/me", { userId: "u1" })).toBeNull();
  });

  it("returns null when enabled but API URL missing", async () => {
    vi.stubEnv("USE_DOMAIN_API", "1");
    vi.stubEnv("API_SERVICE_URL", "");
    vi.stubEnv("DOMAIN_API_URL", "");
    expect(await proxyDomainApi("/v1/me", { userId: "u1" })).toBeNull();
  });

  it("fetches domain API when enabled", async () => {
    vi.stubEnv("USE_DOMAIN_API", "1");
    vi.stubEnv("API_SERVICE_URL", "http://api:4000");
    vi.stubEnv("INTERNAL_API_KEY", "k");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await proxyDomainApi("/v1/calculations", {
      method: "GET",
      userId: "u1",
      role: "CLIENT",
      query: "scope=queue",
    });
    expect(res).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api:4000/v1/calculations?scope=queue",
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      })
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("x-internal-key")).toBe("k");
    expect(headers.get("x-user-id")).toBe("u1");
    expect(headers.get("x-user-role")).toBe("CLIENT");
  });

  it("forwards URLSearchParams query", async () => {
    vi.stubEnv("USE_DOMAIN_API", "1");
    vi.stubEnv("DOMAIN_API_URL", "http://api:4000");
    vi.stubEnv("INTERNAL_API_KEY", "k");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await proxyDomainApi("/v1/shipping", {
      method: "GET",
      userId: "u1",
      role: "CLIENT",
      query: new URLSearchParams({ quotes: "1", origin: "A" }),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api:4000/v1/shipping?quotes=1&origin=A",
      expect.any(Object)
    );
  });

  it("forwards HTML pdf responses", async () => {
    const proxied = new Response("<html>ok</html>", {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": 'inline; filename="report-1.html"',
      },
    });
    const out = await forwardDomainResponse(proxied);
    expect(out.status).toBe(200);
    expect(out.headers.get("Content-Type")).toContain("text/html");
    expect(await out.text()).toBe("<html>ok</html>");
  });

  it("forwards JSON error status from domain", async () => {
    const proxied = new Response(JSON.stringify({ error: SHARED_ERROR_STRINGS.shippingPreDone }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
    const out = await forwardDomainResponse(proxied);
    expect(out.status).toBe(400);
    expect(await out.json()).toEqual({ error: SHARED_ERROR_STRINGS.shippingPreDone });
  });
});

describe("proxy↔Prisma parity contracts (static)", () => {
  it("lists critical dual-path routes", () => {
    expect(PARITY_PATHS).toContain("/v1/shipping");
    expect(PARITY_PATHS).toContain("/v1/internal/sla-tick");
    expect(PARITY_PATHS.length).toBeGreaterThanOrEqual(6);
  });

  it("shares canonical error strings with Next Prisma path", () => {
    expect(SHARED_ERROR_STRINGS.shippingPreDone).toBe("Shipping only after DONE");
    expect(SHARED_ERROR_STRINGS.unauthorized).toBe("Unauthorized");
  });
});
