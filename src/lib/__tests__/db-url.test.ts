import { describe, expect, it } from "vitest";
import { isMissingDatabaseUrlError, readDatabaseUrl } from "../db-url";
import { webHealthPayload } from "../web-health";

describe("readDatabaseUrl", () => {
  it("reads DATABASE_URL via bracket access and trims", () => {
    expect(readDatabaseUrl({ DATABASE_URL: "  postgres://x  " } as NodeJS.ProcessEnv)).toBe(
      "postgres://x"
    );
  });

  it("returns empty when unset", () => {
    expect(readDatabaseUrl({} as NodeJS.ProcessEnv)).toBe("");
  });
});

describe("isMissingDatabaseUrlError", () => {
  it("matches Prisma schema env error", () => {
    expect(
      isMissingDatabaseUrlError(
        new Error("Environment variable not found: DATABASE_URL.")
      )
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isMissingDatabaseUrlError(new Error("P2025"))).toBe(false);
  });
});

describe("webHealthPayload", () => {
  it("stays ok when DATABASE_URL is missing (liveness)", () => {
    expect(webHealthPayload({} as NodeJS.ProcessEnv)).toEqual({
      ok: true,
      service: "web",
      databaseUrl: false,
    });
  });

  it("reports databaseUrl when the env is set at runtime", () => {
    expect(
      webHealthPayload({ DATABASE_URL: " postgresql://x " } as NodeJS.ProcessEnv).databaseUrl
    ).toBe(true);
  });
});
