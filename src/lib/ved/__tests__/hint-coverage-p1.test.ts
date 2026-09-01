/**
 * Coverage P1: high-traffic trigger gaps (produce / footwear / knit / power / milk).
 * Canon: docs/knowledge/plan-hint-coverage-p0.md §P1
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";

describe("coverage P1 — produce triggers", () => {
  it.each(["овощи", "овощи свежие", "чеснок", "зелень", "укроп", "петрушка", "овощной набор"] as const)(
    "%s → produce-fresh",
    (q) => expect(matchHintPack(q)?.id).toBe("produce-fresh"),
  );

  it("зелёный чай stays tea-coffee (not produce via зелень)", () => {
    expect(matchHintPack("зелёный чай")?.id).toBe("tea-coffee");
  });

  it("фрукты / яблоко do not become produce", () => {
    expect(matchHintPack("фрукты")?.id ?? null).not.toBe("produce-fresh");
    expect(matchHintPack("яблоко")?.id ?? null).not.toBe("produce-fresh");
  });
});

describe("coverage P1 — footwear triggers", () => {
  it.each([
    "сапоги",
    "сапоги зимние",
    "босоножки",
    "тапки",
    "сланцы",
    "кросовки",
    "кроссовки nike",
  ] as const)("%s → footwear", (q) => expect(matchHintPack(q)?.id).toBe("footwear"));
});

describe("coverage P1 — knit-top triggers", () => {
  it.each(["свитер", "свитер мужской", "свитшот", "джемпер", "кардиган", "водолазка", "кофта", "олимпийка"] as const)(
    "%s → knit-top",
    (q) => expect(matchHintPack(q)?.id).toBe("knit-top"),
  );
});

describe("coverage P1 — power triggers", () => {
  it.each([
    "power bank",
    "power-bank",
    "Power Bank",
    "внешний аккумулятор",
    "зарядное устройство",
    "зарядное устройство type-c",
    "провод usb",
  ] as const)("%s → power", (q) => expect(matchHintPack(q)?.id).toBe("power"));
});

describe("coverage P1 — milk triggers", () => {
  it.each(["сметана", "ряженка", "масло сливочное"] as const)("%s → milk", (q) =>
    expect(matchHintPack(q)?.id).toBe("milk"),
  );

  it("подсолнечное масло does not steal milk", () => {
    expect(matchHintPack("масло подсолнечное")?.id ?? null).not.toBe("milk");
  });
});

describe("coverage P1 — computers trigger hygiene", () => {
  it("системный блок → computers", () => {
    expect(matchHintPack("системный блок")?.id).toBe("computers");
  });
});
