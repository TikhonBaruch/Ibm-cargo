import { describe, it, expect } from "vitest";
import {
  needsBroker,
  canTransition,
  assertTransition,
  computePayments,
  buildPdfHtml,
  nextCalculationNumber,
  PLATFORM_SETTING_KEYS,
  maxPositionsForTariff,
  sumItemPayments,
  normalizeBrokerExtraFee,
  sanitizeBrokerItemDescription,
  buildStubShippingQuotes,
  isPreferredExclusiveActive,
} from "../domain";

describe("VED domain — needsBroker", () => {
  it("EXPRESS skips broker when confidence is high", () => {
    expect(needsBroker("EXPRESS", 0.94, 0.75)).toBe(false);
  });

  it("EXPRESS requires broker when confidence below threshold", () => {
    expect(needsBroker("EXPRESS", 0.5, 0.75)).toBe(true);
  });

  it("STANDARD always needs broker", () => {
    expect(needsBroker("STANDARD", 0.99, 0.75)).toBe(true);
  });

  it("PRO always needs broker", () => {
    expect(needsBroker("PRO", 0.99, 0.75)).toBe(true);
  });

  it("null tariff behaves like EXPRESS for broker gate", () => {
    expect(needsBroker(null, 0.9, 0.75)).toBe(false);
    expect(needsBroker(undefined, 0.5, 0.75)).toBe(true);
  });
});

describe("VED domain — canTransition", () => {
  it("allows happy path DRAFT → … → DONE", () => {
    expect(canTransition("DRAFT", "AI_PROCESSING")).toBe(true);
    expect(canTransition("AI_PROCESSING", "AI_READY")).toBe(true);
    expect(canTransition("AI_READY", "AWAITING_PAYMENT")).toBe(true);
    expect(canTransition("AI_READY", "QUEUED")).toBe(true);
    expect(canTransition("AI_READY", "DONE")).toBe(true);
    expect(canTransition("AWAITING_PAYMENT", "QUEUED")).toBe(true);
    expect(canTransition("QUEUED", "IN_REVIEW")).toBe(true);
    expect(canTransition("IN_REVIEW", "DONE")).toBe(true);
  });

  it("allows Express pay shortcut AI_READY → DONE", () => {
    expect(canTransition("AWAITING_PAYMENT", "DONE")).toBe(true);
    expect(canTransition("AI_READY", "DONE")).toBe(true);
  });

  it("forbids illegal skips", () => {
    expect(canTransition("DRAFT", "DONE")).toBe(false);
    expect(canTransition("QUEUED", "DONE")).toBe(false);
  });

  it("terminal states have no outgoing transitions", () => {
    expect(canTransition("DONE", "QUEUED")).toBe(false);
    expect(canTransition("CANCELLED", "DRAFT")).toBe(false);
  });

  it("supports SLA_RISK recovery", () => {
    expect(canTransition("QUEUED", "SLA_RISK")).toBe(true);
    expect(canTransition("SLA_RISK", "IN_REVIEW")).toBe(true);
    expect(canTransition("SLA_RISK", "DONE")).toBe(true);
  });
});

describe("VED domain — assertTransition", () => {
  it("passes on legal transitions", () => {
    expect(() => assertTransition("AI_READY", "QUEUED")).not.toThrow();
    expect(() => assertTransition("QUEUED", "IN_REVIEW")).not.toThrow();
  });

  it("throws on illegal transitions", () => {
    expect(() => assertTransition("DRAFT", "DONE")).toThrow(/Illegal status transition/);
    expect(() => assertTransition("QUEUED", "DONE")).toThrow(/Illegal status transition/);
  });
});

describe("VED domain — computePayments", () => {
  it("matches laptop ballpark at 7% duty / 22% VAT / schedule fee / $18000 / rate 90", () => {
    const p = computePayments({
      shipmentValueUsd: 18000,
      dutyPercent: 7,
      vatPercent: 22,
      feeFromSchedule: true,
      usdRate: 90,
    });
    expect(p.customsValueRub).toBe(1_620_000);
    expect(p.dutyRub).toBe(113_400);
    expect(p.vatRub).toBe(381_348); // (1620000+113400)*0.22
    expect(p.feeRub).toBe(13_541); // ≤ 2.7M bracket
    expect(p.totalPaymentsRub).toBe(113_400 + 381_348 + 13_541);
  });

  it("defaults shipment to 18000 USD when omitted", () => {
    const p = computePayments({
      dutyPercent: 0,
      vatPercent: 22,
      feeRub: 1000,
      usdRate: 100,
    });
    expect(p.customsValueRub).toBe(1_800_000);
  });

  it("accepts explicit customsValueRub (invoice already in RUB)", () => {
    const p = computePayments({
      customsValueRub: 200_000,
      dutyPercent: 10,
      vatPercent: 22,
      feeFromSchedule: true,
      usdRate: 90,
    });
    expect(p.customsValueRub).toBe(200_000);
    expect(p.dutyRub).toBe(20_000);
    expect(p.vatRub).toBe(Math.round((200_000 + 20_000) * 0.22));
  });

  it("never returns negative totals for valid non-negative inputs", () => {
    const p = computePayments({
      shipmentValueUsd: 100,
      dutyPercent: 0,
      vatPercent: 0,
      feeRub: 0,
      usdRate: 90,
    });
    expect(p.totalPaymentsRub).toBeGreaterThanOrEqual(0);
  });
});

