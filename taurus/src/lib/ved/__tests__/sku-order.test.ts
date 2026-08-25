import { describe, expect, it, vi } from "vitest";
import {
  skuOrderRequestInputSchema,
  toClientRequestView,
  assertClientViewHidesOtherBuyers,
  toManufacturerRequestView,
  createClientRequest,
  cancelClientRequest,
  acceptManufacturerRequest,
  rejectManufacturerRequest,
  confirmManufacturerPool,
  createClientRequestsBulk,
  factoryNavBadge,
  attachOpenPoolSummaries,
  linkClientRequestCalc,
} from "../sku-order";

const publishedSku = {
  id: "sku1",
  sku: "NB-T14-16",
  name: "Ноутбук",
  status: "PUBLISHED",
  companyId: "mfg1",
  moq: 20,
};

function requestRow(over: Record<string, unknown> = {}) {
  return {
    id: "r1",
    clientCompanyId: "c1",
    manufacturerSkuId: "sku1",
    poolId: null,
    qty: 4,
    note: "хвост",
    status: "SUBMITTED",
    rejectReason: null,
    createdAt: new Date("2026-08-14"),
    manufacturerSku: publishedSku,
    clientCompany: { id: "c1", name: "ООО Импортёр", inn: "7701234567" },
    pool: null,
    ...over,
  };
}

describe("D34 sku order schema", () => {
  it("requires positive qty and published sku id", () => {
    expect(skuOrderRequestInputSchema.safeParse({ manufacturerSkuId: "x", qty: 2 }).success).toBe(
      true
    );
    expect(skuOrderRequestInputSchema.safeParse({ manufacturerSkuId: "x", qty: 0 }).success).toBe(
      false
    );
  });
});

describe("D34 privacy views", () => {
  it("client view has no other buyer company and no email", () => {
    const view = toClientRequestView(requestRow({ poolId: "p1", pool: { id: "p1", status: "OPEN" } }), 12);
    expect(view.pool).toMatchObject({ id: "p1", qtyTotal: 12 });
    expect(view).not.toHaveProperty("clientCompany");
    expect(() => assertClientViewHidesOtherBuyers(view)).not.toThrow();
  });

  it("manufacturer view includes company name/inn but not user email", () => {
    const view = toManufacturerRequestView(requestRow());
    expect(view.clientCompany).toEqual({ name: "ООО Импортёр", inn: "7701234567" });
    expect(JSON.stringify(view)).not.toMatch(/@/);
  });
});

