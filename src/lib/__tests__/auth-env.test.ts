import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import {
  bootAuthEnv,
  ensureAuthSecret,
  ensureNextAuthUrlForRuntime,
  previewOrigin,
} from "../auth-env";
import { asEnv } from "../test-env";

describe("previewOrigin", () => {
  it("prefers VERCEL_BRANCH_URL over VERCEL_URL", () => {
    expect(
      previewOrigin(asEnv({
        VERCEL_BRANCH_URL: "ibm-cargo-git-x.vercel.app",
        VERCEL_URL: "ibm-cargo-abc.vercel.app",
      }))
    ).toBe("https://ibm-cargo-git-x.vercel.app");
  });
});

describe("ensureNextAuthUrlForRuntime", () => {
  it("overrides production NEXTAUTH_URL on Vercel preview", () => {
    const env = asEnv({
      VERCEL_ENV: "preview",
      VERCEL_BRANCH_URL: "ibm-cargo-git-x.vercel.app",
      VERCEL_URL: "ibm-cargo-abc.vercel.app",
      NEXTAUTH_URL: "https://unrelated.example",
    });
    expect(ensureNextAuthUrlForRuntime(env)).toBe("https://ibm-cargo-git-x.vercel.app");
    expect(env.NEXTAUTH_URL).toBe("https://ibm-cargo-git-x.vercel.app");
  });

  it("leaves a real production NEXTAUTH_URL alone", () => {
    const env = asEnv({
      VERCEL_ENV: "production",
      NEXTAUTH_URL: "https://lbm.example",
    });
    expect(ensureNextAuthUrlForRuntime(env)).toBe("https://lbm.example");
  });

  it("does not keep ibm-cargo.vercel.app as production NEXTAUTH_URL", () => {
    const env = asEnv({
      VERCEL_ENV: "production",
      NEXTAUTH_URL: "https://ibm-cargo.vercel.app",
    });
    expect(ensureNextAuthUrlForRuntime(env)).toBe("http://localhost:3000");
  });
});

describe("ensureAuthSecret", () => {
  it("aliases AUTH_SECRET onto NEXTAUTH_SECRET", () => {
    const env = asEnv({ AUTH_SECRET: "from-auth-js" });
    expect(ensureAuthSecret(env)).toBe("from-auth-js");
    expect(env.NEXTAUTH_SECRET).toBe("from-auth-js");
  });

  it("prefers NEXTAUTH_SECRET over AUTH_SECRET", () => {
    const env = asEnv({ NEXTAUTH_SECRET: "a", AUTH_SECRET: "b" });
    expect(ensureAuthSecret(env)).toBe("a");
  });

  it("derives a stable preview secret when both are empty", () => {
    const env = asEnv({
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_SHA: "abc",
      VERCEL_URL: "ibm-cargo-abc.vercel.app",
    });
    const expected = createHash("sha256")
      .update("ibm-cargo-preview:abc:ibm-cargo-abc.vercel.app")
      .digest("hex");
    expect(ensureAuthSecret(env)).toBe(expected);
    expect(env.NEXTAUTH_SECRET).toBe(expected);
  });

  it("does not invent a production secret", () => {
    const env = asEnv({ VERCEL_ENV: "production", NODE_ENV: "production" });
    expect(ensureAuthSecret(env)).toBe("");
    expect(env.NEXTAUTH_SECRET).toBeUndefined();
  });
});

describe("bootAuthEnv", () => {
  it("sets both url and secret on preview", () => {
    const env = asEnv({
      VERCEL_ENV: "preview",
      VERCEL_URL: "ibm-cargo-abc.vercel.app",
      AUTH_SECRET: "s",
    });
    expect(bootAuthEnv(env)).toEqual({
      url: "https://ibm-cargo-abc.vercel.app",
      secret: "s",
    });
  });
});
