/**
 * D-SHIP DB integration (Vitest, Jest-compatible API).
 * Real PrismaClient — no Prisma mocks.
 *
 *   RUN_DB_INTEGRATION=1 npm run test:integration
 *
 * Requires local Postgres. Skips in test:ci.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { applyShippingTracking, createShippingRequest, ShippingError } from "../shipping";
import {
  cleanupShippingFixture,
  createTestPrisma,
  dbIntegrationEnabled,
  emptyFixtureIds,
  seedShippingCalc,
  type ShippingFixtureIds,
} from "./helpers/prisma-test";

const run = dbIntegrationEnabled();
const d = run ? describe : describe.skip;

d("D-SHIP: создание путевого листа и валидация статусов", () => {
  let prisma: PrismaClient;
  let ids: ShippingFixtureIds = emptyFixtureIds();

  beforeAll(() => {
    process.env.LOGISTICS_SERVICE_URL = "";
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await cleanupShippingFixture(prisma, ids);
    ids = emptyFixtureIds();
  });

  it("после DONE создаёт заявку QUOTED с trackingCode и выбранной котировкой", async () => {
    ids = await seedShippingCalc(prisma, "DONE");
    const created = await createShippingRequest(prisma, {
      userId: ids.userId,
      companyId: ids.companyId,
      calculationId: ids.calculationId,
      origin: "Шанхай",
      destination: "Москва",
      mode: "LCL",
      selectedQuoteId: "q_lcl",
    });
    ids.shippingIds.push(created.id);

    expect(created.status).toBe("QUOTED");
    expect(created.trackingCode).toMatch(/^LC-\d{4}$/);
    expect(created.origin).toBe("Шанхай");
    expect(created.destination).toBe("Москва");
    expect(created.mode).toBe("LCL");
    expect(created.calculationId).toBe(ids.calculationId);
    expect(created.selectedQuote).toMatchObject({ id: "q_lcl", mode: "LCL" });

    const persisted = await prisma.shippingRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(persisted.status).toBe("QUOTED");
    expect(Array.isArray(persisted.quotes)).toBe(true);
    expect((persisted.quotes as unknown[]).length).toBe(3);
  });

  it("отклоняет создание до DONE (D15)", async () => {
    ids = await seedShippingCalc(prisma, "QUEUED");
    await expect(
      createShippingRequest(prisma, {
        userId: ids.userId,
        companyId: ids.companyId,
        calculationId: ids.calculationId,
        origin: "Шанхай",
        destination: "Москва",
        mode: "AIR",
      })
    ).rejects.toMatchObject({
      name: "ShippingError",
      message: "Shipping only after DONE",
      httpStatus: 400,
    } satisfies Partial<ShippingError>);

    const leftover = await prisma.shippingRequest.count({
      where: { calculationId: ids.calculationId },
    });
    expect(leftover).toBe(0);
  });

  it("прогоняет статусы QUOTED → IN_TRANSIT → DELIVERED и игнорирует CANCELLED", async () => {
    ids = await seedShippingCalc(prisma, "DONE");
    const waybill = await createShippingRequest(prisma, {
      userId: ids.userId,
      companyId: ids.companyId,
      calculationId: ids.calculationId,
      origin: "Шанхай",
      destination: "Москва",
      mode: "AIR",
    });
    ids.shippingIds.push(waybill.id);
    expect(waybill.status).toBe("QUOTED");

    const inTransit = await applyShippingTracking(prisma, waybill, {
      trackingCode: waybill.trackingCode!,
      status: "IN_TRANSIT",
      events: [{ at: new Date().toISOString(), status: "IN_TRANSIT", label: "В пути" }],
    });
    expect(inTransit.status).toBe("IN_TRANSIT");
    expect(inTransit.trackingEvents).toHaveLength(1);

    const fromDb = await prisma.shippingRequest.findUniqueOrThrow({
      where: { id: waybill.id },
    });
    const delivered = await applyShippingTracking(prisma, fromDb, {
      trackingCode: fromDb.trackingCode!,
      status: "DELIVERED",
      events: [{ at: new Date().toISOString(), status: "DELIVERED", label: "Выдано" }],
    });
    expect(delivered.status).toBe("DELIVERED");

    const cancelledAttempt = await applyShippingTracking(prisma, delivered, {
      trackingCode: delivered.trackingCode!,
      status: "CANCELLED",
    });
    expect(cancelledAttempt.status).toBe("DELIVERED");

    const finalRow = await prisma.shippingRequest.findUniqueOrThrow({
      where: { id: waybill.id },
    });
    expect(finalRow.status).toBe("DELIVERED");
  });

  it("не оставляет фикстуры между тестами (очистка afterEach)", async () => {
    const leaked = await prisma.company.count({
      where: { name: { startsWith: "itest-ship-co-" } },
    });
    expect(leaked).toBe(0);
  });
});
