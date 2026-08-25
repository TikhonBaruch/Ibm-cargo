import { describe, expect, it } from "vitest";
import {
  filterFieldSuggestions,
  fieldSuggestDisplay,
  resolveOriginCountryCode,
} from "../field-suggest";

describe("field-suggest", () => {
  it("matches itemName by prefix and alias", () => {
    const socks = filterFieldSuggestions("itemName", "нос");
    expect(socks.some((e) => e.value === "носки")).toBe(true);

    const auto = filterFieldSuggestions("itemName", "авто");
    expect(auto.some((e) => e.value === "автомобиль")).toBe(true);

    const shoes = filterFieldSuggestions("itemName", "кросо");
    expect(shoes.some((e) => e.value === "кроссовки")).toBe(true);
  });

  it("matches originCountry by code and RU alias", () => {
    const byCode = filterFieldSuggestions("originCountry", "c");
    expect(byCode.some((e) => e.value === "CN")).toBe(true);

    const byRu = filterFieldSuggestions("originCountry", "кит");
    expect(byRu[0]?.value).toBe("CN");
    expect(fieldSuggestDisplay(byRu[0]!)).toMatch(/Китай/);
  });

  it("resolves originCountry alias to ISO-2 without truncating RU input", () => {
    expect(resolveOriginCountryCode("кит")).toBe("CN");
    expect(resolveOriginCountryCode("Китай")).toBe("CN");
    expect(resolveOriginCountryCode("cn")).toBe("CN");
    expect(resolveOriginCountryCode("xyz")).toBeNull();
  });

  it("matches partyDescription and shipCountry while typing", () => {
    const desc = filterFieldSuggestions("partyDescription", "носк");
    expect(desc.some((e) => /носки/i.test(e.value))).toBe(true);

    const ship = filterFieldSuggestions("shipCountry", "кит");
    expect(ship.some((e) => /китай/i.test(e.value))).toBe(true);
  });

  it("returns top-N when query empty", () => {
    const rows = filterFieldSuggestions("material", "", 5);
    expect(rows.length).toBe(5);
  });

  it("ranks prefix hits before substring", () => {
    const rows = filterFieldSuggestions("brand", "sa");
    expect(rows[0]?.value.toLowerCase().startsWith("sa") || rows[0]?.value === "Samsung").toBe(true);
  });
});
