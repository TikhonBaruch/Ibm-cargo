import { describe, expect, it } from "vitest";
import {
  MIN_PACK,
  liveCodeForPack,
  namedItemCount,
  packIdForLiveCode,
  resolvePackChrome,
  isPackImageFile,
  isPackSheetFile,
} from "../new-calc-pack";
import type { TariffOption } from "../types";

const tariffs: TariffOption[] = [
  { id: "e", code: "EXPRESS", name: "Экспресс", priceRub: 990, maxPositions: 1 },
  { id: "s", code: "STANDARD", name: "Стандарт", priceRub: 2990, maxPositions: 3 },
  { id: "p", code: "PRO", name: "Профи", priceRub: 5990, maxPositions: 10 },
];

describe("new-calc pack chrome (C11)", () => {
  it("maps mock packs to live D10 codes and caps", () => {
    expect(liveCodeForPack("one")).toBe("EXPRESS");
    expect(liveCodeForPack("m20")).toBe("STANDARD");
    expect(liveCodeForPack("m100")).toBe("PRO");
    expect(packIdForLiveCode("STANDARD")).toBe("m20");
    const std = resolvePackChrome("m20", tariffs);
    expect(std.name).toBe("Стандарт");
    expect(std.max).toBe(3);
    expect(std.priceRub).toBe(2990);
    expect(std.tag).toBe("Мульти до 3");
    expect(std.featured).toBe(true);
  });

  it("counts named lines for MIN_PACK gate", () => {
    expect(MIN_PACK).toBe(2);
    expect(namedItemCount([{ name: "", qty: 1, unitPrice: 0 }])).toBe(0);
    expect(
      namedItemCount([
        { name: "A", qty: 1, unitPrice: 0 },
        { name: "B", qty: 1, unitPrice: 0 },
      ]),
    ).toBe(2);
  });

  it("treats invoice photos as pack files, not only csv/xlsx/pdf", () => {
    expect(isPackSheetFile("inv.csv")).toBe(true);
    expect(isPackSheetFile("photo.jpg")).toBe(false);
    expect(isPackImageFile("photo.jpg")).toBe(true);
    expect(isPackImageFile("scan.PNG")).toBe(true);
    expect(isPackImageFile("x.bin", "image/jpeg")).toBe(true);
    expect(isPackImageFile("notes.csv")).toBe(false);
  });
});
