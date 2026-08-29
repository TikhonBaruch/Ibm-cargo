import { describe, expect, it } from "vitest";
import { clientNavHint, clientNavTone } from "../LbmCabinetsShell";
import { clientNavHighlight } from "../lbm-pane-visual";
import { buildClientMobileTabs, clientMobileTabActive } from "../client/types";

const NAV = [
  { href: "/cabinet", label: "Главная" },
  { href: "/cabinet/orders", label: "Заявки" },
  { href: "/cabinet/tnved", label: "Справочник ТН ВЭД" },
  { href: "/cabinet/support", label: "Чат" },
  { href: "/cabinet/profile", label: "Компания" },
];

describe("lbm cabinet chrome mapping", () => {
  it("maps designer 5-tile labels to product-shell tones", () => {
    expect(clientNavTone("Главная")).toBe("nav-home");
    expect(clientNavTone("Заявки")).toBe("orders");
    expect(clientNavTone("Справочник ТН ВЭД")).toBe("tnved");
    expect(clientNavTone("Чат")).toBe("chats");
    expect(clientNavTone("Компания")).toBe("company");
  });

  it("keeps short hints under tiles", () => {
    expect(clientNavHint("Главная")).toBe("Кабинет");
    expect(clientNavHint("Заявки")).toBe("Просчёты");
    expect(clientNavHint("Справочник ТН ВЭД")).toBe("Коды ЕАЭС");
    expect(clientNavHint("Чат")).toBe("Брокер");
    expect(clientNavHint("Компания")).toBe("Профиль");
  });

  it("highlights orders for wizard, brokers, shipping and factory deep-links", () => {
    expect(clientNavHighlight("/cabinet/new", NAV)).toBe("/cabinet/orders");
    expect(clientNavHighlight("/cabinet/orders/abc", NAV)).toBe("/cabinet/orders");
    expect(clientNavHighlight("/cabinet/brokers", NAV)).toBe("/cabinet/orders");
    expect(clientNavHighlight("/cabinet/shipping", NAV)).toBe("/cabinet/orders");
    expect(clientNavHighlight("/cabinet/balance", NAV)).toBe("/cabinet/profile");
    expect(clientNavHighlight("/cabinet/faq", NAV)).toBe("/cabinet");
    expect(clientNavHighlight("/cabinet/tnved", NAV)).toBe("/cabinet/tnved");
  });
});

describe("client mobile tabbar", () => {
  it("builds 4 tabs + newHref from designer nav", () => {
    const { tabs, newHref } = buildClientMobileTabs(NAV, { newHref: "/cabinet/new" });
    expect(tabs.map((t) => t.key)).toEqual(["home", "orders", "chat", "company"]);
    expect(tabs.map((t) => t.href)).toEqual([
      "/cabinet",
      "/cabinet/orders",
      "/cabinet/support",
      "/cabinet/profile",
    ]);
    expect(newHref).toBe("/cabinet/new");
  });

  it("marks orders tab active on new calc path", () => {
    const { tabs } = buildClientMobileTabs(NAV);
    const orders = tabs.find((t) => t.key === "orders")!;
    expect(clientMobileTabActive("/cabinet/new", orders, "/cabinet/orders")).toBe(true);
    expect(clientMobileTabActive("/cabinet/orders/x", orders, "/cabinet/orders")).toBe(true);
    expect(clientMobileTabActive("/cabinet", orders, "/cabinet")).toBe(false);
  });
});
