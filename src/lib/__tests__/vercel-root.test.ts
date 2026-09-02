import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.join(__dirname, "../../..");

function readJson(rel: string) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, rel), "utf8"));
}

describe("Vercel root Next detection", () => {
  it("keeps next in root package.json dependencies", () => {
    const pkg = readJson("package.json");
    expect(pkg.dependencies?.next, "root package.json must list next for Vercel").toMatch(
      /^\d+\.\d+\.\d+/
    );
    expect(fs.existsSync(path.join(repoRoot, "app/package.json"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "app/vercel.json"))).toBe(false);
  });

  it("declares Services in root vercel.json so Framework=Services can see them", () => {
    const vercel = readJson("vercel.json");
    expect(vercel.services, "missing services → Vercel: no services are declared").toBeTruthy();
    expect(Object.keys(vercel.services).length).toBeGreaterThanOrEqual(1);
  });

  it("points Services frontend at repo root, never rootDirectory", () => {
    const vercel = readJson("vercel.json");
    const canon = readJson("vercel.services.bff.json");
    expect(vercel).not.toHaveProperty("rootDirectory");
    expect(canon).not.toHaveProperty("rootDirectory");
    expect(vercel.services?.frontend?.framework).toBe("nextjs");
    expect(vercel.services?.frontend?.root).toBe(".");
    expect(vercel.services?.backend?.runtime).toBe("container");
    expect(vercel.services?.backend?.entrypoint).toBe("Dockerfile.vercel");
    expect(canon.services?.frontend?.root).toBe(".");
    expect(canon.services?.frontend?.framework).toBe("nextjs");
  });

  it("moves Prisma seed to prisma.config.ts and keeps DATABASE_URL in schema", () => {
    const pkg = readJson("package.json");
    expect(pkg.prisma, "package.json#prisma is deprecated on Prisma 6.19").toBeUndefined();
    const config = fs.readFileSync(path.join(repoRoot, "prisma.config.ts"), "utf8");
    expect(config).toContain("defineConfig");
    expect(config).toContain("prisma/config");
    expect(config).toContain("prisma/seed.ts");
    expect(config).toContain('[".env", "prisma/.env"]');
    expect(config).not.toMatch(/loadEnvFile\(\s*["']app\/\.env["']\s*\)/);
    expect(config).not.toMatch(/postgresql:\/\//);
    const schema = fs.readFileSync(path.join(repoRoot, "prisma/schema.prisma"), "utf8");
    expect(schema).toContain('url      = env("DATABASE_URL")');
  });

  it("records npm 11 allowScripts for Prisma, sharp, tesseract, unrs-resolver", () => {
    const pkg = readJson("package.json");
    const allow = pkg.allowScripts || {};
    for (const name of ["@prisma/client", "@prisma/engines", "prisma", "sharp", "tesseract.js", "unrs-resolver"]) {
      expect(allow[name], name).toBe(true);
    }
    expect(allow["sharp@0.34.5"]).toBe(true);
    expect(allow["sharp@0.35.3"]).toBe(true);
  });

  it("gates Next standalone off Vercel and keeps Services (no functions/static fake)", () => {
    const nextCfg = fs.readFileSync(path.join(repoRoot, "next.config.mjs"), "utf8");
    expect(nextCfg).toContain("VERCEL");
    expect(nextCfg).toContain("DOCKER_BUILD");
    expect(nextCfg).toContain("standalone");
    expect(fs.existsSync(path.join(repoRoot, "functions"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "static"))).toBe(false);
  });
});
