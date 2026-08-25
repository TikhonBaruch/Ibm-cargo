/**
 * D34 factory requests + consolidated pools — dual-path of src/lib/ved/sku-order.ts
 */
const REQUEST_STATUSES = new Set(["SUBMITTED", "REJECTED", "POOLED", "CANCELLED"]);
const POOL_STATUSES = new Set(["OPEN", "CONFIRMED", "CLOSED", "CANCELLED"]);

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

function qtyOf(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) throw httpError(400, "Invalid qty");
  return n;
}

function parseRequestBody(body) {
  const manufacturerSkuId = str(body?.manufacturerSkuId, 64);
  if (!manufacturerSkuId) throw httpError(400, "manufacturerSkuId required");
  return {
    manufacturerSkuId,
    qty: qtyOf(body.qty),
    note: str(body.note, 500) || null,
    calculationId: str(body.calculationId, 64) || null,
  };
}

const requestInclude = {
  manufacturerSku: { select: { id: true, sku: true, name: true, status: true, companyId: true, moq: true } },
  pool: { select: { id: true, status: true, title: true, targetQty: true } },
};

const manufacturerRequestInclude = {
  ...requestInclude,
  clientCompany: { select: { id: true, name: true, inn: true } },
};

const poolInclude = {
  manufacturerSku: { select: { id: true, sku: true, name: true, status: true, companyId: true, moq: true } },
  requests: {
    include: { clientCompany: { select: { id: true, name: true, inn: true } } },
    orderBy: { createdAt: "asc" },
  },
};

function toClientView(row, poolQtyTotal) {
  const sku = row.manufacturerSku;
  return {
    id: row.id,
    qty: row.qty,
    note: row.note ?? null,
    status: row.status,
    rejectReason: row.rejectReason ?? null,
    createdAt: row.createdAt,
    calculationId: row.calculationId ?? null,
    manufacturerSku: sku
      ? { id: sku.id, sku: sku.sku, name: sku.name, moq: sku.moq ?? null }
      : { id: row.manufacturerSkuId },
    pool: row.pool
      ? {
          id: row.pool.id,
          status: row.pool.status,
          title: row.pool.title ?? null,
          targetQty: row.pool.targetQty ?? null,
          qtyTotal: poolQtyTotal ?? null,
        }
      : null,
  };
}

function toMfgRequestView(row) {
  return {
    id: row.id,
    qty: row.qty,
    note: row.note ?? null,
    status: row.status,
    rejectReason: row.rejectReason ?? null,
    createdAt: row.createdAt,
    manufacturerSku: row.manufacturerSku
      ? {
          id: row.manufacturerSku.id,
          sku: row.manufacturerSku.sku,
          name: row.manufacturerSku.name,
          moq: row.manufacturerSku.moq ?? null,
        }
      : { id: row.manufacturerSkuId },
    clientCompany: row.clientCompany
      ? { name: row.clientCompany.name, inn: row.clientCompany.inn ?? null }
      : null,
    poolId: row.poolId ?? null,
    poolStatus: row.pool?.status ?? null,
  };
}

function toPoolView(row) {
  const requests = row.requests || [];
  const pooledQty = requests.filter((r) => r.status === "POOLED").reduce((sum, r) => sum + r.qty, 0);
  return {
    id: row.id,
    status: row.status,
    title: row.title ?? null,
    targetQty: row.targetQty ?? null,
    note: row.note ?? null,
    confirmedAt: row.confirmedAt ?? null,
    createdAt: row.createdAt,
    qtyTotal: pooledQty,
    manufacturerSku: row.manufacturerSku
      ? {
          id: row.manufacturerSku.id,
          sku: row.manufacturerSku.sku,
          name: row.manufacturerSku.name,
          moq: row.manufacturerSku.moq ?? null,
        }
      : { id: row.manufacturerSkuId },
    requests: requests.map((r) => ({
      id: r.id,
      qty: r.qty,
      status: r.status,
      note: r.note ?? null,
      clientCompany: r.clientCompany ? { name: r.clientCompany.name, inn: r.clientCompany.inn ?? null } : null,
    })),
  };
}

