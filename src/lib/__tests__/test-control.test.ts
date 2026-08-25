import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Test-control / inventory suite.
 * Ensures the project keeps a minimum safety net and that critical modules stay covered.
 * Run via: `npm run test:verify`
 */

const ROOT = path.resolve(__dirname, "../../..");

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (name.endsWith(".test.ts")) acc.push(full);
  }
  return acc;
}

describe("Test control — inventory", () => {
  const tests = walk(path.join(ROOT, "src"));

  it("keeps at least 5 unit test files under src/", () => {
    expect(tests.length).toBeGreaterThanOrEqual(5);
  });

  it("covers VED domain module", () => {
    const hit = tests.some((f) => f.includes(`${path.sep}ved${path.sep}`) && f.includes("domain.test"));
    expect(hit).toBe(true);
  });

  it("covers VED access / RBAC module", () => {
    const hit = tests.some((f) => f.includes("access.test"));
    expect(hit).toBe(true);
  });

  it("covers security probes", () => {
    const hit = tests.some((f) => f.includes("security.test"));
    expect(hit).toBe(true);
  });

  it("covers requireRole", () => {
    const hit = tests.some((f) => f.includes("require-role.test"));
    expect(hit).toBe(true);
  });

  it("critical source files exist", () => {
    const required = [
      "src/lib/ved/domain.ts",
      "src/lib/ved/access.ts",
      "src/lib/ved/calculations.ts",
      "src/lib/require-role.ts",
      "proxy.ts",
      "src/lib/ved/proxy.ts",
      "prisma/schema.prisma",
    ];
    for (const rel of required) {
      expect(fs.existsSync(path.join(ROOT, rel)), `missing ${rel}`).toBe(true);
    }
  });

  it("schema declares CLIENT and BROKER roles", () => {
    const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/\bCLIENT\b/);
    expect(schema).toMatch(/\bBROKER\b/);
    expect(schema).toMatch(/\bMANUFACTURER\b/);
    expect(schema).toMatch(/model ManufacturerSku/);
    expect(schema).toMatch(/model Calculation/);
    expect(schema).toMatch(/model TariffPlan/);
  });

  it("package.json exposes verify script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts["test:verify"]).toBeTruthy();
    expect(pkg.scripts["test:unit"]).toBeTruthy();
    expect(pkg.scripts["test:ci"]).toBeTruthy();
  });
});

describe("Test control — minimum assertion density", () => {
  it("domain.test.ts has enough cases", () => {
    const file = fs.readFileSync(
      path.join(ROOT, "src/lib/ved/__tests__/domain.test.ts"),
      "utf8"
    );
    const its = file.match(/\bit\(/g) || [];
    expect(its.length).toBeGreaterThanOrEqual(10);
  });

  it("security.test.ts has enough cases", () => {
    const file = fs.readFileSync(
      path.join(ROOT, "src/lib/ved/__tests__/security.test.ts"),
      "utf8"
    );
    const its = file.match(/\bit\(|it\.each/g) || [];
    expect(its.length).toBeGreaterThanOrEqual(5);
  });
});
