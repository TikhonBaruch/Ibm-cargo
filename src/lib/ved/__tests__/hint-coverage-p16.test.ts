/**
 * Cov-P16: elec / auto / sport / long-tail MISS triggers.
 * Canon: docs/knowledge/plan-hint-gap-probe-run.md §6.4
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";

describe("Cov-P16 — elec packs", () => {
  it.each([
    ["микрофон", "peripherals"],
    ["мышь компьютерная", "peripherals"],
    ["модем", "networking"],
    ["свитч", "networking"],
    ["саундбар", "speakers"],
    ["steam deck", "gaming"],
    ["корпус пк", "pc-parts"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });

  it("bare mouse stays null; POLICY cables stay null", () => {
    expect(matchHintPack("мышь")).toBeNull();
    expect(matchHintPack("переходник")).toBeNull();
    expect(matchHintPack("кабель")).toBeNull();
  });
});

describe("Cov-P16 — auto packs", () => {
  it.each([
    ["свечи зажигания", "auto-parts"],
    ["свеча зажигания", "auto-parts"],
    ["диск тормозной", "auto-parts"],
    ["колесо", "tires"],
    ["зеркала боковые", "auto-body"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });

  it("POLICY bare hose stays null", () => {
    expect(matchHintPack("шланг")).toBeNull();
  });
});

describe("Cov-P16 — sport + long-tail", () => {
  it.each([
    ["лыжи", "sports"],
    ["коньки", "sports"],
    ["ролики", "sports"],
    ["ракетка", "sports"],
    ["фломастер", "stationery"],
    ["бусы", "jewelry"],
    ["кулон", "jewelry"],
    ["гармонь", "musical"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });

  it("false-friends do not steal", () => {
    expect(matchHintPack("видеоролик")).toBeNull();
    expect(matchHintPack("автобусы")).toBeNull();
  });
});

describe("Cov-P16 — industrial ambiguous stay null (POLICY as of P19)", () => {
  it.each(["труба", "арматура"] as const)("%s stays null", (q) => {
    expect(matchHintPack(q)).toBeNull();
  });
});
