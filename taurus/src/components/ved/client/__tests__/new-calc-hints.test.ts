import { describe, expect, it } from "vitest";
import { newCalcStageTip } from "../NewCalcHints";
import type { CalcForm, FormItem } from "../types";

const baseForm = (patch: Partial<CalcForm> = {}): CalcForm => ({
  title: "",
  description: "",
  country: "",
  shipmentValue: "",
  shipmentCurrency: "USD",
  tariffCode: "STANDARD",
  preferredBrokerUserId: "",
  ...patch,
});

const item = (patch: Partial<FormItem> = {}): FormItem => ({
  name: "",
  qty: 1,
  unitPrice: 0,
  ...patch,
});

describe("newCalcStageTip", () => {
  it("asks for party title/description first", () => {
    expect(
      newCalcStageTip({
        form: baseForm(),
        items: [item()],
        hsCandidateCount: 0,
        maxPos: 3,
        hasCatalog: false,
        needsAttrsHint: false,
      })
    ).toMatch(/наименование и описание/i);
  });

  it("points to HS candidates when present and no hsHint", () => {
    expect(
      newCalcStageTip({
        form: baseForm({ title: "Кроссовки", description: "Обувь спортивная" }),
        items: [item({ name: "Air Max" })],
        hsCandidateCount: 2,
        maxPos: 3,
        hasCatalog: false,
        needsAttrsHint: false,
      })
    ).toMatch(/черновик кода/i);
  });

  it("requires origin / manufacturer / composition before directory search", () => {
    expect(
      newCalcStageTip({
        form: baseForm({ title: "A", description: "B" }),
        items: [item({ name: "Товар" })],
        hsCandidateCount: 0,
        maxPos: 3,
        hasCatalog: false,
        needsAttrsHint: true,
      })
    ).toMatch(/страна происхождения|производитель и состав/i);
  });

  it("still requires create attrs even when hsHint is set", () => {
    expect(
      newCalcStageTip({
        form: baseForm({ title: "A", description: "B" }),
        items: [item({ name: "Товар", attrs: { hsHint: "8517 13 000 0" } })],
        hsCandidateCount: 0,
        maxPos: 3,
        hasCatalog: false,
        needsAttrsHint: true,
      })
    ).toMatch(/страна происхождения|производитель и состав/i);
  });

  it("defers to attrs amber when required attrs + hsHint present but soft attrs empty", () => {
    expect(
      newCalcStageTip({
        form: baseForm({ title: "A", description: "B" }),
        items: [
          item({
            name: "Товар",
            attrs: {
              hsHint: "8517 13 000 0",
              originCountry: "CN",
              manufacturerName: "Foxconn",
              composition: "plastics",
            },
          }),
        ],
        hsCandidateCount: 0,
        maxPos: 3,
        hasCatalog: false,
        needsAttrsHint: true,
      })
    ).toBeNull();
  });

  it("mentions catalog when empty item and skus exist", () => {
    expect(
      newCalcStageTip({
        form: baseForm({ title: "A", description: "B" }),
        items: [item()],
        hsCandidateCount: 0,
        maxPos: 3,
        hasCatalog: true,
        needsAttrsHint: false,
      })
    ).toMatch(/эталон SKU|производител/i);
  });
});
