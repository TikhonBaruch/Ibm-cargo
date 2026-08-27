import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SUPER_ADMIN_BASE,
  SUPER_ADMIN_LOGIN_EMAIL,
  isSuperAdminLoginPath,
  isSuperAdminSurfacePath,
} from "../super-admin";

const vedRoot = path.join(__dirname, "..");
const repoRoot = path.join(vedRoot, "../../..");

describe("public surface hygiene", () => {
  it("keeps demo hint on public /login", () => {
    const src = fs.readFileSync(path.join(repoRoot, "app/login/page.tsx"), "utf8");
    expect(src).toContain("Демо:");
    expect(src).toMatch(/demo1234/);
    expect(src).toContain("client@example.com");
    expect(src).toContain("broker@example.com");
    expect(src).toContain("admin@example.com");
    const visible = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(visible).toMatch(/Демо: client@example.com \/ broker@example.com \/ admin@example.com/);
  });

  it("hides designer-stub badge while keeping restore markup in source", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "src/lbm-bro/components/designer-stub.tsx"),
      "utf8",
    );
    expect(src).toContain("return null");
    expect(src).toContain("Restore visual");
  });

  it("hides manufacturer tile on designer home while keeping restore markup", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/client/ClientSuperappHome.tsx"),
      "utf8",
    );
    const visible = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(src).toContain("C6 restore manufacturer tile");
    expect(src).toContain('gt-title">Производитель');
    expect(visible).not.toMatch(/gt-title">Производитель/);
  });

  it("does not list obscure path in robots.txt", () => {
    const robots = fs.readFileSync(path.join(repoRoot, "public/robots.txt"), "utf8");
    expect(robots).toContain("Disallow: /admin/");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).not.toContain(SUPER_ADMIN_BASE);
    expect(robots).not.toContain("ibm-cargo.vercel.app");
  });

  it("encodes SUPER path/email in super-admin source", () => {
    const src = fs.readFileSync(path.join(vedRoot, "super-admin.ts"), "utf8");
    expect(src).not.toContain(SUPER_ADMIN_BASE);
    expect(src).not.toContain(SUPER_ADMIN_LOGIN_EMAIL);
    expect(isSuperAdminSurfacePath(SUPER_ADMIN_BASE)).toBe(true);
    expect(isSuperAdminLoginPath(`${SUPER_ADMIN_BASE}/login`)).toBe(true);
  });

  it("locks live /cabinet/new to designer first-step chrome (C10/C11/C12)", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/client/NewCalcPane.tsx"),
      "utf8",
    );
    expect(src).toContain("Что ввозите?");
    expect(src).toContain("Первый код бесплатный");
    expect(src).toContain("Бесплатно");
    expect(src).toContain("Первый просчёт — 0 ₽");
    expect(src).toContain("Перетащите фото товара или сделайте снимок");
    expect(src).toContain("Документы и фото");
    expect(src).toContain("По заявке");
    expect(src).toContain("Мультипозиция");
    expect(src).toContain("Прикрепить файл");
    expect(src).toContain("pack-modal");
    expect(src).toContain("Уточняем для точности кода");
    expect(src).toContain("ClarifyField");
    expect(src).toContain("getClarificationQuestions");
    expect(src).toContain("Пока пропустить");
    expect(src).not.toContain("tariff-mini");
    expect(src).not.toContain("ProductCsvImport");
    expect(src).not.toContain("HsCodeAutocomplete");
  });

  it("keeps a gap between stepper numbers and labels (C13)", () => {
    const css = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/lbm-cabinets-live.css"),
      "utf8",
    );
    const order = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/client/OrderDetail.tsx"),
      "utf8",
    );
    expect(order).toContain("view-client");
    expect(order).toContain("timeline");
    expect(css).toContain("0.4em");
  });

  it("shows origin country on live order detail (C14)", () => {
    const order = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/client/OrderDetail.tsx"),
      "utf8",
    );
    expect(order).toContain("Страна происхождения");
    expect(order).toContain("originCountryRuLabel");
  });

  it("locks live order card to lab 47892 page chrome (C15)", () => {
    const order = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/client/OrderDetail.tsx"),
      "utf8",
    );
    const cabinet = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/ClientCabinet.tsx"),
      "utf8",
    );
    const visual = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/lbm-pane-visual.ts"),
      "utf8",
    );
    expect(order).toContain("timeline");
    expect(order).toContain("clientOrderTimeline");
    expect(visual).toContain("Параметры");
    expect(visual).toContain("Платежи");
    expect(order).toContain("Доплатить по этой заявке");
    expect(order).toContain("order-svc");
    expect(order).toContain("НДС 22%");
    expect(order).toContain("ПП 1637");
    expect(order).not.toContain("НДС 20%");
    expect(cabinet).not.toContain("OrderDetailDrawer");
    expect(cabinet).toContain("pane === \"order\"");
    expect(cabinet).toContain("hideSearch={pane === \"order\"}");
  });

  it("locks C16 visual match without copying lab domain", () => {
    const home = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/client/ClientSuperappHome.tsx"),
      "utf8",
    );
    const dash = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/client/DashboardPane.tsx"),
      "utf8",
    );
    const tnved = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/client/TnvedDirectoryPane.tsx"),
      "utf8",
    );
    const order = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/client/OrderDetail.tsx"),
      "utf8",
    );
    expect(home).toContain("Открыть мастер");
    expect(home).not.toContain("/api/v1/tnved/search");
    expect(dash).toContain("LIVE_FEED_FILTERS");
    expect(dash).toContain("liveFeedMatch");
    expect(dash).toContain("Подробнее");
    expect(tnved).not.toContain("Живой поиск GET");
    expect(order).not.toContain("shipmentValue");
    expect(order).toContain("НДС 22%");
    expect(order).not.toContain("НДС 20%");
  });

  it("locks C17 tnved directory chrome without copying lab domain", () => {
    const tnved = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/client/TnvedDirectoryPane.tsx"),
      "utf8",
    );
    const cabinet = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/ClientCabinet.tsx"),
      "utf8",
    );
    const helper = fs.readFileSync(
      path.join(repoRoot, "src/lib/ved/tnved-directory-read.ts"),
      "utf8",
    );
    expect(tnved).toContain("Оформить заявку по этому коду");
    expect(tnved).toContain("tnved-code");
    expect(tnved).toContain("metric-row");
    expect(tnved).toContain("Выберите группу или введите запрос");
    expect(tnved).toContain("НДС 22%");
    expect(tnved).not.toContain("НДС 20%");
    expect(tnved).not.toContain("Первый раз бесплатно");
    expect(tnved).not.toContain("Оплатить и открыть код");
    expect(tnved).not.toContain("consumeFreeHs");
    expect(tnved).not.toContain("loadTnved");
    expect(tnved).not.toContain("tnved.json");
    expect(helper).toContain("vatPct");
    expect(helper).toContain("22");
    expect(helper).not.toContain("Низкий");
    expect(cabinet).toContain("directoryPrefillFromQuery");
    expect(cabinet).toContain('search.get("hs")');
    expect(cabinet).toContain("onApplyCode");
  });

  it("obscure login page has no role/CMS label", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "app", SUPER_ADMIN_BASE.slice(1), "login/page.tsx"),
      "utf8"
    );
    expect(src).not.toMatch(/Супер-админ/);
    expect(src).not.toMatch(/Legacy CMS/);
  });
});
