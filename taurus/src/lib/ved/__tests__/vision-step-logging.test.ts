import { afterEach, describe, expect, it, vi } from "vitest";
import { appendVisionTrace } from "../ai-drain-retry";
import { describeWithProviderQwen, fetchMediaAsBase64 } from "../provider-mesh";

describe("fetchMediaAsBase64 diagnostics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns url_blocked for non-allowlisted hosts without calling fetch", async () => {
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "");
    vi.stubEnv("S3_ENDPOINT", "");
    vi.stubEnv("S3_BUCKET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchMediaAsBase64("https://169.254.169.254/latest/meta-data", 5000);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("url_blocked");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns http_error / not_image for 400 HTML (Wikimedia-style)", async () => {
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "https://upload.wikimedia.org");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<!DOCTYPE html><title>Wikimedia Error</title>", {
          status: 400,
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      )
    );
    const r = await fetchMediaAsBase64("https://upload.wikimedia.org/x.jpg", 5000);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
    expect(r.mime).toMatch(/text\/html/);
    expect(r.errorCode).toBe("http_error");
    expect(r.b64).toBeUndefined();
  });

  it("returns ok with bytes for 200 image/jpeg", async () => {
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "https://cdn.example");
    const jpeg = Buffer.alloc(64, 0xff);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(jpeg, { status: 200, headers: { "content-type": "image/jpeg" } })
      )
    );
    const r = await fetchMediaAsBase64("https://cdn.example/a.jpg", 5000);
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.mime).toBe("image/jpeg");
    expect(r.bytes).toBe(64);
    expect(r.b64).toBeTruthy();
  });
});

describe("describeWithProviderQwen step logging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not call Qwen chat when media fetch fails", async () => {
    vi.stubEnv("QWEN_API_KEY", "sk-test");
    vi.stubEnv("QWEN_BASE_URL", "https://dashscope.example/v1");
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "https://upload.wikimedia.org");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("upload.wikimedia")) {
        return new Response("<html>err</html>", {
          status: 400,
          headers: { "content-type": "text/html" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    const out = await describeWithProviderQwen({
      mediaUrl: "https://upload.wikimedia.org/foo.jpg",
      hint: "манго",
      calculationId: "c1",
    });

    expect(out.ok).toBe(false);
    expect(out.fetch?.errorCode).toBe("http_error");
    expect(out.fetch?.status).toBe(400);
    expect(fetchMock.mock.calls.every((c) => !String(c[0]).includes("chat/completions"))).toBe(
      true
    );
    const phases = spy.mock.calls
      .map((c) => {
        try {
          return JSON.parse(String(c[1] || "{}")).phase;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    expect(phases).toContain("vision-fetch");
    expect(phases).not.toContain("vision-qwen-request");
    spy.mockRestore();
  });

  it("calls Qwen when image fetch succeeds", async () => {
    vi.stubEnv("QWEN_API_KEY", "sk-test");
    vi.stubEnv("QWEN_BASE_URL", "https://dashscope.example/v1");
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "https://cdn.example");
    const jpeg = Buffer.alloc(64, 0xaa);
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("cdn.example")) {
        return new Response(jpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
      }
      if (String(url).includes("chat/completions")) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ description: "сушёное манго" }) } }],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    const out = await describeWithProviderQwen({
      mediaUrl: "https://cdn.example/mango.jpg",
      calculationId: "c2",
    });

    expect(out.ok).toBe(true);
    expect(out.description).toMatch(/манго/);
    expect(out.fetch?.ok).toBe(true);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("chat/completions"))).toBe(true);
    const phases = spy.mock.calls
      .map((c) => {
        try {
          return JSON.parse(String(c[1] || "{}")).phase;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    expect(phases).toEqual(
      expect.arrayContaining(["vision-fetch", "vision-qwen-request", "vision-qwen-ok"])
    );
    spy.mockRestore();
  });
});

describe("appendVisionTrace", () => {
  it("keeps at most 8 events and never stores raw urls", () => {
    let draft: Record<string, unknown> = {};
    for (let i = 0; i < 10; i++) {
      draft = appendVisionTrace(draft, { phase: `step-${i}`, ok: true, status: 200 });
    }
    const trace = draft.visionTrace as unknown[];
    expect(trace).toHaveLength(8);
    expect(JSON.stringify(draft)).not.toContain("https://");
  });
});
