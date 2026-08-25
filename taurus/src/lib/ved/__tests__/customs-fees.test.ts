import { describe, expect, it } from "vitest";
import { customsOperationsFeeRub, DEFAULT_IMPORT_VAT_PERCENT } from "../customs-fees";

describe("customs-fees (PP 1637/1638)", () => {
  it("exposes default VAT 22%", () => {
    expect(DEFAULT_IMPORT_VAT_PERCENT).toBe(22);
  });

  it("maps brackets", () => {
    expect(customsOperationsFeeRub(0)).toBe(1_231);
    expect(customsOperationsFeeRub(200_000)).toBe(1_231);
    expect(customsOperationsFeeRub(200_001)).toBe(2_462);
    expect(customsOperationsFeeRub(1_620_000)).toBe(13_541);
    expect(customsOperationsFeeRub(10_000_000)).toBe(49_240);
    expect(customsOperationsFeeRub(10_000_001)).toBe(73_860);
  });
});