async function requirePublishedSku(prisma, id) {
  const sku = await prisma.manufacturerSku.findFirst({
    where: { id, status: "PUBLISHED" },
    select: { id: true, sku: true, name: true, status: true, companyId: true, moq: true },
  });
  if (!sku) throw httpError(400, "Published SKU not found");
  return sku;
}

async function requireClientCompany(prisma, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true, role: true } });
  if (!user?.companyId) throw httpError(400, "No company");
  return user.companyId;
}

async function poolQtyTotal(prisma, poolId) {
  const rows = await prisma.skuOrderRequest.findMany({
    where: { poolId, status: "POOLED" },
    select: { qty: true },
  });
  return rows.reduce((sum, r) => sum + r.qty, 0);
}

async function createClientRequest(prisma, clientCompanyId, body) {
  const input = parseRequestBody(body);
  await requirePublishedSku(prisma, input.manufacturerSkuId);
  const row = await prisma.skuOrderRequest.create({
    data: {
      clientCompanyId,
      manufacturerSkuId: input.manufacturerSkuId,
      qty: input.qty,
      note: input.note,
      calculationId: input.calculationId,
      status: "SUBMITTED",
    },
    include: requestInclude,
  });
  return toClientView(row, null);
}

async function openPoolForSku(prisma, manufacturerCompanyId, sku, poolId) {
  if (poolId) {
    const pool = await prisma.skuOrderPool.findFirst({
      where: { id: poolId, manufacturerCompanyId },
      include: poolInclude,
    });
    if (!pool) throw httpError(404, "Pool not found");
    if (pool.status !== "OPEN") throw httpError(409, "Pool is not open");
    if (pool.manufacturerSkuId !== sku.id) throw httpError(409, "Pool SKU mismatch");
    return pool;
  }
  const existing = await prisma.skuOrderPool.findFirst({
    where: { manufacturerCompanyId, manufacturerSkuId: sku.id, status: "OPEN" },
    include: poolInclude,
  });
  if (existing) return existing;
  return prisma.skuOrderPool.create({
    data: {
      manufacturerCompanyId,
      manufacturerSkuId: sku.id,
      title: `Сборный заказ ${sku.sku}`,
      targetQty: sku.moq ?? null,
      status: "OPEN",
    },
    include: poolInclude,
  });
}

export async function manufacturerOrderKpis(prisma, manufacturerCompanyId) {
  const [requestSubmitted, poolsOpen, poolsConfirmed] = await Promise.all([
    prisma.skuOrderRequest.count({
      where: { status: "SUBMITTED", manufacturerSku: { companyId: manufacturerCompanyId } },
    }),
    prisma.skuOrderPool.count({ where: { manufacturerCompanyId, status: "OPEN" } }),
    prisma.skuOrderPool.count({ where: { manufacturerCompanyId, status: "CONFIRMED" } }),
  ]);
  return { requestSubmitted, poolsOpen, poolsConfirmed };
}

