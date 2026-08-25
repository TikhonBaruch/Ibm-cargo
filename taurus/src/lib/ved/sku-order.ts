/**
 * Factory order requests + consolidated pools (D34).
 * Isolated from Calculation D8 FSM: manufacturer confirms qty into a сборный заказ.
 */
import { z } from "zod";

export const CLIENT_SEGMENTS = ["SINGLE", "RETAIL_SMALL", "WHOLESALE"] as const;
export type ClientSegment = (typeof CLIENT_SEGMENTS)[number];

export const SKU_ORDER_REQUEST_STATUSES = ["SUBMITTED", "REJECTED", "POOLED", "CANCELLED"] as const;
export type SkuOrderRequestStatus = (typeof SKU_ORDER_REQUEST_STATUSES)[number];

export const SKU_ORDER_POOL_STATUSES = ["OPEN", "CONFIRMED", "CLOSED", "CANCELLED"] as const;
export type SkuOrderPoolStatus = (typeof SKU_ORDER_POOL_STATUSES)[number];

export const clientSegmentSchema = z.enum(CLIENT_SEGMENTS);

export const skuOrderRequestInputSchema = z
  .object({
    manufacturerSkuId: z.string().trim().min(1).max(64),
    qty: z.number().int().positive().max(1_000_000),
    note: z.string().trim().max(500).optional(),
    calculationId: z.string().trim().max(64).optional(),
  })
  .strict();

export const skuOrderRequestBulkSchema = z
  .object({
    lines: z.array(skuOrderRequestInputSchema).min(1).max(50),
  })
  .strict();

export const skuOrderLinkCalcSchema = z
  .object({
    calculationId: z.string().trim().min(1).max(64),
  })
  .strict();

export const skuOrderRejectSchema = z
  .object({
    reason: z.string().trim().min(2).max(400),
  })
  .strict();

export function factoryNavBadge(
  rows: Array<{ status: string; calculationId?: string | null }>
): number {
  return rows.filter((r) => {
    if (r.status === "SUBMITTED" || r.status === "POOLED") return true;
    if (r.status === "CONFIRMED" && !r.calculationId) return true;
    return false;
  }).length;
}

export type OpenPoolSummary = { qtyTotal: number; targetQty: number | null };

export async function attachOpenPoolSummaries<T extends { id: string }>(
  db: SkuOrderDb,
  cards: T[]
): Promise<Array<T & { openPool: OpenPoolSummary | null }>> {
  if (!cards.length) return cards.map((c) => ({ ...c, openPool: null }));
  const ids = cards.map((c) => c.id);
  const pools = await db.skuOrderPool.findMany({
    where: { status: "OPEN", manufacturerSkuId: { in: ids } },
    include: {
      requests: { where: { status: "POOLED" }, select: { qty: true } },
    },
  });
  const bySku = new Map<string, OpenPoolSummary>();
  for (const pool of pools) {
    const qtyTotal = (pool.requests || []).reduce((sum, r) => sum + r.qty, 0);
    const prev = bySku.get(pool.manufacturerSkuId);
    const nextQty = (prev?.qtyTotal ?? 0) + qtyTotal;
    bySku.set(pool.manufacturerSkuId, {
      qtyTotal: nextQty,
      targetQty: pool.targetQty ?? prev?.targetQty ?? null,
    });
  }
  return cards.map((card) => ({ ...card, openPool: bySku.get(card.id) ?? null }));
}

