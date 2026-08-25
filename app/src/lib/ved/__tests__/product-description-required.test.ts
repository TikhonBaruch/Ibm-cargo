import { describe, expect, it } from "vitest";
import {
  hasRequiredCreateAttrs,
  missingRequiredCreateAttrs,
} from "../product-description";

describe("required create attrs", () => {
  it("accepts complete origin + manufacturer + composition", () => {
    expect(
      hasRequiredCreateAttrs({
        originCountry: "CN",
        manufacturerName: "Lenovo PC HK Limited",
        composition: "aluminium, plastics, Li-ion battery",
      })
    ).toBe(true);
    expect(
      missingRequiredCreateAttrs({
        originCountry: "CN",
        manufacturerName: "Lenovo",
        composition: "Al",
      })
    ).toEqual([]);
  });

  it("rejects missing or short origin / empty manufacturer / composition", () => {
    expect(hasRequiredCreateAttrs({})).toBe(false);
    expect(
      hasRequiredCreateAttrs({ originCountry: "C", manufacturerName: "A", composition: "B" })
    ).toBe(false);
    expect(
      missingRequiredCreateAttrs({
        originCountry: "CN",
        manufacturerName: "  ",
        composition: "cotton 100%",
      })
    ).toEqual(["manufacturerName"]);
    expect(
      missingRequiredCreateAttrs({
        originCountry: "CN",
        manufacturerName: "Nike",
      })
    ).toEqual(["composition"]);
  });
});
