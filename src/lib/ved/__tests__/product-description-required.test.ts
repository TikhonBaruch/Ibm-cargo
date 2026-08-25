import { describe, expect, it } from "vitest";
import {
  hasRequiredCreateAttrs,
  missingRequiredCreateAttrs,
} from "../product-description";

describe("required create attrs", () => {
  it("accepts origin + composition; manufacturer is optional (C7)", () => {
    expect(
      hasRequiredCreateAttrs({
        originCountry: "CN",
        composition: "aluminium, plastics, Li-ion battery",
      })
    ).toBe(true);
    expect(
      missingRequiredCreateAttrs({
        originCountry: "CN",
        composition: "Al",
      })
    ).toEqual([]);
    expect(
      missingRequiredCreateAttrs({
        originCountry: "CN",
        manufacturerName: "  ",
        composition: "cotton 100%",
      })
    ).toEqual([]);
  });

  it("still accepts manufacturer when provided", () => {
    expect(
      hasRequiredCreateAttrs({
        originCountry: "CN",
        manufacturerName: "Lenovo PC HK Limited",
        composition: "aluminium, plastics, Li-ion battery",
      })
    ).toBe(true);
  });

  it("rejects missing or short origin / empty composition", () => {
    expect(hasRequiredCreateAttrs({})).toBe(false);
    expect(
      hasRequiredCreateAttrs({ originCountry: "C", manufacturerName: "A", composition: "B" })
    ).toBe(false);
    expect(
      missingRequiredCreateAttrs({
        originCountry: "CN",
        manufacturerName: "Nike",
      })
    ).toEqual(["composition"]);
    expect(missingRequiredCreateAttrs({ composition: "cotton" })).toEqual(["originCountry"]);
  });
});
