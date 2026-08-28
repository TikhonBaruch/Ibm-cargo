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

  it("tnvedSearchStems drops stopwords so фен для волос keeps фен", () => {
    expect(tnvedSearchStems("фен для волос")).toEqual(expect.arrayContaining(["фен", "волос"]));
    expect(tnvedSearchStems("фен для волос")).not.toContain("для");
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
    expect(map.tokens.get("8471300000")).toEqual(
      expect.arrayContaining(["ноутбук", "laptop", "ноут", "портативн"]),
    );
  });

  it("remaps stale index aliases onto official leaves", () => {
    const packed = notesByCodeFromLabSearch({
      index: { aliasTokens: { наушник: ["8518300000"], зарядн: ["8504409008"] } },
    });
    expect(packed.tokens.get("8518309500")).toEqual(expect.arrayContaining(["наушник"]));
    expect(packed.tokens.get("8504405500")).toEqual(expect.arrayContaining(["зарядн"]));
  });

  it("composeLabNotes puts human why above search tokens", () => {
    const packed = notesByCodeFromLabSearch({
      aliases: [{ code: "8471300000", keys: ["ноутбук"], why: "Ноутбуки и аналоги массой не более 10 кг." }],
      synonyms: { "8471300000": "laptop, macbook" },
    });
    const items = labCatalogToImportItems(
      [
        ["84", "оборудование"],
        ["8471300000", "портативные машины"],
      ],
      packed,
    );
    expect(items[1].notes).toMatch(/^Ноутбуки и аналоги/);
    expect(items[1].notes).toMatch(/ноутбук/);
    expect(items[1].notes).toMatch(/laptop/);
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

  it("scoreTnvedSearchHit prefers alias notes over substring titles", async () => {
    const { scoreTnvedSearchHit } = await import("../tnved");
    const polo = scoreTnvedSearchHit(
      { code: "6105100000", titleRu: "Из хлопчатобумажной пряжи", notes: "включая поло.\npolo, поло", isLeaf: true, level: 10 },
      { stems: ["поло"], digits: "" },
    );
    const meat = scoreTnvedSearchHit(
      { code: "0207132000", titleRu: "Половины или четвертины", notes: null, isLeaf: true, level: 10 },
      { stems: ["поло"], digits: "" },
    );
    expect(polo).toBeGreaterThan(meat);
  });

  it("scoreTnvedSearchHit boosts full invoice phrase in notes", async () => {
    const { scoreTnvedSearchHit } = await import("../tnved");
    const dryer = scoreTnvedSearchHit(
      {
        code: "8516310000",
        titleRu: "Сушилки для волос",
        notes: "Электросушилки для волос (фен / hair dryer / 吹风机).\nфен для волос, hair dryer",
        isLeaf: true,
        level: 10,
      },
      { stems: ["фен", "волос"], digits: "", phrase: "фен для волос" },
    );
    const shampoo = scoreTnvedSearchHit(
      {
        code: "3305100000",
        titleRu: "Шампуни",
        notes: null,
        isLeaf: true,
        level: 10,
      },
      { stems: ["фен", "волос"], digits: "", phrase: "фен для волос" },
    );
    expect(dryer).toBeGreaterThan(shampoo);
  });

  it("invoice and FTS 2026 packs only use 2-10 digit codes and known tokens", async () => {
    const invoice = (await import("../tnved-invoice-aliases.json")).default as Array<{
      code: string;
      keys: string[];
    }>;
    const fts = (await import("../tnved-fts-2026-notes.json")).default as Array<{
      code: string;
      keys: string[];
      why: string;
    }>;
    for (const row of [...invoice, ...fts]) {
      expect(row.code).toMatch(/^\d{2,10}$/);
      expect(row.keys.length).toBeGreaterThan(0);
    }
    const packed = notesByCodeFromLabSearch({ aliases: [...invoice, ...fts] });
    expect(packed.tokens.get("8507600000")).toEqual(expect.arrayContaining(["充电宝", "power bank"]));
    expect(packed.tokens.get("6109100000")).toEqual(expect.arrayContaining(["t恤"]));
    expect(packed.why.get("8543400000")?.[0]).toMatch(/8543 40/);
    expect(packed.why.get("8543900000")?.[0]).toMatch(/8543 90/);
    expect(packed.tokens.get("3215110001")).toEqual(expect.arrayContaining(["полиграфическая краска черная"]));
  });
});
