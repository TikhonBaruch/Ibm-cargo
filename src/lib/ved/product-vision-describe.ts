/**
 * Pre-create product photo → TN VED search text (chain 3 DeepSeek vision by default).
 * Fail-open: callers show upload success even when describe returns null.
 */
import { describeForChain, resolveAiChainId, visionConfiguredForChain } from "./chains";
import { isAllowedMediaUrl } from "./media-url";
import type { ProductAttrs } from "./product-description";
import { sanitizeProductAttrs } from "./product-description";

export type ProductVisionDescribeResult = {
  description: string;
  name?: string;
  attrs?: ProductAttrs;
  engine?: string;
};

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Vision sometimes returns the whole JSON object as `description` string.
 * Unwrap so formatProductDescriptionForTnved never sees raw `{"description":…}`.
 */
export function coerceVisionDescribePayload(raw: {
  description?: string | null;
  attrs?: ProductAttrs | null;
  name?: string | null;
}): { description: string; attrs?: ProductAttrs | null; name?: string } {
  let description = String(raw.description || "").trim();
  let attrs = raw.attrs ?? null;
  let name = raw.name?.trim() || undefined;

  if (description.startsWith("{") && description.includes('"description"')) {
    try {
      const parsed = JSON.parse(description) as {
        description?: unknown;
        attrs?: ProductAttrs | null;
        name?: unknown;
      };
      if (typeof parsed.description === "string" && parsed.description.trim()) {
        description = parsed.description.trim();
        if (parsed.attrs && typeof parsed.attrs === "object") {
          attrs = { ...(attrs || {}), ...parsed.attrs };
        }
        if (!name && typeof parsed.name === "string" && parsed.name.trim()) {
          name = parsed.name.trim();
        }
      }
    } catch {
      /* keep raw string */
    }
  }

  return { description, attrs, name };
}

function stripLabeledDupes(text: string, labels: string[]): string {
  let out = text;
  for (const label of labels) {
    const re = new RegExp(
      `(?:^|[.\\n;]\\s*)(?:${label})\\s*[:：]\\s*[^.\\n;]+\\.?;?`,
      "gi"
    );
    out = out.replace(re, ". ");
  }
  return norm(out.replace(/^[.\s]+|[.\s]+$/g, "").replace(/\.\s*\./g, "."));
}

/**
 * Ordered block for cascade / classify-preview:
 * 1) product type  2) composition  3) purpose/application
 */
export function formatProductDescriptionForTnved(
  description: string,
  attrs?: ProductAttrs | null,
  name?: string
): string {
  const a = sanitizeProductAttrs(attrs);
  const composition = a?.composition?.trim() || "";
  const material = a?.material?.trim() || "";
  const purpose = a?.purpose?.trim() || "";
  const brand = a?.brand?.trim() || "";

  let productType = String(name || "").trim();
  let body = String(description || "").trim();

  // If free-form body starts with purpose (common vision quirk), drop the leak first.
  if (purpose) {
    const head = purpose.slice(0, Math.min(28, purpose.length)).toLowerCase();
    if (body.toLowerCase().startsWith(head)) {
      body = norm(body.slice(purpose.length).replace(/^[\s.,;:—-]+/, ""));
    }
  }

  // Drop labeled fragments that we will re-append in fixed order.
  body = stripLabeledDupes(body, [
    "Состав",
    "Назначение",
    "Применение",
    "Материал",
    "Бренд",
    "Тип",
  ]);

  if (!productType) {
    productType = body.split(/[.!?\n]/)[0]?.trim() || "";
    if (productType) {
      body = norm(body.slice(productType.length).replace(/^[\s.]+/, ""));
    }
  }

  productType = productType
    .replace(/^товар\s+представляет\s+собой\s+/i, "")
    .replace(/^это\s+/i, "")
    .trim();

  const parts: string[] = [];
  if (productType) parts.push(productType);

  const compositionLine =
    composition && composition.toLowerCase() !== productType.toLowerCase()
      ? composition
      : material && material.toLowerCase() !== productType.toLowerCase()
        ? material
        : "";
  if (compositionLine) {
    parts.push(
      /^(состав|материал)\s*[:：]/i.test(compositionLine)
        ? compositionLine
        : `Состав: ${compositionLine}`
    );
  } else if (material && composition && material !== composition) {
    parts.push(`Материал: ${material}`);
  }

  if (purpose && purpose.toLowerCase() !== productType.toLowerCase()) {
    parts.push(
      /^(назначение|применение)\s*[:：]/i.test(purpose)
        ? purpose
        : `Назначение: ${purpose}`
    );
  }

  // Extra visual detail only if it is not another attrs dump.
  if (body && !/(?:состав|назначение|применение)\s*[:：]/i.test(body) && body.length >= 12) {
    const low = body.toLowerCase();
    const overlapsType = Boolean(
      productType && low.includes(productType.toLowerCase().slice(0, Math.min(20, productType.length)))
    );
    if (!overlapsType) parts.push(body);
  }

  if (brand) parts.push(`Бренд: ${brand}`);

  const joined = parts
    .map((p) => norm(p))
    .filter(Boolean)
    .join(". ")
    .replace(/\.\s*\./g, ".");
  return joined.slice(0, 1200);
}

export async function describeProductFromMediaUrl(opts: {
  mediaUrl: string;
  hint?: string;
}): Promise<ProductVisionDescribeResult | null> {
  const mediaUrl = String(opts.mediaUrl || "").trim();
  if (!mediaUrl || !isAllowedMediaUrl(mediaUrl)) return null;

  const chainId = resolveAiChainId();
  if (!visionConfiguredForChain(chainId)) return null;

  const described = await describeForChain(chainId, {
    mediaUrl,
    hint: opts.hint,
  });
  if (!described.ok || !described.description?.trim()) return null;

  const coerced = coerceVisionDescribePayload({
    description: described.description,
    attrs: described.attrs,
  });
  const attrs = sanitizeProductAttrs(coerced.attrs);
  // Never pass purpose as the product-type title (was causing «назначение» first).
  const description = formatProductDescriptionForTnved(
    coerced.description,
    attrs,
    coerced.name
  );
  return {
    description,
    name: description.split(/[.!?\n]/)[0]?.trim().slice(0, 120) || undefined,
    attrs: attrs || undefined,
    engine: described.engine,
  };
}
