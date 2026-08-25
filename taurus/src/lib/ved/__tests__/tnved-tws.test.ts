import { describe, expect, it } from "vitest";
import { mapTwsDutyKind, overlayTwsDuties } from "../tnved-tws";

describe("TWS duty overlay", () => {
  it("maps MIXED to COMBINED and keeps FNS titles", () => {
    expect(mapTwsDutyKind("MIXED")).toBe("COMBINED");
    const { nodes, overlayed, withPct } = overlayTwsDuties(
      [
        { code: "0101210000", isLeaf: true, notes: null, titleRu: "официальное ФНС" },
        { code: "01", isLeaf: false, notes: "группа" },
      ] as Array<{ code: string; isLeaf?: boolean; notes?: string | null; titleRu?: string }>,
      [
        {
          code: "0101210000",
          duty: { dutyKind: "MIXED", dutyPct: 50, note: "50%, но не менее 1 EUR за 1 кг" },
        },
      ]
    );
    expect(overlayed).toBe(1);
    expect(withPct).toBe(1);
    expect(nodes[0]).toMatchObject({
      titleRu: "официальное ФНС",
      rate: { dutyKind: "COMBINED", dutyPct: 50, source: "tws-csv" },
    });
    expect(nodes[0].notes).toMatch(/TWS/);
    expect(nodes[1].rate).toBeUndefined();
  });
});
