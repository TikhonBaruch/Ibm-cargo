/**
 * Manufacturer SKU catalog (D31). Separate from CalculationItem (D15/D24):
 * factory master-data lives here; CLIENT create snapshots PUBLISHED rows into attrs + manufacturerSkuId.
 */
import { z } from "zod";
import {
  overlayProductAttrs,
  sanitizeProductAttrs,
  type ProductAttrs,
} from "./product-description";

export const MANUFACTURER_SKU_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type ManufacturerSkuStatus = (typeof MANUFACTURER_SKU_STATUSES)[number];

export const SKU_FEATURE_KINDS = [
  "COMPOSITION",
  "ALCOHOL",
  "ENGINE",
  "BATTERY",
  "RADIO",
  "PRECIOUS",
  "SOFTWARE",
  "CITES",
  "SPARE_PART",
  "KIT_COMPONENT",
  "OTHER",
] as const;
export type SkuFeatureKind = (typeof SKU_FEATURE_KINDS)[number];

export const SKU_PACK_LEVELS = ["UNIT", "INNER", "MASTER", "PALLET", "CONTAINER"] as const;
export type SkuPackLevel = (typeof SKU_PACK_LEVELS)[number];

export const skuFeatureSchema = z
  .object({
    kind: z.enum(SKU_FEATURE_KINDS),
    label: z.string().trim().max(200).optional(),
    value: z.string().trim().max(200).optional(),
    unit: z.string().trim().max(32).optional(),
    sharePct: z.number().min(0).max(100).finite().optional(),
    separatelyDeclared: z.boolean().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const skuPackagingSchema = z
  .object({
    level: z.enum(SKU_PACK_LEVELS),
    packType: z.string().trim().max(80).optional(),
    qtyPerParent: z.number().positive().finite().optional(),
    lengthMm: z.number().nonnegative().finite().optional(),
    widthMm: z.number().nonnegative().finite().optional(),
    heightMm: z.number().nonnegative().finite().optional(),
    weightKg: z.number().nonnegative().finite().optional(),
    volumeM3: z.number().nonnegative().finite().optional(),
    stackable: z.boolean().optional(),
    maxTiers: z.number().int().positive().optional(),
  })
  .strict();

const optionalIso2 = z
  .string()
  .trim()
  .transform((s) => (s ? s.toUpperCase() : undefined))
  .refine((s) => s == null || s.length === 2, "originCountry must be ISO2")
  .optional();

export const manufacturerSkuInputSchema = z
  .object({
    sku: z.string().trim().min(1).max(80),
    gtin: z.string().trim().max(32).optional(),
    name: z.string().trim().min(1).max(300),
    customsName: z.string().trim().max(500).optional(),
    brand: z.string().trim().max(120).optional(),
    model: z.string().trim().max(120).optional(),
    variant: z.string().trim().max(120).optional(),
    originCountry: optionalIso2,
    factoryName: z.string().trim().max(200).optional(),
    status: z.enum(MANUFACTURER_SKU_STATUSES).optional(),
    netWeightKg: z.number().nonnegative().finite().optional(),
    grossWeightKg: z.number().nonnegative().finite().optional(),
    volumeM3: z.number().nonnegative().finite().optional(),
    lengthMm: z.number().int().nonnegative().optional(),
    widthMm: z.number().int().nonnegative().optional(),
    heightMm: z.number().int().nonnegative().optional(),
    description: z.string().trim().max(5000).optional(),
    compositionText: z.string().trim().max(2000).optional(),
    material: z.string().trim().max(200).optional(),
    purpose: z.string().trim().max(500).optional(),
    technicalSpecs: z.string().trim().max(2000).optional(),
    hsHint: z.string().trim().min(2).max(20).optional(),
    features: z.array(skuFeatureSchema).max(40).optional(),
    packagings: z.array(skuPackagingSchema).max(12).optional(),
    moq: z.number().int().positive().optional(),
    packMultiple: z.number().int().positive().optional(),
    incoterms: z.string().trim().max(8).optional(),
  })
  .strict();

export const manufacturerSkuPatchSchema = manufacturerSkuInputSchema.partial();

export type ManufacturerSkuInput = z.infer<typeof manufacturerSkuInputSchema>;
export type ManufacturerSkuPatch = z.infer<typeof manufacturerSkuPatchSchema>;
export type SkuFeature = z.infer<typeof skuFeatureSchema>;
export type SkuPackaging = z.infer<typeof skuPackagingSchema>;

export type ManufacturerSkuRecord = ManufacturerSkuInput & {
  id: string;
  companyId: string;
  status: ManufacturerSkuStatus;
  version: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type ManufacturerDb = {
  company: {
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
  };
  user: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  manufacturerSku: {
    findMany: (args: any) => Promise<any[]>;
    findFirst: (args: any) => Promise<any | null>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    count: (args: any) => Promise<number>;
  };
  calculationItem: {
    count: (args: any) => Promise<number>;
  };
};

export function emptyToUndef<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (v === "" || v === null) delete (out as Record<string, unknown>)[k];
  }
  return out;
}

export function skuToClientPreview(sku: {
  sku: string;
  gtin?: string | null;
  name: string;
  customsName?: string | null;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  material?: string | null;
  compositionText?: string | null;
  purpose?: string | null;
  technicalSpecs?: string | null;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
  originCountry?: string | null;
  hsHint?: string | null;
  company?: { name?: string | null } | null;
}): { name: string; description?: string; attrs?: ProductAttrs } {
  const extra: Record<string, string> = { sku: sku.sku };
  if (sku.gtin) extra.gtin = sku.gtin;
  const attrs = sanitizeProductAttrs({
    brand: sku.brand || undefined,
    model: sku.model || undefined,
    material: sku.material || undefined,
    composition: sku.compositionText || undefined,
    purpose: sku.purpose || undefined,
    technicalSpecs: sku.technicalSpecs || undefined,
    netWeightKg: sku.netWeightKg ?? undefined,
    grossWeightKg: sku.grossWeightKg ?? undefined,
    originCountry: sku.originCountry || undefined,
    hsHint: sku.hsHint || undefined,
    manufacturerName: sku.company?.name || undefined,
    extra,
  });
  const description = sku.customsName || sku.description || undefined;
  return { name: sku.name, ...(description ? { description } : {}), ...(attrs ? { attrs } : {}) };
}

export function withClientPreview<T extends ManufacturerSkuRecord>(row: T) {
  return { ...row, clientPreview: skuToClientPreview(row), demandCalcCount: 0, demandDoneCount: 0 };
}

export function toCatalogSkuCard(
  row: ManufacturerSkuRecord & { company?: { id: string; name: string } }
): CatalogSkuCard {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    model: row.model,
    originCountry: row.originCountry,
    netWeightKg: row.netWeightKg,
    hsHint: row.hsHint,
    moq: row.moq ?? null,
    packMultiple: row.packMultiple ?? null,
    company: row.company ?? { id: row.companyId, name: "" },
    clientPreview: skuToClientPreview(row),
  };
}

