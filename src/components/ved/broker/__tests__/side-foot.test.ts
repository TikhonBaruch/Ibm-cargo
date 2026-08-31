import { describe, expect, it } from "vitest";
import { formatBrokerSideFoot, factorySkuSnapshotLine } from "../types";

describe("formatBrokerSideFoot (F21)", () => {
  it("formats rating and closed/week like design ref", () => {
    expect(
      formatBrokerSideFoot({
        preferredClaimHours: 4,
        rating: 4.9,
        closedPerWeek: 28,
      })
    ).toEqual({
      slaLine: "SLA: ≤ 4 ч",
      ratingLine: "Рейтинг ★ 4.9 · 28 закрыто / нед.",
    });
  });

  it("defaults rating and closed when missing", () => {
    expect(formatBrokerSideFoot({ preferredClaimHours: 0 })).toEqual({
      slaLine: "SLA: ≤ 4 ч",
      ratingLine: "Рейтинг ★ 5.0 · 0 закрыто / нед.",
    });
  });
});

describe("factorySkuSnapshotLine (B2)", () => {
  it("returns null without sku id or extra.sku", () => {
    expect(factorySkuSnapshotLine({ attrs: { brand: "Lenovo" } })).toBeNull();
  });

  it("summarizes snapshot without exposing PII", () => {
    expect(
      factorySkuSnapshotLine({
        manufacturerSkuId: "s1",
        attrs: { brand: "Lenovo", extra: { sku: "NB-T14-16" }, netWeightKg: 1.4, originCountry: "CN" },
      })
    ).toBe("SKU NB-T14-16 · бренд Lenovo · 1.4 кг · origin CN");
  });

  it("omits net weight when includeWeight is false (C8)", () => {
    expect(
      factorySkuSnapshotLine({
        manufacturerSkuId: "s1",
        includeWeight: false,
        attrs: { brand: "Lenovo", extra: { sku: "NB-T14-16" }, netWeightKg: 1.4, originCountry: "CN" },
      })
    ).toBe("SKU NB-T14-16 · бренд Lenovo · origin CN");
  });
});
