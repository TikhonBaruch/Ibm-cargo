import { describe, expect, it, afterEach, vi } from "vitest";
import {
  isAllowedMediaUrl,
  isLocalUploadMediaUrl,
  mediaUrlAllowedPrefixes,
} from "../media-url";

describe("media-url allowlist", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows local upload paths", () => {
    expect(isLocalUploadMediaUrl("/uploads/ved/abc-123.jpg")).toBe(true);
    expect(isAllowedMediaUrl("/uploads/ved/abc-123.jpg")).toBe(true);
  });

  it("rejects path traversal and odd local paths", () => {
    expect(isAllowedMediaUrl("/uploads/ved/../secret")).toBe(false);
    expect(isAllowedMediaUrl("/uploads/other/x.jpg")).toBe(false);
    expect(isAllowedMediaUrl("//evil.example/x")).toBe(false);
  });

  it("allows S3 base prefix when configured", () => {
    vi.stubEnv("S3_ENDPOINT", "https://storage.yandexcloud.net");
    vi.stubEnv("S3_BUCKET", "lbm-ved");
    expect(mediaUrlAllowedPrefixes()).toContain("https://storage.yandexcloud.net/lbm-ved/");
    expect(
      isAllowedMediaUrl("https://storage.yandexcloud.net/lbm-ved/ved/uuid.jpg")
    ).toBe(true);
    expect(isAllowedMediaUrl("https://evil.example/lbm-ved/ved/uuid.jpg")).toBe(false);
  });

  it("allows MEDIA_URL_ALLOWED_PREFIXES extras", () => {
    vi.stubEnv("S3_ENDPOINT", "");
    vi.stubEnv("S3_BUCKET", "");
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "https://cdn.example,https://upload.wikimedia.org/x");
    expect(isAllowedMediaUrl("https://cdn.example/a.jpg")).toBe(true);
    expect(isAllowedMediaUrl("https://upload.wikimedia.org/x/foo.jpg")).toBe(true);
    expect(isAllowedMediaUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
  });

  it("rejects absolute URLs when no prefixes configured", () => {
    vi.stubEnv("S3_ENDPOINT", "");
    vi.stubEnv("S3_BUCKET", "");
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "");
    expect(isAllowedMediaUrl("https://cdn.example/a.jpg")).toBe(false);
  });

  it("rejects credentials in URL", () => {
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "https://cdn.example");
    expect(isAllowedMediaUrl("https://user:pass@cdn.example/a.jpg")).toBe(false);
  });
});
