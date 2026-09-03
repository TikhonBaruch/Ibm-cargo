import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  join(process.cwd(), "src/components/ved/client/NewCalcPane.tsx"),
  "utf8",
);

describe("NewCalcPane photo-first (C36)", () => {
  it("single flow: Фото товара before Наименование, placeholder points above", () => {
    const photo = src.indexOf("Фото товара");
    const name = src.indexOf("Наименование и описание");
    const placeholder = src.indexOf("либо загрузите фото выше");
    const tariffs = src.indexOf("Тариф просчёта кода ТН ВЭД");
    expect(photo).toBeGreaterThan(0);
    expect(name).toBeGreaterThan(photo);
    expect(placeholder).toBeGreaterThan(name);
    expect(tariffs).toBeGreaterThan(placeholder);
    expect(src).toContain("ИИ распознает товар, заполнит описание");
    expect(src).toContain("/api/v1/imports/products/describe");
    expect(src).not.toContain("или загрузите фото ниже");
    expect(src).not.toMatch(/Одна позиция · \{fmtRub/);
  });

  it("C29c: no freemium 0 ₽ chrome on live wizard steps", () => {
    expect(src).not.toContain("1 бесплатно");
    expect(src).not.toContain("Первый просчёт — 0 ₽");
  });

  it("C39: draft HS shows clarifying badge while enriching", () => {
    expect(src).toContain("classificationHeroKicker(selected, aiEnriching)");
    expect(src).toContain("Уточняется");
    expect(src).toContain("Предварительный черновик. Точный код обновится через 1–2 минуты.");
    expect(src).not.toContain("classificationHeroKicker(selected, false)");
  });

  it("describe/preview keep a 120s platform budget so DeepSeek is not killed with a Request ID page", () => {
    const describe = readFileSync(
      join(process.cwd(), "app/api/v1/imports/products/describe/route.ts"),
      "utf8",
    );
    const preview = readFileSync(
      join(process.cwd(), "app/api/v1/imports/products/preview/route.ts"),
      "utf8",
    );
    const uploads = readFileSync(join(process.cwd(), "app/api/v1/uploads/route.ts"), "utf8");
    expect(describe).toContain("export const maxDuration = 120");
    expect(preview).toContain("export const maxDuration = 120");
    expect(uploads).toContain("file.size");
  });
});