export async function handleFactoryOrderRoutes({ req, res, url, prisma, authorize, json, readBody }) {
  const path = url.pathname;
  if (!path.startsWith("/v1/factory/")) return false;

  const user = authorize(req);
  if (!user) {
    json(res, 401, { error: "Unauthorized" });
    return true;
  }
  if (!["CLIENT", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    json(res, 403, { error: "Forbidden" });
    return true;
  }

  try {
    const companyId = await requireClientCompany(prisma, user.userId);

    if (req.method === "GET" && path === "/v1/factory/requests") {
      const rows = await prisma.skuOrderRequest.findMany({
        where: { clientCompanyId: companyId },
        orderBy: { createdAt: "desc" },
        include: requestInclude,
      });
      const poolIds = [...new Set(rows.map((r) => r.poolId).filter(Boolean))];
      const qtyByPool = {};
      for (const id of poolIds) qtyByPool[id] = await poolQtyTotal(prisma, id);
      json(
        res,
        200,
        rows.map((row) => toClientView(row, row.poolId ? qtyByPool[row.poolId] : null))
      );
      return true;
    }

    if (req.method === "POST" && path === "/v1/factory/requests") {
      const body = await readBody(req);
      json(res, 201, await createClientRequest(prisma, companyId, body));
      return true;
    }

    if (req.method === "POST" && path === "/v1/factory/requests/bulk") {
      const body = await readBody(req);
      const lines = Array.isArray(body?.lines) ? body.lines : [];
      if (!lines.length || lines.length > 50) throw httpError(400, "lines: 1..50");
      const created = [];
      const errors = [];
      for (let i = 0; i < lines.length; i++) {
        try {
          created.push(await createClientRequest(prisma, companyId, lines[i]));
        } catch (e) {
          errors.push({ index: i, error: e instanceof Error ? e.message : "Error" });
        }
      }
      json(res, 201, { created, errors });
      return true;
    }

    const cancelMatch = path.match(/^\/v1\/factory\/requests\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelMatch) {
      const id = decodeURIComponent(cancelMatch[1]);
      const row = await prisma.skuOrderRequest.findFirst({
        where: { id, clientCompanyId: companyId },
        include: requestInclude,
      });
      if (!row) throw httpError(404, "Not found");
      if (row.status !== "SUBMITTED") throw httpError(409, "Can only cancel a submitted request");
      const updated = await prisma.skuOrderRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: requestInclude,
      });
      json(res, 200, toClientView(updated, null));
      return true;
    }

    const linkMatch = path.match(/^\/v1\/factory\/requests\/([^/]+)\/link-calc$/);
    if (req.method === "POST" && linkMatch) {
      const id = decodeURIComponent(linkMatch[1]);
      const body = await readBody(req);
      const calculationId = str(body?.calculationId, 64);
      if (!calculationId) throw httpError(400, "calculationId required");
      const row = await prisma.skuOrderRequest.findFirst({
        where: { id, clientCompanyId: companyId },
        include: requestInclude,
      });
      if (!row) throw httpError(404, "Not found");
      const calc = await prisma.calculation.findFirst({
        where: { id: calculationId, companyId: companyId },
      });
      if (!calc) throw httpError(404, "Calculation not found");
      if (row.calculationId && row.calculationId !== calculationId) {
        throw httpError(409, "Request already linked to a calculation");
      }
      const updated = await prisma.skuOrderRequest.update({
        where: { id },
        data: { calculationId },
        include: requestInclude,
      });
      json(res, 200, toClientView(updated, null));
      return true;
    }

    json(res, 405, { error: "Method not allowed" });
    return true;
  } catch (e) {
    json(res, e.status || 400, { error: e instanceof Error ? e.message : "Error" });
    return true;
  }
}

