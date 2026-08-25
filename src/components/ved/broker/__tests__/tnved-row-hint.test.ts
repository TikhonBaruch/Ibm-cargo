import { describe, it, expect } from "vitest";
import { applyTnvedRowHint } from "../types";

describe("applyTnvedRowHint", () => {
  const row = {
    id: "i1",
    name: "Laptop",
    description: "",
    hsCodeAi: "8471300000",
    hsCodeFinal: "8471300000",
    dutyRub: 0,
    vatRub: 0,
    unitPrice: 100_000,
  };

  it("fills duty and VAT from rate hints", () => {
    const patch = applyTnvedRowHint(row, { dutyPct: 10, vatPct: 20 });
    expect(patch.dutyRub).toBe(10_000);
    expect(patch.vatRub).toBe(22_000);
  });

  it("returns empty patch when unit price is zero", () => {
    expect(applyTnvedRowHint({ ...row, unitPrice: 0 }, { dutyPct: 10 })).toEqual({});
  });
});
