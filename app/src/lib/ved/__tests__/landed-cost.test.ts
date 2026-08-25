import { describe, expect, it } from "vitest";
import { computePayments } from "../domain";
import {
  assembleLandedWithoutFreight,
  formatShipmentInvoice,
  fxRatesFromSettings,
  invoiceCustomsValue,
  invoiceToRub,
  parseShipmentInvoice,
  refreshLandedPayments,
  sumItemQty,
} from "../landed-cost";

describe("landed-cost without freight", () => {
  const rates = fxRatesFromSettings({ usdRate: 90, cnyRate: 12.5, eurRate: 98, fxBufferPct: 2 });

  it("parses bare number as USD", () => {
    expect(parseShipmentInvoice("18000")).toEqual({ amount: 18000, currency: "USD" });
  });

  it("parses currency suffix and prefix", () => {
    expect(parseShipmentInvoice("15000 CNY")).toEqual({ amount: 15000, currency: "CNY" });
    expect(parseShipmentInvoice("CNY 15000")).toEqual({ amount: 15000, currency: "CNY" });
    expect(parseShipmentInvoice("12000", "EUR")).toEqual({ amount: 12000, currency: "EUR" });
  });

  it("formats USD without suffix for backward compat", () => {
    expect(formatShipmentInvoice(18000, "USD")).toBe("18000");
    expect(formatShipmentInvoice(15000, "CNY")).toBe("15000 CNY");
  });

  it("converts CNY with +2% buffer (not as USD)", () => {
    const goods = invoiceToRub(16_000, "CNY", rates);
    expect(goods).toBe(Math.round(16_000 * 12.5 * 1.02));
    expect(goods).not.toBe(Math.round(16_000 * 90));
  });

  it("builds landed = goods + duty + vat + fee", () => {
    const goodsRub = invoiceToRub(1000, "USD", rates);
    const pays = computePayments({
      customsValueRub: goodsRub,
      dutyPercent: 10,
      vatPercent: 22,
      feeFromSchedule: true,
      usdRate: 90,
    });
    const landed = assembleLandedWithoutFreight({
      invoiceAmount: 1000,
      currency: "USD",
      goodsRub,
      bufferPct: 2,
      dutyRub: pays.dutyRub,
      vatRub: pays.vatRub,
      feeRub: pays.feeRub,
      qty: 10,
    });
    expect(pays.customsValueRub).toBe(goodsRub);
    expect(landed.landedRub).toBe(goodsRub + pays.totalPaymentsRub);
    expect(landed.perUnitRub).toBe(Math.round(landed.landedRub / 10));
    expect(landed.note).toMatch(/без международной доставки/i);
  });

  it("refresh keeps goods, updates payments", () => {
    const snap = assembleLandedWithoutFreight({
      invoiceAmount: 100,
      currency: "USD",
      goodsRub: 9180,
      bufferPct: 2,
      dutyRub: 100,
      vatRub: 200,
      feeRub: 50,
    });
    const next = refreshLandedPayments(snap, { dutyRub: 400, vatRub: 600, feeRub: 80, extraFeeRub: 20 });
    expect(next?.goodsRub).toBe(9180);
    expect(next?.landedRub).toBe(9180 + 400 + 600 + 80 + 20);
  });

  it("sums item qty", () => {
    expect(sumItemQty([{ qty: 2 }, { qty: 3 }])).toBe(5);
    expect(sumItemQty([{ qty: null }])).toBeNull();
  });

  it("formats stored shipment and goodsRub with buffer", () => {
    const cv = invoiceCustomsValue("16000", "CNY", {
      usdRate: 90,
      cnyRate: 12.5,
      eurRate: 98,
      fxBufferPct: 2,
    });
    expect(cv.storedShipmentValue).toBe("16000 CNY");
    expect(cv.goodsRub).toBe(Math.round(16_000 * 12.5 * 1.02));
  });

  it("defaults missing FX keys", () => {
    const fallback = fxRatesFromSettings({});
    expect(fallback.cny).toBe(12.5);
    expect(fallback.bufferPct).toBe(2);
  });
});
