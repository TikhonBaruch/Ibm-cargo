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
  });

  it("does not list obscure path in robots.txt", () => {
    const robots = fs.readFileSync(path.join(repoRoot, "public/robots.txt"), "utf8");
    expect(robots).toContain("Disallow: /admin/");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).not.toContain(SUPER_ADMIN_BASE);
  });

  it("encodes SUPER path/email in super-admin source", () => {
    const src = fs.readFileSync(path.join(vedRoot, "super-admin.ts"), "utf8");
    expect(src).not.toContain(SUPER_ADMIN_BASE);
    expect(src).not.toContain(SUPER_ADMIN_LOGIN_EMAIL);
    expect(isSuperAdminSurfacePath(SUPER_ADMIN_BASE)).toBe(true);
    expect(isSuperAdminLoginPath(`${SUPER_ADMIN_BASE}/login`)).toBe(true);
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
