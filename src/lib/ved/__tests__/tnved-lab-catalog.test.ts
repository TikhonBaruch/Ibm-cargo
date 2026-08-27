import { describe, expect, it, vi } from "vitest";
import {
  labCatalogToImportItems,
  labPairToImportItem,
  nearestParentInSet,
  notesByCodeFromLabSearch,
  notesFromSearchTokens,
  tnvedSearchStems,
} from "../tnved-lab-catalog";
import { searchTnvedCodes } from "../tnved";

describe("C18 lab TN VED catalog", () => {
  it("nearestParentInSet skips missing 8-digit and uses 6-digit", () => {
    const present = new Set(["84", "8471", "847130", "8471300000"]);
    expect(nearestParentInSet("8471300000", present)).toBe("847130");
    expect(nearestParentInSet("8471", present)).toBe("84");
    expect(nearestParentInSet("84", present)).toBeNull();
  });

  it("notesFromSearchTokens dedupes and caps length", () => {
    expect(notesFromSearchTokens(["Ноутбук", "ноутбук", "а"])).toBe("ноутбук");
    expect(notesFromSearchTokens(["x".repeat(50)], 20)?.length).toBe(20);
  });

  it("tnvedSearchStems keeps футболк from футболка", () => {
    expect(tnvedSearchStems("футболка")).toEqual(expect.arrayContaining(["футболка", "футболк"]));
    expect(tnvedSearchStems("ноутбук")).toEqual(expect.arrayContaining(["ноутбук"]));
  });

  it("labCatalogToImportItems sorts parents first and omits empty notes", () => {
    const items = labCatalogToImportItems(
      [
        ["8471300000", "портативные машины"],
        ["84", "оборудование"],
        ["8471", "вычислительные машины"],
        ["847130", "портативные"],
      ],
      new Map([["8471300000", ["ноутбук", "laptop"]]]),
    );
    expect(items.map((i) => i.code)).toEqual(["84", "8471", "847130", "8471300000"]);
    expect(items[0].parentCode).toBeNull();
    expect(items[3].parentCode).toBe("847130");
    expect(items[3].notes).toMatch(/ноутбук/);
    expect(items[0].notes).toBeUndefined();
  });

  it("labPairToImportItem maps 10-digit onto existing 4-digit when 6/8 missing", () => {
    const present = new Set(["84", "8471", "8471300000"]);
    const item = labPairToImportItem("8471300000", "ноутбуки", present, "ноутбук");
    expect(item?.parentCode).toBe("8471");
    expect(item?.level).toBe(10);
    expect(item?.isLeaf).toBe(true);
  });

  it("notesByCodeFromLabSearch merges aliases and index tokens", () => {
    const map = notesByCodeFromLabSearch({
      aliases: [{ code: "8471300000", keys: ["ноутбук", "=laptop"] }],
      index: {
        aliasTokens: { ноут: ["8471300000"] },
        entries: [["8471300000", "title", ["портативн"], 1]],
      },
    });
    expect(map.get("8471300000")).toEqual(expect.arrayContaining(["ноутбук", "laptop", "ноут", "портативн"]));
  });

  it("searchTnvedCodes headingOnly lists 4-digit headings in a chapter", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await searchTnvedCodes({ tnvedCode: { findMany } } as never, {
      q: "84",
      headingOnly: true,
      limit: 100,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, level: 4, code: { startsWith: "84" } },
        take: 100,
        orderBy: { code: "asc" },
      }),
    );
  });

  it("searchTnvedCodes empty query does not hit the database", async () => {
    const findMany = vi.fn();
    const rows = await searchTnvedCodes({ tnvedCode: { findMany } } as never, { q: "  " });
    expect(rows).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
