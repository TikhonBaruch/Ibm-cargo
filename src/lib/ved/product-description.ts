/**
 * Product description schemas (D24).
 * First-class columns stay on CalculationItem; structured attrs live in `attrs` JSON.
 */
import { z } from "zod";

/** Customs-oriented attributes beyond free-text name/description. */
export const productAttrsSchema = z
  .object({
    material: z.string().trim().min(1).max(200).optional(),
    composition: z.string().trim().min(1).max(500).optional(),
    brand: z.string().trim().min(1).max(120).optional(),
    model: z.string().trim().min(1).max(120).optional(),
    purpose: z.string().trim().min(1).max(500).optional(),
    technicalSpecs: z.string().trim().min(1).max(2000).optional(),
    netWeightKg: z.number().nonnegative().finite().optional(),
    grossWeightKg: z.number().nonnegative().finite().optional(),
    originCountry: z.string().trim().min(2).max(2).optional(),
    /** Client/AI chapter or code hint (not authoritative final HS). */
    hsHint: z.string().trim().min(2).max(20).optional(),
    /** Free-text manufacturer; permanent catalog only after ADMIN approve. */
    manufacturerName: z.string().trim().min(1).max(200).optional(),
    extra: z.record(z.string().max(200)).optional(),
  })
  .strict();

export type ProductAttrs = z.infer<typeof productAttrsSchema>;

/** Full line-item description used at create / OCR ingest. */
export const productDescriptionSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional(),
  qty: z.number().positive().finite().optional(),
  unit: z.string().trim().min(1).max(32).optional(),
  unitPrice: z.number().nonnegative().finite().optional(),
  currency: z.string().trim().length(3).default("USD"),
  mediaUrl: z.string().trim().min(1).max(2000).optional(),
  attrs: productAttrsSchema.optional(),
});

export type ProductDescription = z.infer<typeof productDescriptionSchema>;

export function parseProductAttrs(raw: unknown): ProductAttrs | null {
  if (raw == null) return null;
  const parsed = productAttrsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseProductDescription(raw: unknown): ProductDescription {
  return productDescriptionSchema.parse(raw);
}

/** Strip unknown keys; return undefined when empty / invalid. */
export function sanitizeProductAttrs(raw: unknown): ProductAttrs | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const parsed = productAttrsSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  return Object.keys(parsed.data).length ? parsed.data : undefined;
}

/** Overlay wins; `extra` maps merge. Used when snapshotting a published factory SKU. */
export function overlayProductAttrs(
  base?: ProductAttrs | null,
  overlay?: ProductAttrs | null
): ProductAttrs | undefined {
  if (!base && !overlay) return undefined;
  const extra = { ...(base?.extra || {}), ...(overlay?.extra || {}) };
  return (
    sanitizeProductAttrs({
      ...(base || {}),
      ...(overlay || {}),
      ...(Object.keys(extra).length ? { extra } : {}),
    }) || undefined
  );
}

const ATTR_SCALAR_KEYS = [
  "material",
  "composition",
  "brand",
  "model",
  "purpose",
  "technicalSpecs",
  "netWeightKg",
  "grossWeightKg",
  "originCountry",
  "hsHint",
  "manufacturerName",
] as const;

/** Broker QC: keys shown as fillable when empty (D32 inline form). */
export const BROKER_FILLABLE_ATTR_KEYS = [
  "brand",
  "material",
  "composition",
  "purpose",
  "originCountry",
  "netWeightKg",
  "grossWeightKg",
  "model",
  "hsHint",
  "manufacturerName",
] as const satisfies readonly (typeof ATTR_SCALAR_KEYS)[number][];

export type BrokerFillableAttrKey = (typeof BROKER_FILLABLE_ATTR_KEYS)[number];

export function isEmptyAttrValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/** Required for client create: origin ISO-2 + composition.
 * manufacturerName temporarily optional (C7 visual). Restore: also require manufacturerName. */
export function hasRequiredCreateAttrs(attrs?: ProductAttrs | null): boolean {
  if (!attrs) return false;
  const origin = String(attrs.originCountry || "")
    .trim()
    .toUpperCase();
  return origin.length === 2 && !isEmptyAttrValue(attrs.composition);
}

export type RequiredCreateAttrKey = "originCountry" | "composition";

/** Missing required keys for UI / API error text (empty = ok). */
export function missingRequiredCreateAttrs(
  attrs?: ProductAttrs | null
): RequiredCreateAttrKey[] {
  const miss: RequiredCreateAttrKey[] = [];
  const origin = String(attrs?.originCountry || "")
    .trim()
    .toUpperCase();
  if (origin.length !== 2) miss.push("originCountry");
  // Restore: if (isEmptyAttrValue(attrs?.manufacturerName)) miss.push("manufacturerName");
  if (isEmptyAttrValue(attrs?.composition)) miss.push("composition");
  return miss;
}

/** Human error for create hard-reject. Restore manufacturer in the sentence when C7 lifts. */
export function requiredCreateAttrsError(miss: string[]): string {
  return `Обязательны страна происхождения (ISO-2) и состав (не хватает: ${miss.join(", ")})`;
}

/**
 * Broker may only fill empty attrs (D15 slice). Existing client / factory values win.
 * `extra` keys already present are not overwritten.
 */
export function fillEmptyProductAttrs(
  existing?: ProductAttrs | null,
  patch?: ProductAttrs | null
): ProductAttrs | undefined {
  const base = sanitizeProductAttrs(existing) || {};
  const incoming = sanitizeProductAttrs(patch);
  if (!incoming) {
    return Object.keys(base).length ? base : undefined;
  }

  const out: Record<string, unknown> = { ...base };
  for (const key of ATTR_SCALAR_KEYS) {
    if (!isEmptyAttrValue(out[key])) continue;
    if (!isEmptyAttrValue(incoming[key])) {
      out[key] = incoming[key];
    }
  }

  const baseExtra =
    base.extra && typeof base.extra === "object" ? { ...base.extra } : {};
  const patchExtra =
    incoming.extra && typeof incoming.extra === "object" ? incoming.extra : {};
  const mergedExtra = { ...baseExtra };
  for (const [k, v] of Object.entries(patchExtra)) {
    if (!isEmptyAttrValue(baseExtra[k])) continue;
    if (!isEmptyAttrValue(v)) mergedExtra[k] = v;
  }
  if (Object.keys(mergedExtra).length) out.extra = mergedExtra;
  else delete out.extra;

  return sanitizeProductAttrs(out);
}

/** Keys the broker newly filled vs existing snapshot (for events / UI). */
export function brokerFilledAttrKeys(
  before?: ProductAttrs | null,
  after?: ProductAttrs | null
): string[] {
  const b = sanitizeProductAttrs(before) || {};
  const a = sanitizeProductAttrs(after) || {};
  const keys: string[] = [];
  for (const key of ATTR_SCALAR_KEYS) {
    if (isEmptyAttrValue(b[key]) && !isEmptyAttrValue(a[key])) keys.push(key);
  }
  const be = b.extra || {};
  const ae = a.extra || {};
  for (const k of Object.keys(ae)) {
    if (isEmptyAttrValue(be[k]) && !isEmptyAttrValue(ae[k])) keys.push(`extra.${k}`);
  }
  return keys;
}
