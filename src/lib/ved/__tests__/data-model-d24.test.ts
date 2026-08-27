/**
 * D24 — product description, TN VED helpers, calculation event payload.
 */
import { describe, expect, it, vi } from "vitest";
import {
  CALCULATION_EVENT_KINDS,
  calculationEventPayloadSchema,
  statusChangePayload,
  toJsonPayload,
} from "../calculation-events";
import {
  parseProductDescription,
  productAttrsSchema,
  sanitizeProductAttrs,
  fillEmptyProductAttrs,
  brokerFilledAttrKeys,
} from "../product-description";
import {
  formatHsCode,
  hsCodeAncestors,
  isValidHsCodeShape,
  normalizeHsCode,
  parentHsCode,
  buildTnvedImportItem,
  parseTnvedCsv,
  tnvedSearchStems,
} from "../tnved";

describe("D24 product description", () => {
  it("parses structured attrs and rejects unknown keys", () => {
    expect(
      productAttrsSchema.parse({
        brand: "Lenovo",
        originCountry: "CN",
        netWeightKg: 1.4,
      })
    ).toEqual({ brand: "Lenovo", originCountry: "CN", netWeightKg: 1.4 });
    expect(productAttrsSchema.safeParse({ brand: "X", unknown: 1 }).success).toBe(false);
  });

  it("sanitize drops invalid / empty", () => {
    expect(sanitizeProductAttrs({ brand: "A" })).toEqual({ brand: "A" });
    expect(sanitizeProductAttrs({ brand: "" })).toBeUndefined();
    expect(sanitizeProductAttrs(null)).toBeUndefined();
  });

  it("fillEmptyProductAttrs never overwrites existing client/factory values", () => {
    const merged = fillEmptyProductAttrs(
      { brand: "Lenovo" },
      { brand: "Hacked", netWeightKg: 1.8, material: "ABS" }
    );
    expect(merged).toEqual({ brand: "Lenovo", netWeightKg: 1.8, material: "ABS" });
    expect(brokerFilledAttrKeys({ brand: "Lenovo" }, merged)).toEqual([
      "material",
      "netWeightKg",
    ]);
  });

  it("fillEmptyProductAttrs only adds missing extra keys", () => {
    expect(
      fillEmptyProductAttrs(
        { extra: { sku: "A1" } },
        { extra: { sku: "B2", volume: "0.1" } }
      )
    ).toEqual({ extra: { sku: "A1", volume: "0.1" } });
  });

  it("productDescription requires name", () => {
    expect(parseProductDescription({ name: "Laptop", qty: 2 }).name).toBe("Laptop");
    expect(parseProductDescription({ name: "Laptop" }).currency).toBe("USD");
    expect(() => parseProductDescription({ description: "x" })).toThrow();
  });
});

describe("D24 TN VED helpers", () => {
  it("normalizes and formats 10-digit codes", () => {
    expect(normalizeHsCode("8471 30 000 0")).toBe("8471300000");
    expect(formatHsCode("8471300000")).toBe("8471 30 000 0");
    expect(normalizeHsCode("8471")).toBe("8471");
    expect(normalizeHsCode("123")).toBeNull();
    expect(isValidHsCodeShape("8517 13 000 0")).toBe(true);
  });

  it("parent + ancestor chain for tree insert", () => {
    expect(parentHsCode("8471300000")).toBe("84713000");
    expect(hsCodeAncestors("8471 30 000 0")).toEqual([
      "84",
      "8471",
      "847130",
      "84713000",
      "8471300000",
    ]);
  });

  it("searchTnvedCodes builds OR on title, notes, and code prefix", async () => {
    const findMany = vi.fn().mockResolvedValue([{ code: "8471" }]);
    const { searchTnvedCodes } = await import("../tnved");
    await searchTnvedCodes({ tnvedCode: { findMany } } as never, { q: "8471", limit: 10 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: expect.arrayContaining([
            { code: { startsWith: "8471" } },
            { titleRu: { contains: "8471", mode: "insensitive" } },
            { notes: { contains: "8471", mode: "insensitive" } },
          ]),
        }),
        take: 40,
      })
    );
  });

  it("tnvedSearchStems stems household queries", () => {
    expect(tnvedSearchStems("футболка")).toContain("футболк");
  });

  it("getTnvedByCode normalizes display form", async () => {
    const findUnique = vi.fn().mockResolvedValue({ code: "8471300000" });
    const { getTnvedByCode } = await import("../tnved");
    await getTnvedByCode({ tnvedCode: { findUnique } } as never, "8471 30 000 0");
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "8471300000" } })
    );
  });

  it("buildTnvedImportItem derives level and optional rate", () => {
    const item = buildTnvedImportItem({
      code: "8471 30 000 0",
      titleRu: "Ноутбуки",
      dutyPct: 0,
      vatPct: 20,
    });
    expect(item.code).toBe("8471300000");
    expect(item.level).toBe(10);
    expect(item.parentCode).toBe("84713000");
    expect(item.isLeaf).toBe(true);
    expect(item.rate).toMatchObject({ dutyPct: 0, vatPct: 20, dutyKind: "AD_VALOREM" });
  });

  it("parseTnvedCsv reads header and reports bad rows", () => {
    const { items, errors } = parseTnvedCsv(
      "code,titleRu,dutyPct,vatPct\n8471300000,Portable,0,20\nbad,Only title\n"
    );
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe("8471300000");
    expect(errors.some((e) => e.message.includes("Некорректный код"))).toBe(true);
  });
});

describe("D24 calculation events", () => {
  it("exposes lifecycle kinds and strict payload", () => {
    expect(CALCULATION_EVENT_KINDS).toContain("CREATED");
    expect(CALCULATION_EVENT_KINDS).toContain("APPROVED");
    expect(statusChangePayload("AI_READY", "QUEUED")).toEqual({ from: "AI_READY", to: "QUEUED" });
    expect(calculationEventPayloadSchema.safeParse({ from: "A", extra: 1 }).success).toBe(false);
  });

  it("strips undefined fields so Prisma JSON accepts ITEM_MAPPED payloads", () => {
    const jsonSafe = toJsonPayload({
      items: [{ id: "i1", hsCodeFinal: "8471 30 000 0", dutyRub: undefined, vatRub: 10 }],
    });
    expect(jsonSafe).toEqual({
      items: [{ id: "i1", hsCodeFinal: "8471 30 000 0", vatRub: 10 }],
    });
  });

  it("listCalculationEvents orders ascending", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { listCalculationEvents } = await import("../calculation-events");
    await listCalculationEvents({ calculationEvent: { findMany } } as never, "calc-1");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { calculationId: "calc-1" },
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { id: true, name: true, role: true } } },
      })
    );
  });
});

describe("D24 HS roundtrip for seed leaves", () => {
  it("normalizes heuristic display codes to 10 digits and back", () => {
    const leaves = [
      "8471 30 000 0",
      "8517 13 000 0",
      "6203 42 310 0",
      "8708 99 970 9",
      "3208 90 910 0",
      "1806 90 190 0",
      "9403 60 900 0",
      "8504 40 820 0",
      "8471 60 700 0",
    ];
    for (const d of leaves) {
      const n = normalizeHsCode(d);
      expect(n).toHaveLength(10);
      expect(formatHsCode(n!)).toBe(d);
      expect(hsCodeAncestors(d)).toHaveLength(5);
    }
  });
});