describe("VED domain — PDF / numbers", () => {
  it("nextCalculationNumber is deterministic", () => {
    expect(nextCalculationNumber(1)).toBe("#47801");
    expect(nextCalculationNumber(42)).toBe("#47842");
  });

  it("buildPdfHtml prefers hsCodeFinal and escapes structure", () => {
    const html = buildPdfHtml({
      number: "#47901",
      title: "Ноутбуки",
      hsCode: "8471",
      hsCodeFinal: "8471 30 000 0",
      dutyRub: 100,
      vatRub: 200,
      feeRub: 50,
      totalPaymentsRub: 350,
      confidence: 0.94,
      disclaimer: "stub",
    });
    expect(html).toContain("8471 30 000 0");
    expect(html).toContain("#47901");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("94%");
  });

  it("exposes platform setting keys for AI threshold", () => {
    expect(PLATFORM_SETTING_KEYS.confidenceThreshold).toBe("ved.confidenceThreshold");
  });
});

describe("VED domain — positions / quotes", () => {
  it("maxPositionsForTariff follows D10", () => {
    expect(maxPositionsForTariff("EXPRESS")).toBe(1);
    expect(maxPositionsForTariff("STANDARD")).toBe(3);
    expect(maxPositionsForTariff("PRO")).toBe(10);
  });

  it("sumItemPayments aggregates duty/VAT + fee", () => {
    expect(
      sumItemPayments(
        [
          { dutyRub: 100, vatRub: 200 },
          { dutyRub: 50, vatRub: 80 },
        ],
        40
      )
    ).toEqual({
      dutyRub: 150,
      vatRub: 280,
      feeRub: 40,
      extraFeeRub: 0,
      totalPaymentsRub: 470,
    });
  });

  it("sumItemPayments adds extraFee into total (not tariff)", () => {
    expect(
      sumItemPayments([{ dutyRub: 400, vatRub: 600 }], 50, 120)
    ).toEqual({
      dutyRub: 400,
      vatRub: 600,
      feeRub: 50,
      extraFeeRub: 120,
      totalPaymentsRub: 1170,
    });
  });

  it("normalizeBrokerExtraFee requires a note when amount > 0", () => {
    expect(normalizeBrokerExtraFee({ extraFeeRub: 0, extraFeeNote: "x" })).toEqual({
      extraFeeRub: 0,
      extraFeeNote: null,
    });
    expect(normalizeBrokerExtraFee({ extraFeeRub: 80, extraFeeNote: "досмотр" })).toEqual({
      extraFeeRub: 80,
      extraFeeNote: "досмотр",
    });
    expect(() => normalizeBrokerExtraFee({ extraFeeRub: 80, extraFeeNote: "  " })).toThrow(
      /прочие сборы/
    );
  });

  it("sanitizeBrokerItemDescription trims and caps, never invents client calc text", () => {
    expect(sanitizeBrokerItemDescription("  ноутбуки 15\"  ")).toBe('ноутбуки 15"');
    expect(sanitizeBrokerItemDescription("   ")).toBeNull();
  });

  it("buildStubShippingQuotes returns 3 schemes with preferred mode", () => {
    const q = buildStubShippingQuotes({
      origin: "Шанхай",
      destination: "Москва",
      preferredMode: "AIR",
    });
    expect(q).toHaveLength(3);
    expect(q.find((x) => x.mode === "AIR")?.selected).toBe(true);
  });

  it("buildPdfHtml includes mapping table when items provided", () => {
    const html = buildPdfHtml({
      number: "#1",
      title: "t",
      hsCodeFinal: "8471",
      items: [{ name: "Item A", hsCodeFinal: "8471 30", dutyRub: 10, vatRub: 20 }],
    });
    expect(html).toContain("Сопоставление позиций");
    expect(html).toContain("Item A");
  });

  it("buildPdfHtml shows broker commercial description and extra fees", () => {
    const html = buildPdfHtml({
      number: "#2",
      title: "t",
      hsCodeFinal: "8471",
      feeRub: 1231,
      extraFeeRub: 500,
      extraFeeNote: "досмотр",
      totalPaymentsRub: 1731,
      items: [
        {
          name: "Ноут",
          description: "Портативная ЭВМ, масса 1.8 кг",
          hsCodeFinal: "8471 30",
        },
      ],
    });
    expect(html).toContain("Портативная ЭВМ, масса 1.8 кг");
    expect(html).toContain("Прочие сборы");
    expect(html).toContain("досмотр");
    expect(html).not.toContain("TariffPlan");
  });

  it("buildPdfHtml includes invoice and total without freight", () => {
    const html = buildPdfHtml({
      number: "#3",
      title: "t",
      hsCodeFinal: "8471",
      dutyRub: 100,
      vatRub: 200,
      feeRub: 50,
      totalPaymentsRub: 350,
      goodsRub: 9180,
      landedWithoutFreightRub: 9530,
      perUnitRub: 953,
    });
    expect(html).toContain("Товар (инвойс)");
    expect(html).toContain("Итого без доставки");
    expect(html).toContain("На единицу");
  });
});

describe("isPreferredExclusiveActive", () => {
  it("is active within preferredClaimHours", () => {
    expect(
      isPreferredExclusiveActive({
        preferredBrokerUserId: "b1",
        queuedAt: new Date("2026-01-01T10:00:00Z"),
        preferredClaimHours: 4,
        now: new Date("2026-01-01T12:00:00Z"),
      })
    ).toBe(true);
  });

  it("expires after preferredClaimHours", () => {
    expect(
      isPreferredExclusiveActive({
        preferredBrokerUserId: "b1",
        queuedAt: new Date("2026-01-01T10:00:00Z"),
        preferredClaimHours: 4,
        now: new Date("2026-01-01T15:00:00Z"),
      })
    ).toBe(false);
  });

  it("inactive without preferred broker", () => {
    expect(
      isPreferredExclusiveActive({
        preferredBrokerUserId: null,
        queuedAt: new Date(),
        preferredClaimHours: 4,
      })
    ).toBe(false);
  });
});
