import { describe, expect, it } from "vitest";
import {
  coerceVisionDescribePayload,
  formatProductDescriptionForTnved,
} from "../product-vision-describe";

describe("formatProductDescriptionForTnved", () => {
  it("orders type → composition → purpose", () => {
    const text = formatProductDescriptionForTnved(
      "Вяленые ломтики манго ярко-жёлтого цвета в прозрачной упаковке.",
      { material: "манго", composition: "мякоть манго, сахар", purpose: "закуска или десерт" },
      "Вяленые ломтики манго"
    );
    expect(text.indexOf("Вяленые ломтики манго")).toBe(0);
    expect(text.indexOf("Состав:")).toBeGreaterThan(0);
    expect(text.indexOf("Назначение:")).toBeGreaterThan(text.indexOf("Состав:"));
    expect(text).toContain("мякоть манго, сахар");
    expect(text).toContain("закуска или десерт");
  });

  it("does not put purpose first when vision leaked it into description", () => {
    const text = formatProductDescriptionForTnved(
      "употребление в пищу в качестве закуски или десерта. Товар представляет собой вяленые ломтики манго. Состав: мякоть манго, сахар. Назначение: употребление в пищу в качестве закуски или десерта",
      {
        composition: "мякоть манго, сахар",
        purpose: "употребление в пищу в качестве закуски или десерта",
      }
    );
    expect(text.toLowerCase().startsWith("употребление")).toBe(false);
    expect(text.indexOf("Состав:")).toBeGreaterThan(0);
    expect(text.indexOf("Назначение:")).toBeGreaterThan(text.indexOf("Состав:"));
  });

  it("dedupes title when same as description start", () => {
    const text = formatProductDescriptionForTnved("Носки детские", null, "Носки детские");
    expect(text).toBe("Носки детские");
  });
});

describe("coerceVisionDescribePayload (C39)", () => {
  it("unwraps JSON string dumped into description", () => {
    const raw = JSON.stringify({
      description: "Портативный персональный компьютер",
      attrs: {
        material: "Алюминий, стекло, пластик",
        composition: "Металлический корпус",
        purpose: "Для работы с ПО",
      },
    });
    const out = coerceVisionDescribePayload({ description: raw });
    expect(out.description).toBe("Портативный персональный компьютер");
    expect(out.attrs?.material).toMatch(/Алюминий/);
    const text = formatProductDescriptionForTnved(out.description, out.attrs);
    expect(text.startsWith("{")).toBe(false);
    expect(text).toContain("Портативный персональный компьютер");
    expect(text).toContain("Состав:");
  });

  it("passes through plain description unchanged", () => {
    const out = coerceVisionDescribePayload({
      description: "Ноутбук",
      attrs: { purpose: "работа" },
    });
    expect(out.description).toBe("Ноутбук");
    expect(out.attrs?.purpose).toBe("работа");
  });
});
