import { describe, expect, it } from "vitest";
import { ensureNextAuthUrl, isForeignIbmCargoOrigin, resolveSiteUrl } from "../site-url";

describe("resolveSiteUrl", () => {
  it("prefers NEXTAUTH_URL when set", () => {
    expect(
      resolveSiteUrl({
        NEXTAUTH_URL: "https://preview.example/",
        NEXT_PUBLIC_SITE_URL: "https://other.example",
      } as NodeJS.ProcessEnv)
    ).toBe("https://preview.example");
  });

  it("skips empty strings and uses VERCEL_URL", () => {
    expect(
      resolveSiteUrl({
        NEXTAUTH_URL: "",
        NEXT_PUBLIC_SITE_URL: "  ",
        VERCEL_URL: "lbm-git-x.vercel.app",
      } as NodeJS.ProcessEnv)
    ).toBe("https://lbm-git-x.vercel.app");
  });

  it("prefers VERCEL_BRANCH_URL over VERCEL_URL when auth URLs are empty", () => {
    expect(
      resolveSiteUrl({
        NEXTAUTH_URL: "",
        VERCEL_BRANCH_URL: "ibm-cargo-git-x.vercel.app",
        VERCEL_URL: "ibm-cargo-abc.vercel.app",
      } as NodeJS.ProcessEnv)
    ).toBe("https://ibm-cargo-git-x.vercel.app");
  });

  it("skips ibm-cargo.vercel.app and uses the next candidate", () => {
    expect(
      resolveSiteUrl({
        NEXTAUTH_URL: "https://ibm-cargo.vercel.app",
        VERCEL_URL: "lbm-git-x.vercel.app",
      } as NodeJS.ProcessEnv)
    ).toBe("https://lbm-git-x.vercel.app");
  });

  it("uses VERCEL_PROJECT_PRODUCTION_URL when it is not the foreign host", () => {
    expect(
      resolveSiteUrl({
        VERCEL_PROJECT_PRODUCTION_URL: "example.vercel.app",
      } as NodeJS.ProcessEnv)
    ).toBe("https://example.vercel.app");
  });

  it("falls back to localhost, not ibm-cargo.vercel.app", () => {
    expect(resolveSiteUrl({} as NodeJS.ProcessEnv)).toBe("http://localhost:3000");
    expect(
      resolveSiteUrl({
        NEXTAUTH_URL: "https://ibm-cargo.vercel.app/",
        VERCEL_PROJECT_PRODUCTION_URL: "ibm-cargo.vercel.app",
      } as NodeJS.ProcessEnv)
    ).toBe("http://localhost:3000");
  });
});

describe("isForeignIbmCargoOrigin", () => {
  it("matches only the other project's hostname", () => {
    expect(isForeignIbmCargoOrigin("https://ibm-cargo.vercel.app")).toBe(true);
    expect(isForeignIbmCargoOrigin("ibm-cargo-git-x.vercel.app")).toBe(false);
  });
});

describe("ensureNextAuthUrl", () => {
  it("fills empty NEXTAUTH_URL so next-auth parseUrl does not see \"\"", () => {
    const env = {
      NEXTAUTH_URL: "",
      VERCEL_URL: "branch.vercel.app",
    } as NodeJS.ProcessEnv;
    expect(ensureNextAuthUrl(env)).toBe("https://branch.vercel.app");
    expect(env.NEXTAUTH_URL).toBe("https://branch.vercel.app");
  });

  it("replaces ibm-cargo.vercel.app NEXTAUTH_URL", () => {
    const env = {
      NEXTAUTH_URL: "https://ibm-cargo.vercel.app",
      VERCEL_URL: "branch.vercel.app",
    } as NodeJS.ProcessEnv;
    expect(ensureNextAuthUrl(env)).toBe("https://branch.vercel.app");
    expect(env.NEXTAUTH_URL).toBe("https://branch.vercel.app");
  });
});
