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

  it("locks live /cabinet/new to designer first-step chrome (C10)", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "src/components/ved/client/NewCalcPane.tsx"),
      "utf8",
    );
    expect(src).toContain("Что ввозите?");
    expect(src).toContain("Первый код бесплатный");
    expect(src).toContain("Бесплатно");
    expect(src).toContain("Первый просчёт — 0 ₽");
    expect(src).toContain("Перетащите фото товара или сделайте снимок");
    expect(src).toContain("По заявке");
    expect(src).not.toContain("tariff-mini");
    expect(src).not.toContain("ProductCsvImport");
    expect(src).not.toContain("Страна происхождения");
    expect(src).not.toContain("HsCodeAutocomplete");
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
