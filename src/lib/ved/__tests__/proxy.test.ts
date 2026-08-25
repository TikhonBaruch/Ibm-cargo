import { afterEach, describe, expect, it, vi } from "vitest";
import {
  stripApiV1Prefix,
  mustStayOnNext,
  isDomainApiEnabled,
  buildDomainHeaders,
  proxyDomainApi,
  forwardDomainResponse,
} from "../proxy";

describe("stripApiV1Prefix", () => {
  it("strips /api/v1 to /v1", () => {
    expect(stripApiV1Prefix("/api/v1/me")).toBe("/v1/me");
    expect(stripApiV1Prefix("/api/v1/calculations/1/pay")).toBe("/v1/calculations/1/pay");
    expect(stripApiV1Prefix("/v1/me")).toBe("/v1/me");
  });
});

describe("mustStayOnNext", () => {
  it("keeps auth uploads imports jobs-tick on Next", () => {
    expect(mustStayOnNext("/api/v1/auth/register")).toBe(true);
    expect(mustStayOnNext("/api/v1/uploads")).toBe(true);
    expect(mustStayOnNext("/api/v1/imports/products/preview")).toBe(true);
    expect(mustStayOnNext("/api/v1/internal/jobs-tick")).toBe(true);
    expect(mustStayOnNext("/api/v1/me")).toBe(false);
  });
});

describe("buildDomainHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets internal key and user headers", () => {
    vi.stubEnv("INTERNAL_API_KEY", "secret");
    const h = buildDomainHeaders({ userId: "u1", role: "CLIENT" });
    expect(h.get("x-internal-key")).toBe("secret");
    expect(h.get("x-user-id")).toBe("u1");
    expect(h.get("x-user-role")).toBe("CLIENT");
  });
});

describe("proxyDomainApi (BFF)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null when USE_DOMAIN_API is off", async () => {
    vi.stubEnv("USE_DOMAIN_API", "0");
    vi.stubEnv("API_SERVICE_URL", "http://api:4000");
    expect(await proxyDomainApi("/v1/me", { userId: "u1" })).toBeNull();
  });

  it("returns 502 Response when fetch throws", async () => {
    vi.stubEnv("USE_DOMAIN_API", "1");
    vi.stubEnv("API_SERVICE_URL", "http://api:4000");
    vi.stubEnv("INTERNAL_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const res = await proxyDomainApi("/v1/me", { userId: "u1", role: "CLIENT" });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(502);
    const body = await res!.json();
    expect(body.error).toBe("Domain API unreachable");
  });

  it("fetches domain when enabled", async () => {
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
    expect(res!.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api:4000/v1/calculations?scope=queue",
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
  });

  it("isDomainApiEnabled requires both flag and URL", () => {
    vi.stubEnv("USE_DOMAIN_API", "1");
    vi.stubEnv("DOMAIN_API_URL", "");
    vi.stubEnv("API_SERVICE_URL", "");
    expect(isDomainApiEnabled()).toBe(false);
    vi.stubEnv("DOMAIN_API_URL", "http://api:4000");
    expect(isDomainApiEnabled()).toBe(true);
  });

  it("forwards HTML via forwardDomainResponse", async () => {
    const proxied = new Response("<html>ok</html>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    const out = await forwardDomainResponse(proxied);
    expect(out.status).toBe(200);
    expect(await out.text()).toBe("<html>ok</html>");
  });
});
