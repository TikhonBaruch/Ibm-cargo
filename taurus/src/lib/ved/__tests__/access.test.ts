import { describe, it, expect } from "vitest";
import {
  resolvePathAccess,
  isPublicAuthedPath,
  matchesProtectedMutation,
  PROTECTED_V1_MUTATIONS,
} from "../access";

describe("VED access — resolvePathAccess", () => {
  it("allows CLIENT on /cabinet", () => {
    expect(resolvePathAccess("CLIENT", "/cabinet/orders")).toEqual({ type: "allow" });
  });

  it("redirects BROKER from /cabinet to /broker", () => {
    expect(resolvePathAccess("BROKER", "/cabinet")).toEqual({ type: "redirect", to: "/broker" });
  });

  it("allows BROKER on /broker/queue", () => {
    expect(resolvePathAccess("BROKER", "/broker/queue")).toEqual({ type: "allow" });
  });

  it("redirects CLIENT from /broker to /cabinet", () => {
    expect(resolvePathAccess("CLIENT", "/broker")).toEqual({ type: "redirect", to: "/cabinet" });
  });

  it("keeps CLIENT/BROKER out of /admin", () => {
    expect(resolvePathAccess("CLIENT", "/admin")).toEqual({ type: "redirect", to: "/cabinet" });
    expect(resolvePathAccess("BROKER", "/admin/bookings")).toEqual({
      type: "redirect",
      to: "/broker",
    });
  });

  it("allows ADMIN on both cabinets and admin", () => {
    expect(resolvePathAccess("ADMIN", "/cabinet")).toEqual({ type: "allow" });
    expect(resolvePathAccess("ADMIN", "/broker")).toEqual({ type: "allow" });
    expect(resolvePathAccess("ADMIN", "/admin")).toEqual({ type: "allow" });
  });

  it("allows SUPER_ADMIN on /2178737 and redirects ADMIN away", () => {
    expect(resolvePathAccess("SUPER_ADMIN", "/2178737")).toEqual({ type: "allow" });
    expect(resolvePathAccess("SUPER_ADMIN", "/2178737/posts")).toEqual({ type: "allow" });
    expect(resolvePathAccess("ADMIN", "/2178737/posts")).toEqual({
      type: "redirect",
      to: "/admin",
    });
    expect(resolvePathAccess("CLIENT", "/2178737")).toEqual({
      type: "redirect",
      to: "/cabinet",
    });
  });

  it("redirects MANUFACTURER away from client/broker/admin cabinets", () => {
    expect(resolvePathAccess("MANUFACTURER", "/cabinet")).toEqual({
      type: "redirect",
      to: "/manufacturer",
    });
    expect(resolvePathAccess("MANUFACTURER", "/broker")).toEqual({
      type: "redirect",
      to: "/manufacturer",
    });
    expect(resolvePathAccess("MANUFACTURER", "/admin")).toEqual({
      type: "redirect",
      to: "/manufacturer",
    });
    expect(resolvePathAccess("MANUFACTURER", "/manufacturer/catalog")).toEqual({ type: "allow" });
    expect(resolvePathAccess("CLIENT", "/manufacturer")).toEqual({
      type: "redirect",
      to: "/cabinet",
    });
  });

  it("denies missing role", () => {
    expect(resolvePathAccess(undefined, "/cabinet")).toEqual({ type: "deny" });
  });
});

describe("VED access — public gate", () => {
  it("login pages are public", () => {
    expect(isPublicAuthedPath("/login", "GET")).toBe(true);
    expect(isPublicAuthedPath("/admin/login", "GET")).toBe(true);
    expect(isPublicAuthedPath("/2178737/login", "GET")).toBe(true);
  });

  it("tariffs GET is public; POST is not", () => {
    expect(isPublicAuthedPath("/api/v1/tariffs", "GET")).toBe(true);
    expect(isPublicAuthedPath("/api/v1/tariffs", "POST")).toBe(false);
  });

  it("register POST is public", () => {
    expect(isPublicAuthedPath("/api/v1/auth/register", "POST")).toBe(true);
    expect(isPublicAuthedPath("/api/v1/auth/register", "GET")).toBe(false);
  });

  it("domain mutations are not public", () => {
    expect(isPublicAuthedPath("/api/v1/calculations", "POST")).toBe(false);
    expect(isPublicAuthedPath("/api/v1/company/topup", "POST")).toBe(false);
  });
});

describe("VED access — protected mutations inventory", () => {
  it("has a non-empty mutation allowlist for security audits", () => {
    expect(PROTECTED_V1_MUTATIONS.length).toBeGreaterThanOrEqual(8);
  });

  it("matches pay / claim / approve / manufacturer sku paths", () => {
    expect(matchesProtectedMutation("POST", "/api/v1/calculations/abc/pay")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/calculations/attr-suggest")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/calculations/abc/claim")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/calculations/abc/approve")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/manufacturer/skus")).toBe(true);
    expect(matchesProtectedMutation("PATCH", "/api/v1/manufacturer/skus/sku1")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/factory/requests")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/factory/requests/r1/cancel")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/factory/requests/r1/link-calc")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/manufacturers/proposals")).toBe(true);
    expect(
      matchesProtectedMutation("POST", "/api/v1/admin/manufacturer-proposals/p1/approve")
    ).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/manufacturer/pools/p1/confirm")).toBe(true);
    expect(matchesProtectedMutation("GET", "/api/v1/manufacturer/skus")).toBe(false);
    expect(matchesProtectedMutation("PATCH", "/api/v1/company/co_1")).toBe(true);
    expect(matchesProtectedMutation("PATCH", "/api/v1/brokers")).toBe(true);
  });

  it("does not mark unrelated GETs as protected mutations", () => {
    expect(matchesProtectedMutation("GET", "/api/v1/calculations")).toBe(false);
    expect(matchesProtectedMutation("GET", "/api/v1/tariffs")).toBe(false);
  });
});
