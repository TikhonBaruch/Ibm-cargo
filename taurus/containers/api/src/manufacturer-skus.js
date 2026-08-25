/**
 * Manufacturer SKU catalog (D31) — dual-path mirror of src/lib/ved/manufacturer-sku.ts
 */
const FEATURE_KINDS = new Set([
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
]);
const PACK_LEVELS = new Set(["UNIT", "INNER", "MASTER", "PALLET", "CONTAINER"]);
const STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function str(v, max) {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  if (s.length > max) throw httpError(400, "Field too long");
  return s;
}

function num(v) {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw httpError(400, "Invalid number");
  return n;
}

function sanitizeFeatures(raw) {
  if (raw == null) return undefined;
  if (!Array.isArray(raw) || raw.length > 40) throw httpError(400, "Invalid features");
  return raw.map((row) => {
    if (!row || typeof row !== "object" || !FEATURE_KINDS.has(row.kind)) {
      throw httpError(400, "Invalid feature kind");
    }
    return {
      kind: row.kind,
      label: str(row.label, 200),
      value: str(row.value, 200),
      unit: str(row.unit, 32),
      sharePct: row.sharePct == null ? undefined : num(row.sharePct),
      separatelyDeclared: Boolean(row.separatelyDeclared) || undefined,
      notes: str(row.notes, 500),
    };
  });
}

function sanitizePackagings(raw) {
  if (raw == null) return undefined;
  if (!Array.isArray(raw) || raw.length > 12) throw httpError(400, "Invalid packagings");
  return raw.map((row) => {
    if (!row || typeof row !== "object" || !PACK_LEVELS.has(row.level)) {
      throw httpError(400, "Invalid pack level");
    }
    return {
      level: row.level,
      packType: str(row.packType, 80),
      qtyPerParent: row.qtyPerParent == null ? undefined : num(row.qtyPerParent),
      lengthMm: row.lengthMm == null ? undefined : num(row.lengthMm),
      widthMm: row.widthMm == null ? undefined : num(row.widthMm),
      heightMm: row.heightMm == null ? undefined : num(row.heightMm),
      weightKg: row.weightKg == null ? undefined : num(row.weightKg),
      volumeM3: row.volumeM3 == null ? undefined : num(row.volumeM3),
      stackable: row.stackable == null ? undefined : Boolean(row.stackable),
      maxTiers: row.maxTiers == null ? undefined : Math.trunc(num(row.maxTiers)),
    };
  });
}

function parseSkuBody(body, partial) {
  const sku = str(body.sku, 80);
  const name = str(body.name, 300);
  if (!partial && (!sku || !name)) throw httpError(400, "sku and name required");
  let originCountry = str(body.originCountry, 2);
  if (originCountry) originCountry = originCountry.toUpperCase();
  if (originCountry && originCountry.length !== 2) throw httpError(400, "originCountry ISO2");
  const status = body.status == null || body.status === "" ? undefined : String(body.status);
  if (status && !STATUSES.has(status)) throw httpError(400, "Invalid status");
  return {
    sku,
    gtin: str(body.gtin, 32),
    name,
    customsName: str(body.customsName, 500),
    brand: str(body.brand, 120),
    model: str(body.model, 120),
    variant: str(body.variant, 120),
    originCountry,
    factoryName: str(body.factoryName, 200),
    status,
    netWeightKg: num(body.netWeightKg),
    grossWeightKg: num(body.grossWeightKg),
    volumeM3: num(body.volumeM3),
    lengthMm: body.lengthMm == null || body.lengthMm === "" ? undefined : Math.trunc(num(body.lengthMm)),
    widthMm: body.widthMm == null || body.widthMm === "" ? undefined : Math.trunc(num(body.widthMm)),
    heightMm: body.heightMm == null || body.heightMm === "" ? undefined : Math.trunc(num(body.heightMm)),
    description: str(body.description, 5000),
    compositionText: str(body.compositionText, 2000),
    material: str(body.material, 200),
    purpose: str(body.purpose, 500),
    technicalSpecs: str(body.technicalSpecs, 2000),
    hsHint: str(body.hsHint, 20),
    features: sanitizeFeatures(body.features),
    packagings: sanitizePackagings(body.packagings),
    moq: body.moq == null || body.moq === "" ? undefined : Math.trunc(num(body.moq)),
    packMultiple:
      body.packMultiple == null || body.packMultiple === "" ? undefined : Math.trunc(num(body.packMultiple)),
    incoterms: str(body.incoterms, 8),
  };
}

function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
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
  if (Object.keys(extra).length) attrs.extra = extra;
  const description = sku.customsName || sku.description || undefined;
  return {
    name: sku.name,
    ...(description ? { description } : {}),
    ...(Object.keys(attrs).length ? { attrs } : {}),
  };
}

async function skuDemandCounts(prisma, skuId) {
  const [demandCalcCount, demandDoneCount] = await Promise.all([
    prisma.calculationItem.count({ where: { manufacturerSkuId: skuId } }),
    prisma.calculationItem.count({
      where: { manufacturerSkuId: skuId, calculation: { status: "DONE" } },
    }),
  ]);
  return { demandCalcCount, demandDoneCount };
}

async function withMeta(prisma, row) {
  const demand = await skuDemandCounts(prisma, row.id);
  return { ...row, clientPreview: skuToClientPreview(row), ...demand };
}

function assertManufacturerRole(role) {
  if (role === "MANUFACTURER" || role === "ADMIN" || role === "SUPER_ADMIN") return;
  throw httpError(403, "Forbidden");
}

