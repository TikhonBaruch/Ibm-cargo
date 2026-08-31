/**
 * Coverage P6: rugs/sports/camping/umbrellas/optics/med/pet-acc/displays/printers/peripherals/auto/security + toys lego.
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";

describe("coverage P6 — open sections after P5", () => {
  it.each([
    ["ковёр", "rugs"],
    ["коврик", "rugs"],
    ["мяч", "sports"],
    ["гантель", "sports"],
    ["палатка", "camping"],
    ["спальный мешок", "camping"],
    ["зонт", "umbrellas"],
    ["очки", "optics"],
    ["шприц", "med-disposables"],
    ["бинт", "med-disposables"],
    ["ошейник", "pet-accessories"],
    ["наполнитель для лотка", "pet-accessories"],
    ["телевизор", "displays"],
    ["монитор", "displays"],
    ["принтер", "printers"],
    ["сканер", "printers"],
    ["клавиатура", "peripherals"],
    ["фильтр масляный", "auto-parts"],
    ["подшипник", "auto-parts"],
    ["камера видеонаблюдения", "security-cam"],
    ["лего", "toys"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });

  it("steal guards across P6", () => {
    expect(matchHintPack("ноутбук")?.id).toBe("computers");
    expect(matchHintPack("наушники")?.id).toBe("headphones");
    expect(matchHintPack("корм для кошек")?.id).toBe("pet-food");
    expect(matchHintPack("кот")).toBeNull();
    expect(matchHintPack("мышь")).toBeNull();
    expect(matchHintPack("шина")?.id).toBe("tires");
    expect(matchHintPack("камера")).toBeNull(); // bare ≠ security-cam
  });
});
