import { describe, expect, it } from "vitest";
import {
  clientOrderHsLabel,
  clientOrderNextStep,
  clientOrderStepper,
  liveFeedMatch,
  liveFeedProgress,
  newCalcWizardProgress,
  payoutStatusPill,
  resolveClientSearch,
  tariffMiniBlurb,
  wizardStepClass,
} from "../lbm-pane-visual";

describe("lbm pane visual mapping", () => {
  it("maps D8 statuses to next-step copy (not prototype draft/pay/ai)", () => {
    expect(clientOrderNextStep({ status: "AI_READY", paidAt: null })).toBe("Оплатить тариф");
    expect(clientOrderNextStep({ status: "QUEUED" })).toBe("Ожидайте брокера");
    expect(clientOrderNextStep({ status: "IN_REVIEW" })).toBe("Брокер проверяет код");
    expect(clientOrderNextStep({ status: "DONE" })).toBe("PDF готов · скачать");
    expect(clientOrderNextStep({ status: "AI_PROCESSING" })).toBe("AI подбирает код");
  });

  it("shows live HS when present (does not hide behind pay)", () => {
    expect(clientOrderHsLabel({ hsCode: "8517 12 000 0" })).toBe("8517 12 000 0");
    expect(clientOrderHsLabel({ hsCodeFinal: "8471 30 000 0", hsCode: "8471" })).toBe(
      "8471 30 000 0",
    );
    expect(clientOrderHsLabel({})).toBe("—");
  });

  it("builds EXPRESS stepper without a broker step", () => {
    const pay = clientOrderStepper({ status: "AI_READY", tariffCode: "EXPRESS" });
    expect(pay.labels).toEqual(["Товар", "Оплата", "PDF"]);
    expect(pay.current).toBe(1);
    const done = clientOrderStepper({ status: "DONE", tariffCode: "EXPRESS" });
    expect(done.current).toBe(2);
  });

  it("builds STANDARD stepper with broker after pay", () => {
    const queued = clientOrderStepper({ status: "QUEUED", tariffCode: "STANDARD" });
    expect(queued.labels).toEqual(["Товар", "Оплата", "Брокер", "PDF"]);
    expect(queued.current).toBe(2);
    const done = clientOrderStepper({ status: "DONE", tariffCode: "PRO" });
    expect(done.current).toBe(3);
  });

  it("advances new-calc wizard from goods to launch without hiding fields", () => {
    expect(newCalcWizardProgress({ hasGoods: false, hasTariff: true }).current).toBe(1);
    expect(newCalcWizardProgress({ hasGoods: true, hasTariff: false }).current).toBe(2);
    expect(newCalcWizardProgress({ hasGoods: true, hasTariff: true }).current).toBe(3);
    expect(wizardStepClass(1, 3)).toBe("done");
    expect(wizardStepClass(3, 3)).toBe("on");
  });

  it("keeps D10 tariff blurbs, not Код/Таможня/Под ключ", () => {
    expect(tariffMiniBlurb("EXPRESS")).toMatch(/AI/);
    expect(tariffMiniBlurb("STANDARD")).toMatch(/3/);
    expect(tariffMiniBlurb("PRO")).toMatch(/10/);
  });

  it("maps D8 statuses onto superapp feed chips", () => {
    expect(liveFeedMatch({ status: "AI_READY", paidAt: null }, "pay")).toBe(true);
    expect(liveFeedMatch({ status: "QUEUED" }, "work")).toBe(true);
    expect(liveFeedMatch({ status: "DONE", hsCodeFinal: "8471" }, "hs")).toBe(true);
    expect(liveFeedMatch({ status: "DONE" }, "done")).toBe(true);
    expect(liveFeedProgress("QUEUED")).toBeGreaterThan(liveFeedProgress("AI_READY"));
    expect(liveFeedProgress("DONE")).toBe(100);
  });

  it("resolves header search to live cabinet routes", () => {
    const path = (s: string) => `/cabinet${s}`;
    expect(
      resolveClientSearch({
        q: "HS-12",
        calcs: [{ id: "c1", number: "HS-12", title: "Ноутбуки" }],
        brokerNames: ["Иванов"],
        path,
      }),
    ).toBe("/cabinet/orders?id=c1");
    expect(
      resolveClientSearch({
        q: "Иванов",
        calcs: [],
        brokerNames: ["Иванов"],
        path,
      }),
    ).toBe("/cabinet/brokers");
    expect(resolveClientSearch({ q: "8471", calcs: [], brokerNames: [], path })).toBe(
      "/cabinet/tnved?q=8471",
    );
  });

  it("maps payout statuses onto prototype pills (not raw ACCRUED enum)", () => {
    expect(payoutStatusPill("ACCRUED")).toEqual({ label: "Начисление", cls: "blue" });
    expect(payoutStatusPill("DOCS_REQUESTED")).toEqual({ label: "Документы", cls: "warn" });
    expect(payoutStatusPill("PAID")).toEqual({ label: "Выплачено", cls: "ok" });
    expect(payoutStatusPill("UNKNOWN").cls).toBe("muted");
  });
});
