import { describe, it, expect } from "vitest";
import {
  analyzeBrokerDossier,
  buildDossierRequestMessage,
} from "../broker-dossier";

describe("analyzeBrokerDossier", () => {
  it("marks thin when confidence low and attrs empty", () => {
    const a = analyzeBrokerDossier({
      confidence: 0.4,
      hsCode: "84",
      items: [{ name: "Thing", attrs: null }],
    });
    expect(a.thin).toBe(true);
    expect(a.needsComment).toBe(true);
    expect(a.gaps.map((g) => g.id)).toEqual(
      expect.arrayContaining(["low-confidence", "hs-short", "weight", "composition"])
    );
  });

  it("is not thin when weight, composition and high confidence", () => {
    const a = analyzeBrokerDossier({
      confidence: 0.9,
      hsCode: "8471300000",
      items: [
        {
          name: "Laptop",
          attrs: { brand: "Sony", material: "plastic", netWeightKg: 1.2 },
        },
      ],
    });
    expect(a.thin).toBe(false);
    expect(a.gaps.some((g) => g.severity === "critical")).toBe(false);
  });

  it("builds a client-facing request with special flags", () => {
    const a = analyzeBrokerDossier({
      confidence: 0.2,
      items: [{ name: "Kit" }],
    });
    const msg = buildDossierRequestMessage(a, ["engine", "alcohol"]);
    expect(msg).toContain("эталона производителя");
    expect(msg).toContain("двигатель");
    expect(msg).toContain("спирт");
  });
});