describe("D34 request FSM", () => {
  it("createClientRequest rejects non-published SKU", async () => {
    const db = {
      manufacturerSku: { findFirst: vi.fn().mockResolvedValue(null) },
      skuOrderRequest: { create: vi.fn() },
    };
    await expect(createClientRequest(db as never, "c1", { manufacturerSkuId: "sku1", qty: 2 })).rejects.toThrow(
      /Published SKU/
    );
    expect(db.skuOrderRequest.create).not.toHaveBeenCalled();
  });

  it("createClientRequest writes SUBMITTED against published SKU", async () => {
    const created = requestRow();
    const db = {
      manufacturerSku: { findFirst: vi.fn().mockResolvedValue(publishedSku) },
      skuOrderRequest: { create: vi.fn().mockResolvedValue(created) },
    };
    const view = await createClientRequest(db as never, "c1", { manufacturerSkuId: "sku1", qty: 4 });
    expect(view.status).toBe("SUBMITTED");
    expect(db.skuOrderRequest.create).toHaveBeenCalled();
  });

  it("cancel only own SUBMITTED", async () => {
    const db = {
      skuOrderRequest: {
        findFirst: vi.fn().mockResolvedValue(requestRow({ status: "POOLED" })),
        update: vi.fn(),
      },
    };
    await expect(cancelClientRequest(db as never, "c1", "r1")).rejects.toThrow(/cancel/);
    expect(db.skuOrderRequest.update).not.toHaveBeenCalled();
  });

  it("accept moves SUBMITTED into OPEN pool for factory SKU", async () => {
    const db = {
      manufacturerSku: { findFirst: vi.fn() },
      skuOrderRequest: {
        findFirst: vi.fn().mockResolvedValue(requestRow()),
        update: vi.fn().mockResolvedValue(requestRow({ status: "POOLED", poolId: "p1" })),
      },
      skuOrderPool: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "p1",
          manufacturerCompanyId: "mfg1",
          manufacturerSkuId: "sku1",
          status: "OPEN",
          requests: [],
        }),
      },
    };
    const view = await acceptManufacturerRequest(db as never, "mfg1", "r1", {});
    expect(view.status).toBe("POOLED");
    expect(db.skuOrderPool.create).toHaveBeenCalled();
  });

  it("reject requires reason and SUBMITTED", async () => {
    const db = {
      skuOrderRequest: {
        findFirst: vi.fn().mockResolvedValue(requestRow()),
        update: vi.fn().mockResolvedValue(requestRow({ status: "REJECTED", rejectReason: "нет объёма" })),
      },
    };
    const view = await rejectManufacturerRequest(db as never, "mfg1", "r1", { reason: "нет объёма" });
    expect(view.status).toBe("REJECTED");
  });

  it("confirm pool requires at least one POOLED line", async () => {
    const db = {
      skuOrderPool: {
        findFirst: vi.fn().mockResolvedValue({
          id: "p1",
          manufacturerCompanyId: "mfg1",
          manufacturerSkuId: "sku1",
          status: "OPEN",
          requests: [{ status: "SUBMITTED", qty: 1 }],
        }),
        update: vi.fn(),
      },
    };
    await expect(confirmManufacturerPool(db as never, "mfg1", "p1")).rejects.toThrow(/no accepted/);
  });

  it("wholesale bulk collects per-line errors", async () => {
    const db = {
      manufacturerSku: {
        findFirst: vi.fn().mockResolvedValueOnce(publishedSku).mockResolvedValueOnce(null),
      },
      skuOrderRequest: { create: vi.fn().mockResolvedValue(requestRow()) },
    };
    const out = await createClientRequestsBulk(db as never, "c1", {
      lines: [
        { manufacturerSkuId: "sku1", qty: 2 },
        { manufacturerSkuId: "missing", qty: 3 },
      ],
    });
    expect(out.created).toHaveLength(1);
    expect(out.errors).toEqual([{ index: 1, error: "Published SKU not found" }]);
  });
});

describe("D34 client cabinet v1.1 helpers", () => {
  it("factoryNavBadge counts in-flight and unlinked CONFIRMED", () => {
    expect(
      factoryNavBadge([
        { status: "SUBMITTED" },
        { status: "POOLED" },
        { status: "CONFIRMED", calculationId: null },
        { status: "CONFIRMED", calculationId: "calc1" },
        { status: "REJECTED" },
        { status: "CANCELLED" },
      ])
    ).toBe(3);
  });

  it("attachOpenPoolSummaries is aggregate-only (no buyer PII)", async () => {
    const db = {
      skuOrderPool: {
        findMany: vi.fn().mockResolvedValue([
          {
            manufacturerSkuId: "sku1",
            targetQty: 20,
            requests: [
              { qty: 8, clientCompany: { name: "Secret" } },
              { qty: 4 },
            ],
          },
        ]),
      },
    };
    const out = await attachOpenPoolSummaries(db as never, [{ id: "sku1", sku: "NB" }]);
    expect(out[0].openPool).toEqual({ qtyTotal: 12, targetQty: 20 });
    expect(JSON.stringify(out)).not.toMatch(/Secret/);
    expect(JSON.stringify(out)).not.toMatch(/clientCompany/);
  });

  it("linkClientRequestCalc rejects another company's calculation", async () => {
    const db = {
      skuOrderRequest: {
        findFirst: vi.fn().mockResolvedValue(requestRow()),
        update: vi.fn(),
      },
      calculation: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    await expect(
      linkClientRequestCalc(db as never, "c1", "r1", { calculationId: "calc-x" })
    ).rejects.toThrow(/Calculation not found/);
    expect(db.skuOrderRequest.update).not.toHaveBeenCalled();
  });
});
