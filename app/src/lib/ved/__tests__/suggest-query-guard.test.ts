import { describe, expect, it } from "vitest";
import { guardSuggestQuery } from "../precedent-suggest/query-guard";

describe("guardSuggestQuery", () => {
  it("accepts normal product text", () => {
    expect(guardSuggestQuery("кроссовки Nike").ok).toBe(true);
    expect(guardSuggestQuery("носк").ok).toBe(true);
  });

  it("rejects empty and too short", () => {
    expect(guardSuggestQuery("").ok).toBe(false);
    expect(guardSuggestQuery("  ").ok).toBe(false);
    expect(guardSuggestQuery("a").ok).toBe(false);
  });

  it("blocks sql injection patterns", () => {
    expect(guardSuggestQuery("'; DROP TABLE users; --").ok).toBe(false);
    expect(guardSuggestQuery("1 OR 1=1").ok).toBe(false);
    expect(guardSuggestQuery("UNION SELECT password").ok).toBe(false);
    expect(guardSuggestQuery("pg_sleep(5)").ok).toBe(false);
  });

  it("blocks script tags", () => {
    expect(guardSuggestQuery("<script>alert(1)</script>").ok).toBe(false);
  });

  it("truncates via too_long not silently", () => {
    const long = "a".repeat(121);
    expect(guardSuggestQuery(long).ok).toBe(false);
  });
});
