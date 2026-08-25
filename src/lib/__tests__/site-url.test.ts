import { describe, expect, it } from "vitest";
import { ensureNextAuthUrl, resolveSiteUrl } from "../site-url";

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

  it("falls back to prod host", () => {
    expect(resolveSiteUrl({} as NodeJS.ProcessEnv)).toBe("https://ibm-cargo.vercel.app");
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
});
