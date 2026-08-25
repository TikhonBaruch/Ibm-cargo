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
});