export type CatalogSkuCard = {
  id: string;
  sku: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  originCountry?: string | null;
  netWeightKg?: number | null;
  hsHint?: string | null;
  moq?: number | null;
  packMultiple?: number | null;
  company: { id: string; name: string };
  clientPreview: ReturnType<typeof skuToClientPreview>;
};

function httpStatus(message: string, status: number) {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

/** Published SKUs for CLIENT/BROKER pick — no INN, users, or demand PII. */
export async function listPublishedCatalogSkus(db: ManufacturerDb): Promise<CatalogSkuCard[]> {
  const rows = await db.manufacturerSku.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { company: { select: { id: true, name: true } } },
  });
  return rows.map(toCatalogSkuCard);
}

export async function getPublishedCatalogSku(db: ManufacturerDb, id: string) {
  const row = await db.manufacturerSku.findFirst({
    where: { id, status: "PUBLISHED" },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!row) throw httpStatus("Published SKU not found", 400);
  return row;
}

export type SkuHydrateItem = {
  name: string;
  description?: string;
  attrs?: ProductAttrs;
  manufacturerSkuId?: string;
};

/** Snapshot published factory SKU into item name/attrs; client overlay wins. */
export async function hydrateItemsWithPublishedSkus<T extends SkuHydrateItem>(
  db: ManufacturerDb,
  items: T[]
): Promise<T[]> {
  return Promise.all(
    items.map(async (it) => {
      const skuId = it.manufacturerSkuId?.trim();
      if (!skuId) return it;
      const sku = await getPublishedCatalogSku(db, skuId);
      const preview = skuToClientPreview(sku);
      return {
        ...it,
        name: it.name.trim() || preview.name,
        description: it.description || preview.description,
        attrs: overlayProductAttrs(preview.attrs, it.attrs),
        manufacturerSkuId: sku.id,
      };
    })
  );
}

export async function loadManufacturerActor(
  db: ManufacturerDb,
  userId: string
): Promise<{ id: string; role: string; name?: string | null; companyId?: string | null }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, companyId: true },
  });
  if (!user) {
    const err = new Error("Not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  return user;
}

export function assertManufacturerRole(role: string) {
  if (role === "MANUFACTURER" || role === "ADMIN" || role === "SUPER_ADMIN") return;
  const err = new Error("Forbidden");
  (err as Error & { status: number }).status = 403;
  throw err;
}

export async function ensureManufacturerCompany(
  db: ManufacturerDb,
  user: { id: string; role: string; name?: string | null; companyId?: string | null }
) {
  assertManufacturerRole(user.role);
  if (user.companyId) {
    const existing = await db.company.findUnique({ where: { id: user.companyId } });
    if (existing) return existing;
  }
  if (user.role !== "MANUFACTURER") {
    const err = new Error("No manufacturer company");
    (err as Error & { status: number }).status = 400;
    throw err;
  }
  const company = await db.company.create({
    data: {
      name: user.name?.trim() || "Производитель",
      kind: "MANUFACTURER",
    },
  });
  await db.user.update({ where: { id: user.id }, data: { companyId: company.id } });
  return company;
}

function toCreateData(companyId: string, input: ManufacturerSkuInput) {
  return {
    companyId,
    sku: input.sku,
    gtin: input.gtin || null,
    name: input.name,
    customsName: input.customsName || null,
    brand: input.brand || null,
    model: input.model || null,
    variant: input.variant || null,
    originCountry: input.originCountry || null,
    factoryName: input.factoryName || null,
    status: input.status || "DRAFT",
    netWeightKg: input.netWeightKg ?? null,
    grossWeightKg: input.grossWeightKg ?? null,
    volumeM3: input.volumeM3 ?? null,
    lengthMm: input.lengthMm ?? null,
    widthMm: input.widthMm ?? null,
    heightMm: input.heightMm ?? null,
    description: input.description || null,
    compositionText: input.compositionText || null,
    material: input.material || null,
    purpose: input.purpose || null,
    technicalSpecs: input.technicalSpecs || null,
    hsHint: input.hsHint || null,
    features: input.features ?? undefined,
    packagings: input.packagings ?? undefined,
    moq: input.moq ?? null,
    packMultiple: input.packMultiple ?? null,
    incoterms: input.incoterms || null,
  };
}

export async function listManufacturerSkus(db: ManufacturerDb, companyId: string) {
  const rows = await db.manufacturerSku.findMany({
    where: { companyId },
    orderBy: { updatedAt: "desc" },
  });
  const withDemand = await Promise.all(
    rows.map(async (row) => {
      const { demandCalcCount, demandDoneCount } = await skuDemandCounts(db, row.id);
      return { ...row, clientPreview: skuToClientPreview(row), demandCalcCount, demandDoneCount };
    })
  );
  return withDemand;
}

export async function getManufacturerSku(db: ManufacturerDb, companyId: string, id: string) {
  const row = await db.manufacturerSku.findFirst({ where: { id, companyId } });
  if (!row) {
    const err = new Error("Not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  const { demandCalcCount, demandDoneCount } = await skuDemandCounts(db, row.id);
  return { ...row, clientPreview: skuToClientPreview(row), demandCalcCount, demandDoneCount };
}

export async function createManufacturerSku(
  db: ManufacturerDb,
  companyId: string,
  raw: unknown
) {
  const input = manufacturerSkuInputSchema.parse(emptyToUndef(raw as Record<string, unknown>));
  const existing = await db.manufacturerSku.findFirst({
    where: { companyId, sku: input.sku },
  });
  if (existing) {
    const err = new Error("SKU already exists");
    (err as Error & { status: number }).status = 409;
    throw err;
  }
  const row = await db.manufacturerSku.create({ data: toCreateData(companyId, input) });
  return withClientPreview(row);
}

export async function patchManufacturerSku(
  db: ManufacturerDb,
  companyId: string,
  id: string,
  raw: unknown
) {
  const patch = manufacturerSkuPatchSchema.parse(emptyToUndef(raw as Record<string, unknown>));
  const current = await db.manufacturerSku.findFirst({ where: { id, companyId } });
  if (!current) {
    const err = new Error("Not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  if (patch.sku && patch.sku !== current.sku) {
    const clash = await db.manufacturerSku.findFirst({
      where: { companyId, sku: patch.sku },
    });
    if (clash) {
      const err = new Error("SKU already exists");
      (err as Error & { status: number }).status = 409;
      throw err;
    }
  }
  const data: Record<string, unknown> = { version: (current.version || 1) + 1 };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    data[k] = v;
  }
  const row = await db.manufacturerSku.update({ where: { id }, data });
  return withClientPreview(row);
}

export async function skuDemandCounts(db: ManufacturerDb, skuId: string) {
  const [demandCalcCount, demandDoneCount] = await Promise.all([
    db.calculationItem.count({ where: { manufacturerSkuId: skuId } }),
    db.calculationItem.count({
      where: { manufacturerSkuId: skuId, calculation: { status: "DONE" } },
    }),
  ]);
  return { demandCalcCount, demandDoneCount };
}

export async function manufacturerDashboard(db: ManufacturerDb, companyId: string) {
  const [skuTotal, skuPublished, skuDraft, demandCalcs, demandDone] = await Promise.all([
    db.manufacturerSku.count({ where: { companyId } }),
    db.manufacturerSku.count({ where: { companyId, status: "PUBLISHED" } }),
    db.manufacturerSku.count({ where: { companyId, status: "DRAFT" } }),
    db.calculationItem.count({
      where: { manufacturerSku: { companyId } },
    }),
    db.calculationItem.count({
      where: { manufacturerSku: { companyId }, calculation: { status: "DONE" } },
    }),
  ]);
  return { skuTotal, skuPublished, skuDraft, demandCalcs, demandDone };
}

export const manufacturerCompanyPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    inn: z.string().trim().max(20).optional(),
    kpp: z.string().trim().max(20).optional(),
    legalAddress: z.string().trim().max(400).optional(),
    contactEmail: z.string().email().optional().or(z.literal("")),
    contactPhone: z.string().trim().max(40).optional(),
    factoryName: z.string().trim().max(200).optional(),
  })
  .strict();
