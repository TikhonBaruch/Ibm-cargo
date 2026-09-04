import { describe, expect, it } from "vitest";
import {
  TNVED_SEARCH_ALIASES,
  TNVED_SEARCH_ALIAS_DB_LEAVES,
  searchAliasFocusCodes,
  searchAliasesAsSearchExtras,
} from "../tnved-query-match";

describe("search alias → TnvedCode.notes pack", () => {
  it("covers every search alias with at least one leaf", () => {
    for (const alias of TNVED_SEARCH_ALIASES) {
      expect(TNVED_SEARCH_ALIAS_DB_LEAVES[alias.id]?.length, alias.id).toBeGreaterThan(0);
    }
  });

  it("puts бытовые tokens on mors / hdd / laptop leaves (no blockHit text)", () => {
    const extras = searchAliasesAsSearchExtras();
    const mors = extras.get("2202100000");
    expect(mors?.tokens).toEqual(expect.arrayContaining(["морс", "лимонад"]));
    expect(mors?.why.join("\n")).not.toMatch(/blockHit|морск/i);

    const hdd = extras.get("8471705000");
    expect(hdd?.tokens).toEqual(expect.arrayContaining(["hdd", "ssd", "винчестер"]));

    const laptop = extras.get("8471300000");
    expect(laptop?.tokens).toEqual(expect.arrayContaining(["ноутбук", "laptop"]));
    expect(laptop?.tokens.join(" ")).not.toMatch(/бамбук|bamboo/i);
  });

  it("focus codes are digits-only leaves from the map", () => {
    const focus = searchAliasFocusCodes();
    expect(focus).toEqual(expect.arrayContaining(["8471300000", "2202100000"]));
    expect(focus.every((c) => /^\d{10}$/.test(c))).toBe(true);
  });
});
