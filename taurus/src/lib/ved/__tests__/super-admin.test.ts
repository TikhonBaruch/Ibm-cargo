import { describe, expect, it } from "vitest";
import {
  SUPER_ADMIN_BASE,
  SUPER_ADMIN_CMS_SEGMENTS,
  SUPER_ADMIN_LOGIN_EMAIL,
  VED_STAFF_VISIBLE_ROLES,
  isHiddenSuperRole,
  isSuperAdminLoginPath,
  isSuperAdminSurfacePath,
  isVedCreatableRole,
  vedUserListWhere,
} from "../super-admin";

describe("super-admin surface", () => {
  it("uses obscure base path", () => {
    expect(SUPER_ADMIN_BASE).toBe("/2178737");
    expect(SUPER_ADMIN_LOGIN_EMAIL).toBe("2178737@gmail.com");
  });

  it("detects surface and login paths", () => {
    expect(isSuperAdminSurfacePath("/2178737")).toBe(true);
    expect(isSuperAdminSurfacePath("/2178737/posts")).toBe(true);
    expect(isSuperAdminSurfacePath("/2178737/seo")).toBe(true);
    expect(isSuperAdminSurfacePath("/admin")).toBe(false);
    expect(isSuperAdminLoginPath("/2178737/login")).toBe(true);
    expect(isSuperAdminLoginPath("/2178737")).toBe(false);
  });

  it("hides SUPER from VED user list/create (S2)", () => {
    expect(isHiddenSuperRole("SUPER_ADMIN")).toBe(true);
    expect(isHiddenSuperRole("ADMIN")).toBe(false);
    expect(isVedCreatableRole("SUPER_ADMIN")).toBe(false);
    expect(isVedCreatableRole("MANUFACTURER")).toBe(true);
    expect(vedUserListWhere()).toEqual({ role: { not: "SUPER_ADMIN" } });
    expect(VED_STAFF_VISIBLE_ROLES).not.toContain("SUPER_ADMIN");
  });

  it("CMS redirect segments exclude VED cabinet collisions", () => {
    expect(SUPER_ADMIN_CMS_SEGMENTS).toContain("seo");
    expect(SUPER_ADMIN_CMS_SEGMENTS).toContain("infra");
    expect(SUPER_ADMIN_CMS_SEGMENTS).not.toContain("settings");
    expect(SUPER_ADMIN_CMS_SEGMENTS).not.toContain("bookings");
    expect(SUPER_ADMIN_CMS_SEGMENTS).not.toContain("users");
    expect(SUPER_ADMIN_CMS_SEGMENTS).not.toContain("audit");
  });
});
