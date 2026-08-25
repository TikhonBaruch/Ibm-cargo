import { describe, expect, it, vi } from "vitest";
import { factoryUiEnabled, shippingUiEnabled } from "../cabinet-features";
import { getClientNav } from "@/components/ved/client/types";
import { getManufacturerNav } from "@/components/ved/manufacturer/types";

describe("cabinet-features", () => {
  it("shipping UI off by default", () => {
    expect(shippingUiEnabled({})).toBe(false);
  });

  it("shipping UI on with NEXT_PUBLIC_SHIPPING_UI=1", () => {
    expect(shippingUiEnabled({ NEXT_PUBLIC_SHIPPING_UI: "1" })).toBe(true);
  });

  it("shipping UI on with SHIPPING_UI=true", () => {
    expect(shippingUiEnabled({ SHIPPING_UI: "true" })).toBe(true);
  });

  it("rejects unknown truthy strings", () => {
    expect(shippingUiEnabled({ NEXT_PUBLIC_SHIPPING_UI: "yes" })).toBe(false);
  });

  it("factory UI off by default", () => {
    expect(factoryUiEnabled({})).toBe(false);
  });

  it("factory UI on with NEXT_PUBLIC_FACTORY_UI=1", () => {
    expect(factoryUiEnabled({ NEXT_PUBLIC_FACTORY_UI: "1" })).toBe(true);
  });
});

describe("getClientNav shipping visibility", () => {
  it("omits Настройки; profile owns company settings", () => {
    const labels = getClientNav("/cabinet", {}).map((i) => i.label);
    expect(labels).not.toContain("Настройки");
    expect(labels).toContain("Профиль");
    expect(labels).not.toContain("Производитель");
  });

  it("omits Перевозка when shipping UI is off", () => {
    const hrefs = getClientNav("/cabinet", {}).map((i) => i.href);
    expect(hrefs).not.toContain("/cabinet/shipping");
    expect(hrefs).toContain("/cabinet/orders");
  });

  it("keeps Перевозка when shipping UI is on", () => {
    const hrefs = getClientNav("/cabinet", { NEXT_PUBLIC_SHIPPING_UI: "1" }).map((i) => i.href);
    expect(hrefs).toContain("/cabinet/shipping");
  });

  it("keeps Производитель when factory UI is on", () => {
    const labels = getClientNav("/cabinet", { NEXT_PUBLIC_FACTORY_UI: "1" }).map((i) => i.label);
    expect(labels).toContain("Производитель");
  });

  it("reads process.env when nav called without override bag", () => {
    vi.stubEnv("NEXT_PUBLIC_FACTORY_UI", "1");
    expect(getClientNav("/cabinet").map((i) => i.label)).toContain("Производитель");
    vi.unstubAllEnvs();
  });
});

describe("getManufacturerNav factory visibility", () => {
  it("omits Сборные заказы when factory UI is off", () => {
    const labels = getManufacturerNav("/manufacturer", {}).map((i) => i.label);
    expect(labels).not.toContain("Сборные заказы");
    expect(labels).toContain("Каталог SKU");
  });

  it("keeps Сборные заказы when factory UI is on", () => {
    const labels = getManufacturerNav("/manufacturer", { NEXT_PUBLIC_FACTORY_UI: "1" }).map((i) => i.label);
    expect(labels).toContain("Сборные заказы");
  });
});
