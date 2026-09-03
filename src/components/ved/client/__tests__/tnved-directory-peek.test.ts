import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  join(process.cwd(), "src/components/ved/client/TnvedDirectoryPane.tsx"),
  "utf8",
);

describe("TnvedDirectoryPane freemium peek (C38/C39)", () => {
  it("shows explicit free-peek pill and lock CTA", () => {
    expect(src).toContain("1-й просмотр ставки бесплатно");
    expect(src).toContain("1 бесплатный просмотр ставки использован");
    expect(src).toContain("Оплатить и открыть код");
    expect(src).toContain("Нужна оплата");
  });

  it("consumes peek after rates are shown, not on bare pick", () => {
    expect(src).toContain("Consume free peek only after rates are actually shown");
    expect(src).not.toMatch(/function selectHit\([^)]*\) \{\s*setPicked\(h\);\s*if \(!freePeekHs\) consumeFreePeek/);
  });
});
