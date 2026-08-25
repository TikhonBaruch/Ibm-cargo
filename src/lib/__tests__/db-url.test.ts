import { describe, expect, it } from "vitest";
import { isMissingDatabaseUrlError, readDatabaseUrl } from "../db-url";
import { asEnv } from "../test-env";

describe("readDatabaseUrl", () => {
  it("reads DATABASE_URL via bracket access and trims", () => {
    expect(readDatabaseUrl(asEnv({ DATABASE_URL: "  postgres://x  " }))).toBe(
      "postgres://x"
    );
  });

  it("returns empty when unset", () => {
    expect(readDatabaseUrl(asEnv({}))).toBe("");
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