export async function ensureManufacturerCompany(prisma, userId, role) {
  assertManufacturerRole(role);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, companyId: true },
  });
  if (!user) throw httpError(404, "Not found");
  if (user.companyId) {
    const existing = await prisma.company.findUnique({ where: { id: user.companyId } });
    if (existing) return existing;
  }
  if (user.role !== "MANUFACTURER") throw httpError(400, "No manufacturer company");
  const company = await prisma.company.create({
    data: { name: user.name?.trim() || "Производитель", kind: "MANUFACTURER" },
  });
  await prisma.user.update({ where: { id: user.id }, data: { companyId: company.id } });
  return company;
}

export async function handleManufacturerRoutes({ req, res, url, prisma, authorize, json, readBody }) {
  const path = url.pathname;
  if (!path.startsWith("/v1/manufacturer")) return false;

  const user = authorize(req);
  if (!user) {
    json(res, 401, { error: "Unauthorized" });
    return true;
  }

  try {
    if (req.method === "GET" && path === "/v1/manufacturer/dashboard") {
      const company = await ensureManufacturerCompany(prisma, user.userId, user.role);
      const [skuTotal, skuPublished, skuDraft, demandCalcs, demandDone, requestSubmitted, poolsOpen, poolsConfirmed] =
        await Promise.all([
          prisma.manufacturerSku.count({ where: { companyId: company.id } }),
          prisma.manufacturerSku.count({ where: { companyId: company.id, status: "PUBLISHED" } }),
          prisma.manufacturerSku.count({ where: { companyId: company.id, status: "DRAFT" } }),
          prisma.calculationItem.count({ where: { manufacturerSku: { companyId: company.id } } }),
          prisma.calculationItem.count({
            where: { manufacturerSku: { companyId: company.id }, calculation: { status: "DONE" } },
          }),
          prisma.skuOrderRequest.count({
            where: { status: "SUBMITTED", manufacturerSku: { companyId: company.id } },
          }),
          prisma.skuOrderPool.count({ where: { manufacturerCompanyId: company.id, status: "OPEN" } }),
          prisma.skuOrderPool.count({ where: { manufacturerCompanyId: company.id, status: "CONFIRMED" } }),
        ]);
      json(res, 200, {
        company,
        skuTotal,
        skuPublished,
        skuDraft,
        demandCalcs,
        demandDone,
        requestSubmitted,
        poolsOpen,
        poolsConfirmed,
      });
      return true;
    }

    if (path === "/v1/manufacturer/company") {
      const company = await ensureManufacturerCompany(prisma, user.userId, user.role);
      if (req.method === "GET") {
        json(res, 200, company);
        return true;
      }
      if (req.method === "PATCH") {
        const body = await readBody(req);
        const updated = await prisma.company.update({
          where: { id: company.id },
          data: compact({
            name: str(body.name, 200),
            inn: str(body.inn, 20),
            kpp: str(body.kpp, 20),
            legalAddress: str(body.legalAddress, 400),
            contactEmail: str(body.contactEmail, 120),
            contactPhone: str(body.contactPhone, 40),
          }),
        });
        json(res, 200, updated);
        return true;
      }
    }

    if (req.method === "GET" && path === "/v1/manufacturer/skus") {
      const company = await ensureManufacturerCompany(prisma, user.userId, user.role);
      const rows = await prisma.manufacturerSku.findMany({
        where: { companyId: company.id },
        orderBy: { updatedAt: "desc" },
      });
      const out = [];
      for (const row of rows) out.push(await withMeta(prisma, row));
      json(res, 200, out);
      return true;
    }

    if (req.method === "POST" && path === "/v1/manufacturer/skus") {
      const company = await ensureManufacturerCompany(prisma, user.userId, user.role);
      const input = parseSkuBody(await readBody(req), false);
      const existing = await prisma.manufacturerSku.findFirst({
        where: { companyId: company.id, sku: input.sku },
      });
      if (existing) throw httpError(409, "SKU already exists");
      const row = await prisma.manufacturerSku.create({
        data: {
          companyId: company.id,
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
        },
      });
      json(res, 201, await withMeta(prisma, row));
      return true;
    }

    const skuMatch = path.match(/^\/v1\/manufacturer\/skus\/([^/]+)$/);
    if (skuMatch) {
      const id = decodeURIComponent(skuMatch[1]);
      const company = await ensureManufacturerCompany(prisma, user.userId, user.role);
      if (req.method === "GET") {
        const row = await prisma.manufacturerSku.findFirst({ where: { id, companyId: company.id } });
        if (!row) throw httpError(404, "Not found");
        json(res, 200, await withMeta(prisma, row));
        return true;
      }
      if (req.method === "PATCH") {
        const current = await prisma.manufacturerSku.findFirst({
          where: { id, companyId: company.id },
        });
        if (!current) throw httpError(404, "Not found");
        const patch = compact(parseSkuBody(await readBody(req), true));
        if (patch.sku && patch.sku !== current.sku) {
          const clash = await prisma.manufacturerSku.findFirst({
            where: { companyId: company.id, sku: patch.sku },
          });
          if (clash) throw httpError(409, "SKU already exists");
        }
        const row = await prisma.manufacturerSku.update({
          where: { id },
          data: { ...patch, version: (current.version || 1) + 1 },
        });
        json(res, 200, await withMeta(prisma, row));
        return true;
      }
    }

    json(res, 405, { error: "Method not allowed" });
    return true;
  } catch (e) {
    const status = e && typeof e.status === "number" ? e.status : 400;
    json(res, status, { error: e instanceof Error ? e.message : "Error" });
    return true;
  }
}
