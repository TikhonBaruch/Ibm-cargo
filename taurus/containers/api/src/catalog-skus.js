/**
 * Published SKU catalog for CLIENT/BROKER (D32 C2). Dual-path of
 * src/lib/ved/manufacturer-sku.ts listPublishedCatalogSkus / hydrateItemsWithPublishedSkus.
 * Isolated from manufacturer CRUD so UI extract containers stay Prisma-free.
 */
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function skuToClientPreview(sku) {
  const extra = { sku: sku.sku };
  if (sku.gtin) extra.gtin = sku.gtin;
  const attrs = {};
  if (sku.brand) attrs.brand = sku.brand;
  if (sku.model) attrs.model = sku.model;
  if (sku.material) attrs.material = sku.material;
  if (sku.compositionText) attrs.composition = sku.compositionText;
  if (sku.purpose) attrs.purpose = sku.purpose;
  if (sku.technicalSpecs) attrs.technicalSpecs = sku.technicalSpecs;
  if (sku.netWeightKg != null) attrs.netWeightKg = sku.netWeightKg;
  if (sku.grossWeightKg != null) attrs.grossWeightKg = sku.grossWeightKg;
  if (sku.originCountry) attrs.originCountry = sku.originCountry;
  if (sku.hsHint) attrs.hsHint = sku.hsHint;
  if (sku.company?.name) attrs.manufacturerName = sku.company.name;
  if (Object.keys(extra).length) attrs.extra = extra;
  const description = sku.customsName || sku.description || undefined;
  return {
    name: sku.name,
    ...(description ? { description } : {}),
    ...(Object.keys(attrs).length ? { attrs } : {}),
  };
}

function overlayAttrs(base, overlay) {
  if (!base && !overlay) return undefined;
  const extra = { ...(base?.extra || {}), ...(overlay?.extra || {}) };
  const merged = { ...(base || {}), ...(overlay || {}) };
  if (Object.keys(extra).length) merged.extra = extra;
  return Object.keys(merged).length ? merged : undefined;
}

function toCatalogCard(row) {
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
    company: row.company || { id: row.companyId, name: "" },
    clientPreview: skuToClientPreview(row),
  };
}

export async function hydrateItemsWithPublishedSkus(prisma, items) {
  if (!Array.isArray(items)) return items;
  const out = [];
  for (const it of items) {
    const skuId = typeof it.manufacturerSkuId === "string" ? it.manufacturerSkuId.trim() : "";
    if (!skuId) {
      out.push(it);
      continue;
    }
    const sku = await prisma.manufacturerSku.findFirst({
      where: { id: skuId, status: "PUBLISHED" },
      include: { company: { select: { id: true, name: true } } },
    });
    if (!sku) throw httpError(400, "Published SKU not found");
    const preview = skuToClientPreview(sku);
    out.push({
      ...it,
      name: (it.name || "").trim() || preview.name,
      description: it.description || preview.description,
      attrs: overlayAttrs(preview.attrs, it.attrs),
      manufacturerSkuId: sku.id,
    });
  }
  return out;
}

async function withOpenPools(prisma, cards) {
  if (!cards.length) return cards.map((c) => ({ ...c, openPool: null }));
  const pools = await prisma.skuOrderPool.findMany({
    where: { status: "OPEN", manufacturerSkuId: { in: cards.map((c) => c.id) } },
    include: { requests: { where: { status: "POOLED" }, select: { qty: true } } },
  });
  const bySku = new Map();
  for (const pool of pools) {
    const qtyTotal = (pool.requests || []).reduce((sum, r) => sum + r.qty, 0);
    const prev = bySku.get(pool.manufacturerSkuId);
    bySku.set(pool.manufacturerSkuId, {
      qtyTotal: (prev?.qtyTotal ?? 0) + qtyTotal,
      targetQty: pool.targetQty ?? prev?.targetQty ?? null,
    });
  }
  return cards.map((card) => ({ ...card, openPool: bySku.get(card.id) ?? null }));
}

export async function handleCatalogRoutes({ req, res, url, prisma, authorize, json }) {
  const path = url.pathname;
  if (!path.startsWith("/v1/catalog/skus")) return false;

  const user = authorize(req);
  if (!user) {
    json(res, 401, { error: "Unauthorized" });
    return true;
  }

  try {
    const idMatch = path.match(/^\/v1\/catalog\/skus\/([^/]+)$/);
    if (req.method === "GET" && idMatch) {
      const row = await prisma.manufacturerSku.findFirst({
        where: { id: idMatch[1], status: "PUBLISHED" },
        include: { company: { select: { id: true, name: true } } },
      });
      if (!row) throw httpError(400, "Published SKU not found");
      const [card] = await withOpenPools(prisma, [toCatalogCard(row)]);
      json(res, 200, card);
      return true;
    }

    if (req.method === "GET" && path === "/v1/catalog/skus") {
      const rows = await prisma.manufacturerSku.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        take: 200,
        include: { company: { select: { id: true, name: true } } },
      });
      json(res, 200, await withOpenPools(prisma, rows.map(toCatalogCard)));
      return true;
    }

    json(res, 405, { error: "Method not allowed" });
    return true;
  } catch (e) {
    json(res, e.status || 400, { error: e instanceof Error ? e.message : "Error" });
    return true;
  }
}
