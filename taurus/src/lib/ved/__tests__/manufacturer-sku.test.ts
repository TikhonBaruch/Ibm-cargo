import { describe, expect, it, vi } from "vitest";
import {
  manufacturerSkuInputSchema,
  skuToClientPreview,
  createManufacturerSku,
  assertManufacturerRole,
  hydrateItemsWithPublishedSkus,
  listPublishedCatalogSkus,
} from "../manufacturer-sku";
import { overlayProductAttrs } from "../product-description";

describe("D31 manufacturer SKU schema", () => {
  it("accepts physical + feature + packaging payload", () => {
    const parsed = manufacturerSkuInputSchema.parse({
      sku: "NB-1",
      name: "Ноутбук",
      netWeightKg: 1.4,
      grossWeightKg: 2.1,
      volumeM3: 0.008,
      lengthMm: 318,
      widthMm: 218,
      heightMm: 18,
      originCountry: "cn",
      features: [
        { kind: "BATTERY", value: "52", unit: "Wh", separatelyDeclared: false },
        { kind: "ENGINE", value: "1.6", unit: "L", separatelyDeclared: true },
      ],
      packagings: [
        { level: "MASTER", packType: "carton", qtyPerParent: 5, lengthMm: 400, weightKg: 12 },
        { level: "PALLET", packType: "euro_pallet", lengthMm: 1200, widthMm: 800 },
      ],
    });
    expect(parsed.originCountry).toBe("CN");
    expect(parsed.features).toHaveLength(2);
    expect(parsed.features?.[1].separatelyDeclared).toBe(true);
    expect(parsed.packagings?.[1].level).toBe("PALLET");
  });

  it("rejects unknown feature kind", () => {
    expect(
      manufacturerSkuInputSchema.safeParse({
        sku: "X",
        name: "Y",
        features: [{ kind: "MAGIC" }],
      }).success
    ).toBe(false);
  });

  it("maps SKU to client attrs snapshot without inventing HS", () => {
    const preview = skuToClientPreview({
      sku: "NB-1",
      name: "Ноутбук",
      brand: "Lenovo",
      netWeightKg: 1.4,
      originCountry: "CN",
      hsHint: "8471",
    });
    expect(preview.name).toBe("Ноутбук");
    expect(preview.attrs?.brand).toBe("Lenovo");
    expect(preview.attrs?.netWeightKg).toBe(1.4);
    expect(preview.attrs?.extra?.sku).toBe("NB-1");
    expect(preview.attrs).not.toHaveProperty("hsCodeFinal");
  });
});

describe("D31 manufacturer RBAC helpers", () => {
  it("allows MANUFACTURER and staff, rejects CLIENT", () => {
    expect(() => assertManufacturerRole("MANUFACTURER")).not.toThrow();
    expect(() => assertManufacturerRole("ADMIN")).not.toThrow();
    expect(() => assertManufacturerRole("CLIENT")).toThrow(/Forbidden/);
    expect(() => assertManufacturerRole("BROKER")).toThrow(/Forbidden/);
  });

  it("createManufacturerSku writes company-scoped row and rejects duplicate sku", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "s1",
      companyId: "c1",
      sku: "NB-1",
      name: "Ноутбук",
      status: "DRAFT",
      version: 1,
    });
    const findFirst = vi.fn().mockResolvedValueOnce(null);
    const db = {
      manufacturerSku: { create, findFirst, findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
      calculationItem: { count: vi.fn().mockResolvedValue(0) },
      company: { findUnique: vi.fn(), create: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
    };
    const row = await createManufacturerSku(db, "c1", { sku: "NB-1", name: "Ноутбук" });
    expect(create).toHaveBeenCalled();
    expect(row.clientPreview.name).toBe("Ноутбук");

    findFirst.mockResolvedValueOnce({ id: "existing" });
    await expect(createManufacturerSku(db, "c1", { sku: "NB-1", name: "Ноутбук" })).rejects.toThrow(
      /already exists/
    );
  });
});

describe("C2 published catalog snapshot", () => {
  it("overlayProductAttrs lets client fields win and merges extra", () => {
    const merged = overlayProductAttrs(
      { brand: "Lenovo", extra: { sku: "NB-1" } },
      { brand: "ClientBrand", extra: { gtin: "123" } }
    );
    expect(merged?.brand).toBe("ClientBrand");
    expect(merged?.extra?.sku).toBe("NB-1");
    expect(merged?.extra?.gtin).toBe("123");
  });

  it("listPublishedCatalogSkus omits draft and strips company to id+name", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "s1",
        companyId: "c1",
        sku: "NB-1",
        name: "Ноутбук",
        brand: "Lenovo",
        status: "PUBLISHED",
        company: { id: "c1", name: "Factory" },
      },
    ]);
    const db = {
      manufacturerSku: {
        findMany,
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      calculationItem: { count: vi.fn() },
      company: { findUnique: vi.fn(), create: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
    };
    const rows = await listPublishedCatalogSkus(db);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PUBLISHED" } })
    );
    expect(rows[0]?.company).toEqual({ id: "c1", name: "Factory" });
    expect(rows[0]?.clientPreview.attrs?.brand).toBe("Lenovo");
  });

  it("hydrateItemsWithPublishedSkus snapshots attrs and rejects missing SKU", async () => {
    const published = {
      id: "s1",
      companyId: "c1",
      sku: "NB-1",
      name: "Ноутбук ThinkPad",
      brand: "Lenovo",
      originCountry: "CN",
      netWeightKg: 1.4,
      status: "PUBLISHED",
    };
    const findFirst = vi.fn().mockResolvedValueOnce(published).mockResolvedValueOnce(null);
    const db = {
      manufacturerSku: {
        findMany: vi.fn(),
        findFirst,
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      calculationItem: { count: vi.fn() },
      company: { findUnique: vi.fn(), create: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
    };
    const [hydrated] = await hydrateItemsWithPublishedSkus(db, [
      { name: "", manufacturerSkuId: "s1", attrs: { brand: "MyBrand" } },
    ]);
    expect(hydrated.name).toBe("Ноутбук ThinkPad");
    expect(hydrated.attrs?.brand).toBe("MyBrand");
    expect(hydrated.attrs?.originCountry).toBe("CN");
    expect(hydrated.attrs?.extra?.sku).toBe("NB-1");
    expect(hydrated.manufacturerSkuId).toBe("s1");

    await expect(
      hydrateItemsWithPublishedSkus(db, [{ name: "X", manufacturerSkuId: "missing" }])
    ).rejects.toThrow(/Published SKU not found/);
  });
});
