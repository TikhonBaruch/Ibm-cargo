/**
 * Layer G: additional RF measures bound to TN VED prefixes (triggers only).
 */
import { describe, expect, it } from "vitest";
import {
  layerGPrefixesFor,
  layerGToHint,
  matchLayerG,
} from "../tnved-layer-g";
import { assembleTnvedCard } from "../tnved";

describe("layer-G extra fees ↔ TN VED prefixes", () => {
  it("sugar drinks 2202 → excisePossible (not raw sugar 1701)", () => {
    const drink = layerGToHint(matchLayerG("2202100000"));
    expect(drink.excisePossible).toBe(true);
    expect(drink.hits.some((h) => h.group === "sugar-drinks" || h.prefix === "2202")).toBe(true);

    const sugar = layerGToHint(matchLayerG("1701991000"));
    expect(sugar.excisePossible).toBe(false);
  });

  it("alcohol still flags excise; milk does not", () => {
    expect(layerGToHint(matchLayerG("2203000000")).excisePossible).toBe(true);
    expect(layerGToHint(matchLayerG("0401201100")).excisePossible).toBe(false);
  });

  it("data storage / IT → ecoFeePossible, not util sbor", () => {
    for (const code of ["8471705000", "8523511000", "8517620000", "8507600000"]) {
      const h = layerGToHint(matchLayerG(code));
      expect(h.ecoFeePossible, code).toBe(true);
      expect(h.utilSborPossible, code).toBe(false);
    }
  });

  it("batteries / tires / packaging → ecoFeePossible", () => {
    expect(layerGToHint(matchLayerG("8506500000")).ecoFeePossible).toBe(true);
    expect(layerGToHint(matchLayerG("4011100000")).ecoFeePossible).toBe(true);
    expect(layerGToHint(matchLayerG("3923210000")).ecoFeePossible).toBe(true);
  });

  it("apparel / footwear → ecoFeePossible (ROP), not excise", () => {
    const cap = layerGToHint(matchLayerG("6505003000"));
    // 6505 not in apparel 61/62 — no eco from apparel rule; packaging may not apply
    expect(cap.excisePossible).toBe(false);

    const tee = layerGToHint(matchLayerG("6109100000"));
    expect(tee.ecoFeePossible).toBe(true);
    expect(tee.excisePossible).toBe(false);

    const shoes = layerGToHint(matchLayerG("6404110000"));
    expect(shoes.ecoFeePossible).toBe(true);
  });

  it("passenger car still combines excise + util", () => {
    const car = layerGToHint(matchLayerG("8703239029"));
    expect(car.excisePossible).toBe(true);
    expect(car.utilSborPossible).toBe(true);
  });

  it("card envelope exposes ecoFeePossible", () => {
    const card = assembleTnvedCard({
      row: {
        code: "8523511000",
        codeDisplay: "8523 51 100 0",
        titleRu: "носители полупроводниковые твердотельные",
        isLeaf: true,
        level: 10,
        notes: null,
        rates: [],
      },
      ancestors: [],
    });
    expect(card.measuresHint.ecoFeePossible).toBe(true);
    expect(card.measuresHint.excisePossible).toBe(false);
    expect(card.sources.some((s) => s.layer === "G")).toBe(true);
  });

  it("overlay keeps official-only flag set", () => {
    expect(layerGPrefixesFor("excisePossible")).toEqual(
      expect.arrayContaining(["2202", "2208", "2404", "8703"]),
    );
    expect(layerGPrefixesFor("ecoFeePossible")).toEqual(
      expect.arrayContaining(["8471", "8523", "8507", "3923", "61"]),
    );
  });
});