export async function linkClientRequestCalc(
  db: SkuOrderDb,
  clientCompanyId: string,
  requestId: string,
  raw: unknown
) {
  const input = skuOrderLinkCalcSchema.parse(raw);
  const row = await db.skuOrderRequest.findFirst({
    where: { id: requestId, clientCompanyId },
    include: requestInclude,
  });
  if (!row) throw httpStatus("Not found", 404);
  const calc = await db.calculation.findFirst({
    where: { id: input.calculationId, companyId: clientCompanyId },
  });
  if (!calc) throw httpStatus("Calculation not found", 404);
  if (row.calculationId && row.calculationId !== input.calculationId) {
    throw httpStatus("Request already linked to a calculation", 409);
  }
  const updated = await db.skuOrderRequest.update({
    where: { id: requestId },
    data: { calculationId: input.calculationId },
    include: requestInclude,
  });
  const view = toClientRequestView(updated);
  assertClientViewHidesOtherBuyers(view);
  return view;
}

export const skuOrderPoolInputSchema = z
  .object({
    manufacturerSkuId: z.string().trim().min(1).max(64),
    title: z.string().trim().max(200).optional(),
    targetQty: z.number().int().positive().max(1_000_000).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const skuOrderAcceptSchema = z
  .object({
    poolId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

function httpStatus(message: string, status: number) {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

type SkuRow = {
  id: string;
  sku: string;
  name: string;
  status: string;
  companyId: string;
  moq?: number | null;
};

type CompanyBrief = { id: string; name: string; inn?: string | null };

type RequestRow = {
  id: string;
  clientCompanyId: string;
  manufacturerSkuId: string;
  poolId?: string | null;
  qty: number;
  note?: string | null;
  calculationId?: string | null;
  status: string;
  rejectReason?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  manufacturerSku?: SkuRow;
  clientCompany?: CompanyBrief;
  pool?: {
    id: string;
    status: string;
    title?: string | null;
    targetQty?: number | null;
  } | null;
};

type PoolRow = {
  id: string;
  manufacturerCompanyId: string;
  manufacturerSkuId: string;
  status: string;
  title?: string | null;
  targetQty?: number | null;
  note?: string | null;
  confirmedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  manufacturerSku?: SkuRow;
  requests?: RequestRow[];
};

export type SkuOrderDb = {
  manufacturerSku: {
    findFirst: (args: any) => Promise<SkuRow | null>;
  };
  calculation: {
    findFirst: (args: any) => Promise<{ id: string; companyId?: string | null } | null>;
  };
  skuOrderRequest: {
    findMany: (args: any) => Promise<RequestRow[]>;
    findFirst: (args: any) => Promise<RequestRow | null>;
    create: (args: any) => Promise<RequestRow>;
    update: (args: any) => Promise<RequestRow>;
    count: (args: any) => Promise<number>;
  };
  skuOrderPool: {
    findMany: (args: any) => Promise<PoolRow[]>;
    findFirst: (args: any) => Promise<PoolRow | null>;
    create: (args: any) => Promise<PoolRow>;
    update: (args: any) => Promise<PoolRow>;
    count: (args: any) => Promise<number>;
  };
};

const requestInclude = {
  manufacturerSku: { select: { id: true, sku: true, name: true, status: true, companyId: true, moq: true } },
  pool: { select: { id: true, status: true, title: true, targetQty: true } },
} as const;

const manufacturerRequestInclude = {
  ...requestInclude,
  clientCompany: { select: { id: true, name: true, inn: true } },
} as const;

const poolInclude = {
  manufacturerSku: { select: { id: true, sku: true, name: true, status: true, companyId: true, moq: true } },
  requests: {
    include: {
      clientCompany: { select: { id: true, name: true, inn: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

async function requirePublishedSku(db: SkuOrderDb, id: string): Promise<SkuRow> {
  const sku = await db.manufacturerSku.findFirst({
    where: { id, status: "PUBLISHED" },
    select: { id: true, sku: true, name: true, status: true, companyId: true, moq: true },
  });
  if (!sku) throw httpStatus("Published SKU not found", 400);
  return sku;
}

export function toClientRequestView(
  row: RequestRow,
  poolQtyTotal?: number | null
): Record<string, unknown> {
  const sku = row.manufacturerSku;
  const pool = row.pool
    ? {
        id: row.pool.id,
        status: row.pool.status,
        title: row.pool.title ?? null,
        targetQty: row.pool.targetQty ?? null,
        qtyTotal: poolQtyTotal ?? null,
      }
    : null;
  return {
    id: row.id,
    qty: row.qty,
    note: row.note ?? null,
    status: row.status,
    rejectReason: row.rejectReason ?? null,
    createdAt: row.createdAt,
    manufacturerSku: sku
      ? { id: sku.id, sku: sku.sku, name: sku.name, moq: sku.moq ?? null }
      : { id: row.manufacturerSkuId },
    calculationId: row.calculationId ?? null,
    pool,
  };
}

export function assertClientViewHidesOtherBuyers(view: Record<string, unknown>) {
  const blob = JSON.stringify(view);
  if (/"clientCompany"/.test(blob) || /"email"/.test(blob)) {
    throw httpStatus("PII leak in client order view", 500);
  }
}

export function toManufacturerRequestView(row: RequestRow): Record<string, unknown> {
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

export function toPoolView(row: PoolRow, opts?: { includeBuyers?: boolean }): Record<string, unknown> {
  const requests = row.requests || [];
  const pooledQty = requests.filter((r) => r.status === "POOLED").reduce((sum, r) => sum + r.qty, 0);
  const includeBuyers = opts?.includeBuyers !== false;
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
    requests: includeBuyers
      ? requests.map((r) => ({
          id: r.id,
          qty: r.qty,
          status: r.status,
          note: r.note ?? null,
          clientCompany: r.clientCompany
            ? { name: r.clientCompany.name, inn: r.clientCompany.inn ?? null }
            : null,
        }))
      : requests.map((r) => ({ id: r.id, qty: r.qty, status: r.status })),
  };
}

async function poolQtyTotal(db: SkuOrderDb, poolId: string): Promise<number> {
  const rows = await db.skuOrderRequest.findMany({
    where: { poolId, status: "POOLED" },
    select: { qty: true },
  });
  return rows.reduce((sum, r) => sum + r.qty, 0);
}

export async function createClientRequest(
  db: SkuOrderDb,
  clientCompanyId: string,
  raw: unknown
) {
  const input = skuOrderRequestInputSchema.parse(raw);
  await requirePublishedSku(db, input.manufacturerSkuId);
  const row = await db.skuOrderRequest.create({
    data: {
      clientCompanyId,
      manufacturerSkuId: input.manufacturerSkuId,
      qty: input.qty,
      note: input.note || null,
      calculationId: input.calculationId || null,
      status: "SUBMITTED",
    },
    include: requestInclude,
  });
  const view = toClientRequestView(row);
  assertClientViewHidesOtherBuyers(view);
  return view;
}

export async function createClientRequestsBulk(
  db: SkuOrderDb,
  clientCompanyId: string,
  raw: unknown
) {
  const input = skuOrderRequestBulkSchema.parse(raw);
  const created: Record<string, unknown>[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  for (let i = 0; i < input.lines.length; i++) {
    try {
      created.push(await createClientRequest(db, clientCompanyId, input.lines[i]));
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : "Error" });
    }
  }
  return { created, errors };
}

export async function listClientRequests(db: SkuOrderDb, clientCompanyId: string) {
  const rows = await db.skuOrderRequest.findMany({
    where: { clientCompanyId },
    orderBy: { createdAt: "desc" },
    include: requestInclude,
  });
  const poolIds = [...new Set(rows.map((r) => r.poolId).filter(Boolean))] as string[];
  const qtyByPool: Record<string, number> = {};
  await Promise.all(
    poolIds.map(async (id) => {
      qtyByPool[id] = await poolQtyTotal(db, id);
    })
  );
  return rows.map((row) => {
    const view = toClientRequestView(row, row.poolId ? qtyByPool[row.poolId] : null);
    assertClientViewHidesOtherBuyers(view);
    return view;
  });
}

export async function cancelClientRequest(db: SkuOrderDb, clientCompanyId: string, id: string) {
  const row = await db.skuOrderRequest.findFirst({
    where: { id, clientCompanyId },
    include: requestInclude,
  });
  if (!row) throw httpStatus("Not found", 404);
  if (row.status !== "SUBMITTED") throw httpStatus("Can only cancel a submitted request", 409);
  const updated = await db.skuOrderRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: requestInclude,
  });
  return toClientRequestView(updated);
}

export async function listManufacturerRequests(db: SkuOrderDb, manufacturerCompanyId: string, status?: string) {
  const where: Record<string, unknown> = {
    manufacturerSku: { companyId: manufacturerCompanyId },
  };
  if (status && SKU_ORDER_REQUEST_STATUSES.includes(status as SkuOrderRequestStatus)) {
    where.status = status;
  }
  const rows = await db.skuOrderRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: manufacturerRequestInclude,
  });
  return rows.map(toManufacturerRequestView);
}

export async function listManufacturerPools(db: SkuOrderDb, manufacturerCompanyId: string) {
  const rows = await db.skuOrderPool.findMany({
    where: { manufacturerCompanyId },
    orderBy: { updatedAt: "desc" },
    include: poolInclude,
  });
  return rows.map((row) => toPoolView(row, { includeBuyers: true }));
}

export async function createManufacturerPool(
  db: SkuOrderDb,
  manufacturerCompanyId: string,
  raw: unknown
) {
  const input = skuOrderPoolInputSchema.parse(raw);
  const sku = await requirePublishedSku(db, input.manufacturerSkuId);
  if (sku.companyId !== manufacturerCompanyId) throw httpStatus("SKU is not yours", 403);
  const row = await db.skuOrderPool.create({
    data: {
      manufacturerCompanyId,
      manufacturerSkuId: sku.id,
      title: input.title || `Сборный заказ ${sku.sku}`,
      targetQty: input.targetQty ?? sku.moq ?? null,
      note: input.note || null,
      status: "OPEN",
    },
    include: poolInclude,
  });
  return toPoolView(row, { includeBuyers: true });
}

async function loadOwnedRequest(db: SkuOrderDb, manufacturerCompanyId: string, id: string) {
  const row = await db.skuOrderRequest.findFirst({
    where: { id, manufacturerSku: { companyId: manufacturerCompanyId } },
    include: manufacturerRequestInclude,
  });
  if (!row) throw httpStatus("Not found", 404);
  return row;
}

async function openPoolForSku(
  db: SkuOrderDb,
  manufacturerCompanyId: string,
  sku: SkuRow,
  poolId?: string
) {
  if (poolId) {
    const pool = await db.skuOrderPool.findFirst({
      where: { id: poolId, manufacturerCompanyId },
      include: poolInclude,
    });
    if (!pool) throw httpStatus("Pool not found", 404);
    if (pool.status !== "OPEN") throw httpStatus("Pool is not open", 409);
    if (pool.manufacturerSkuId !== sku.id) throw httpStatus("Pool SKU mismatch", 409);
    return pool;
  }
  const existing = await db.skuOrderPool.findFirst({
    where: { manufacturerCompanyId, manufacturerSkuId: sku.id, status: "OPEN" },
    include: poolInclude,
  });
  if (existing) return existing;
  return db.skuOrderPool.create({
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

export async function acceptManufacturerRequest(
  db: SkuOrderDb,
  manufacturerCompanyId: string,
  id: string,
  raw: unknown
) {
  const input = skuOrderAcceptSchema.parse(raw ?? {});
  const row = await loadOwnedRequest(db, manufacturerCompanyId, id);
  if (row.status !== "SUBMITTED") throw httpStatus("Can only accept a submitted request", 409);
  const sku = row.manufacturerSku;
  if (!sku || sku.status !== "PUBLISHED") throw httpStatus("Published SKU not found", 400);
  const pool = await openPoolForSku(db, manufacturerCompanyId, sku, input.poolId);
  const updated = await db.skuOrderRequest.update({
    where: { id },
    data: { status: "POOLED", poolId: pool.id, rejectReason: null },
    include: manufacturerRequestInclude,
  });
  return toManufacturerRequestView(updated);
}

export async function rejectManufacturerRequest(
  db: SkuOrderDb,
  manufacturerCompanyId: string,
  id: string,
  raw: unknown
) {
  const input = skuOrderRejectSchema.parse(raw);
  const row = await loadOwnedRequest(db, manufacturerCompanyId, id);
  if (row.status !== "SUBMITTED") throw httpStatus("Can only reject a submitted request", 409);
  const updated = await db.skuOrderRequest.update({
    where: { id },
    data: { status: "REJECTED", rejectReason: input.reason },
    include: manufacturerRequestInclude,
  });
  return toManufacturerRequestView(updated);
}

export async function confirmManufacturerPool(db: SkuOrderDb, manufacturerCompanyId: string, id: string) {
  const pool = await db.skuOrderPool.findFirst({
    where: { id, manufacturerCompanyId },
    include: poolInclude,
  });
  if (!pool) throw httpStatus("Not found", 404);
  if (pool.status !== "OPEN") throw httpStatus("Can only confirm an open pool", 409);
  const pooled = (pool.requests || []).filter((r) => r.status === "POOLED");
  if (pooled.length === 0) throw httpStatus("Pool has no accepted lines", 409);
  const updated = await db.skuOrderPool.update({
    where: { id },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
    include: poolInclude,
  });
  return toPoolView(updated, { includeBuyers: true });
}

export async function closeManufacturerPool(db: SkuOrderDb, manufacturerCompanyId: string, id: string) {
  const pool = await db.skuOrderPool.findFirst({
    where: { id, manufacturerCompanyId },
    include: poolInclude,
  });
  if (!pool) throw httpStatus("Not found", 404);
  if (pool.status !== "OPEN" && pool.status !== "CONFIRMED") {
    throw httpStatus("Can only close an open or confirmed pool", 409);
  }
  const updated = await db.skuOrderPool.update({
    where: { id },
    data: { status: "CLOSED" },
    include: poolInclude,
  });
  return toPoolView(updated, { includeBuyers: true });
}

export async function requireUserCompanyId(
  db: { user: { findUnique: (args: any) => Promise<{ companyId?: string | null } | null> } },
  userId: string
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  if (!user?.companyId) throw httpStatus("No company", 400);
  return user.companyId;
}

export async function manufacturerOrderKpis(db: SkuOrderDb, manufacturerCompanyId: string) {
  const [requestSubmitted, poolsOpen, poolsConfirmed] = await Promise.all([
    db.skuOrderRequest.count({
      where: { status: "SUBMITTED", manufacturerSku: { companyId: manufacturerCompanyId } },
    }),
    db.skuOrderPool.count({ where: { manufacturerCompanyId, status: "OPEN" } }),
    db.skuOrderPool.count({ where: { manufacturerCompanyId, status: "CONFIRMED" } }),
  ]);
  return { requestSubmitted, poolsOpen, poolsConfirmed };
}

export const CLIENT_SEGMENT_LABELS: Record<ClientSegment, string> = {
  SINGLE: "Единичные заказы",
  RETAIL_SMALL: "Мелкая розница",
  WHOLESALE: "Опт",
};

export const CLIENT_SEGMENT_HINTS: Record<ClientSegment, string> = {
  SINGLE: "Один артикул за раз — запрос в сборный заказ производителя.",
  RETAIL_SMALL: "Мелкий объём идёт в общую сборку к MOQ, без своей полной партии.",
  WHOLESALE: "Много позиций — добавляйте строками или загрузкой CSV.",
};