export async function handleManufacturerOrderRoutes({
  req,
  res,
  url,
  prisma,
  authorize,
  json,
  readBody,
  ensureManufacturerCompany,
}) {
  const path = url.pathname;
  if (!path.startsWith("/v1/manufacturer/order-requests") && !path.startsWith("/v1/manufacturer/pools")) {
    return false;
  }

  const user = authorize(req);
  if (!user) {
    json(res, 401, { error: "Unauthorized" });
    return true;
  }

  try {
    const company = await ensureManufacturerCompany(prisma, user.userId, user.role);

    if (req.method === "GET" && path === "/v1/manufacturer/order-requests") {
      const status = url.searchParams.get("status");
      const where = { manufacturerSku: { companyId: company.id } };
      if (status && REQUEST_STATUSES.has(status)) where.status = status;
      const rows = await prisma.skuOrderRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: manufacturerRequestInclude,
      });
      json(res, 200, rows.map(toMfgRequestView));
      return true;
    }

    const acceptMatch = path.match(/^\/v1\/manufacturer\/order-requests\/([^/]+)\/accept$/);
    if (req.method === "POST" && acceptMatch) {
      const id = decodeURIComponent(acceptMatch[1]);
      const body = await readBody(req);
      const row = await prisma.skuOrderRequest.findFirst({
        where: { id, manufacturerSku: { companyId: company.id } },
        include: manufacturerRequestInclude,
      });
      if (!row) throw httpError(404, "Not found");
      if (row.status !== "SUBMITTED") throw httpError(409, "Can only accept a submitted request");
      const sku = row.manufacturerSku;
      if (!sku || sku.status !== "PUBLISHED") throw httpError(400, "Published SKU not found");
      const pool = await openPoolForSku(prisma, company.id, sku, str(body?.poolId, 64));
      const updated = await prisma.skuOrderRequest.update({
        where: { id },
        data: { status: "POOLED", poolId: pool.id, rejectReason: null },
        include: manufacturerRequestInclude,
      });
      json(res, 200, toMfgRequestView(updated));
      return true;
    }

    const rejectMatch = path.match(/^\/v1\/manufacturer\/order-requests\/([^/]+)\/reject$/);
    if (req.method === "POST" && rejectMatch) {
      const id = decodeURIComponent(rejectMatch[1]);
      const body = await readBody(req);
      const reason = str(body?.reason, 400);
      if (!reason || reason.length < 2) throw httpError(400, "reason required");
      const row = await prisma.skuOrderRequest.findFirst({
        where: { id, manufacturerSku: { companyId: company.id } },
      });
      if (!row) throw httpError(404, "Not found");
      if (row.status !== "SUBMITTED") throw httpError(409, "Can only reject a submitted request");
      const updated = await prisma.skuOrderRequest.update({
        where: { id },
        data: { status: "REJECTED", rejectReason: reason },
        include: manufacturerRequestInclude,
      });
      json(res, 200, toMfgRequestView(updated));
      return true;
    }

    if (req.method === "GET" && path === "/v1/manufacturer/pools") {
      const rows = await prisma.skuOrderPool.findMany({
        where: { manufacturerCompanyId: company.id },
        orderBy: { updatedAt: "desc" },
        include: poolInclude,
      });
      json(res, 200, rows.map(toPoolView));
      return true;
    }

    if (req.method === "POST" && path === "/v1/manufacturer/pools") {
      const body = await readBody(req);
      const manufacturerSkuId = str(body?.manufacturerSkuId, 64);
      if (!manufacturerSkuId) throw httpError(400, "manufacturerSkuId required");
      const sku = await requirePublishedSku(prisma, manufacturerSkuId);
      if (sku.companyId !== company.id) throw httpError(403, "SKU is not yours");
      const row = await prisma.skuOrderPool.create({
        data: {
          manufacturerCompanyId: company.id,
          manufacturerSkuId: sku.id,
          title: str(body.title, 200) || `Сборный заказ ${sku.sku}`,
          targetQty: body.targetQty == null || body.targetQty === "" ? sku.moq ?? null : qtyOf(body.targetQty),
          note: str(body.note, 500) || null,
          status: "OPEN",
        },
        include: poolInclude,
      });
      json(res, 201, toPoolView(row));
      return true;
    }

    const confirmMatch = path.match(/^\/v1\/manufacturer\/pools\/([^/]+)\/confirm$/);
    if (req.method === "POST" && confirmMatch) {
      const id = decodeURIComponent(confirmMatch[1]);
      const pool = await prisma.skuOrderPool.findFirst({
        where: { id, manufacturerCompanyId: company.id },
        include: poolInclude,
      });
      if (!pool) throw httpError(404, "Not found");
      if (pool.status !== "OPEN") throw httpError(409, "Can only confirm an open pool");
      if (!(pool.requests || []).some((r) => r.status === "POOLED")) {
        throw httpError(409, "Pool has no accepted lines");
      }
      const updated = await prisma.skuOrderPool.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
        include: poolInclude,
      });
      json(res, 200, toPoolView(updated));
      return true;
    }

    const closeMatch = path.match(/^\/v1\/manufacturer\/pools\/([^/]+)\/close$/);
    if (req.method === "POST" && closeMatch) {
      const id = decodeURIComponent(closeMatch[1]);
      const pool = await prisma.skuOrderPool.findFirst({
        where: { id, manufacturerCompanyId: company.id },
        include: poolInclude,
      });
      if (!pool) throw httpError(404, "Not found");
      if (pool.status !== "OPEN" && pool.status !== "CONFIRMED") {
        throw httpError(409, "Can only close an open or confirmed pool");
      }
      const updated = await prisma.skuOrderPool.update({
        where: { id },
        data: { status: "CLOSED" },
        include: poolInclude,
      });
      json(res, 200, toPoolView(updated));
      return true;
    }

    json(res, 405, { error: "Method not allowed" });
    return true;
  } catch (e) {
    json(res, e.status || 400, { error: e instanceof Error ? e.message : "Error" });
    return true;
  }
}

void POOL_STATUSES;
