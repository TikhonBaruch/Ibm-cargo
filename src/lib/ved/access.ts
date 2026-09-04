/**
 * Pure RBAC path rules for VED cabinets and protected /api/v1 mutations.
 * Used by middleware; covered by access.test.ts (branch triangle / D15).
 */

import {
  isSuperAdminLoginPath,
  isSuperAdminSurfacePath,
  SUPER_ADMIN_BASE,
} from "./super-admin";

export type AccessRole =
  | "USER"
  | "EDITOR"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "SPECIALIST"
  | "CLIENT"
  | "BROKER"
  | "MANUFACTURER";

export type AccessDecision =
  | { type: "allow" }
  | { type: "deny" }
  | { type: "redirect"; to: string };

const CABINET_ROLES = new Set(["CLIENT", "ADMIN", "SUPER_ADMIN"]);
const BROKER_ROLES = new Set(["BROKER", "ADMIN", "SUPER_ADMIN"]);
const MANUFACTURER_ROLES = new Set(["MANUFACTURER", "ADMIN", "SUPER_ADMIN"]);
const ADMIN_SURFACE_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "EDITOR", "SPECIALIST"]);

export function homePathForRole(role: string): string {
  // Live cabinets use LbmCabinetsShell. Lab `/client` stays as visual reference.
  if (role === "CLIENT") return "/cabinet";
  if (role === "BROKER") return "/broker";
  if (role === "MANUFACTURER") return "/manufacturer";
  if (role === "SPECIALIST") return "/admin/chat";
  if (role === "ADMIN" || role === "SUPER_ADMIN" || role === "EDITOR") return "/admin";
  return "/login";
}

/** Path-level RBAC after authentication. */
export function resolvePathAccess(role: string | undefined, pathname: string): AccessDecision {
  if (!role) return { type: "deny" };

  // UI lab (lbm-bro skin) — same roles as /cabinet
  if (pathname.startsWith("/client")) {
    if (CABINET_ROLES.has(role)) return { type: "allow" };
    if (role === "BROKER") return { type: "redirect", to: "/broker" };
    if (role === "MANUFACTURER") return { type: "redirect", to: "/manufacturer" };
    return { type: "redirect", to: "/login" };
  }

  if (pathname.startsWith("/cabinet")) {
    if (CABINET_ROLES.has(role)) return { type: "allow" };
    if (role === "BROKER") return { type: "redirect", to: "/broker" };
    if (role === "MANUFACTURER") return { type: "redirect", to: "/manufacturer" };
    return { type: "redirect", to: "/login" };
  }

  if (pathname.startsWith("/broker")) {
    if (BROKER_ROLES.has(role)) return { type: "allow" };
    if (role === "CLIENT") return { type: "redirect", to: homePathForRole("CLIENT") };
    if (role === "MANUFACTURER") return { type: "redirect", to: "/manufacturer" };
    return { type: "redirect", to: "/login" };
  }

  if (pathname.startsWith("/manufacturer")) {
    if (MANUFACTURER_ROLES.has(role)) return { type: "allow" };
    return { type: "redirect", to: homePathForRole(role) };
  }

  // Obscure SUPER_ADMIN CMS surface (not under /admin)
  if (isSuperAdminSurfacePath(pathname) && !isSuperAdminLoginPath(pathname)) {
    if (role === "SUPER_ADMIN") return { type: "allow" };
    if (role === "ADMIN" || role === "EDITOR") return { type: "redirect", to: "/admin" };
    if (role === "CLIENT") return { type: "redirect", to: homePathForRole("CLIENT") };
    if (role === "BROKER") return { type: "redirect", to: "/broker" };
    if (role === "MANUFACTURER") return { type: "redirect", to: "/manufacturer" };
    return { type: "redirect", to: `${SUPER_ADMIN_BASE}/login` };
  }

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (role === "CLIENT") return { type: "redirect", to: homePathForRole("CLIENT") };
    if (role === "BROKER") return { type: "redirect", to: "/broker" };
    if (role === "MANUFACTURER") return { type: "redirect", to: "/manufacturer" };
    if (ADMIN_SURFACE_ROLES.has(role)) return { type: "allow" };
    return { type: "redirect", to: "/login" };
  }

  return { type: "allow" };
}

/** Whether an unauthenticated request may pass the auth gate. */
export function isPublicAuthedPath(pathname: string, method: string): boolean {
  if (
    pathname.startsWith("/admin/login") ||
    pathname === "/login" ||
    isSuperAdminLoginPath(pathname)
  ) {
    return true;
  }
  if (pathname === "/api/v1/auth/register" && method.toUpperCase() === "POST") return true;
  if (pathname.startsWith("/api/v1/tariffs") && method.toUpperCase() === "GET") return true;
  return false;
}

/** Sensitive domain mutations that must never be callable without a session. */
export const PROTECTED_V1_MUTATIONS = [
  { method: "POST", path: "/api/v1/calculations" },
  { method: "POST", path: "/api/v1/calculations/attr-suggest" },
  { method: "POST", pathPrefix: "/api/v1/calculations/", suffix: "/pay" },
  { method: "POST", pathPrefix: "/api/v1/calculations/", suffix: "/feedback" },
  { method: "POST", pathPrefix: "/api/v1/calculations/", suffix: "/claim" },
  { method: "POST", pathPrefix: "/api/v1/calculations/", suffix: "/approve" },
  { method: "POST", pathPrefix: "/api/v1/calculations/", suffix: "/assign" },
  { method: "POST", pathPrefix: "/api/v1/calculations/", suffix: "/escalate" },
  { method: "POST", pathPrefix: "/api/v1/calculations/", suffix: "/reclassify" },
  { method: "PATCH", pathPrefix: "/api/v1/calculations/", suffix: "/items" },
  { method: "POST", path: "/api/v1/company/topup" },
  { method: "POST", pathPrefix: "/api/v1/company/", suffix: "/adjust" },
  { method: "POST", path: "/api/v1/imports/products/preview" },
  { method: "POST", path: "/api/v1/imports/products/describe" },
  { method: "POST", path: "/api/v1/uploads" },
  { method: "POST", path: "/api/v1/shipping" },
  { method: "POST", path: "/api/v1/chat" },
  { method: "PATCH", path: "/api/v1/brokers/me" },
  { method: "PATCH", path: "/api/v1/brokers" },
  { method: "PATCH", path: "/api/v1/company" },
  { method: "PATCH", pathPrefix: "/api/v1/company/", suffix: "" },
  { method: "POST", path: "/api/v1/manufacturer/skus" },
  { method: "PATCH", pathPrefix: "/api/v1/manufacturer/skus/", suffix: "" },
  { method: "PATCH", path: "/api/v1/manufacturer/company" },
  { method: "POST", path: "/api/v1/factory/requests" },
  { method: "POST", path: "/api/v1/factory/requests/bulk" },
  { method: "POST", pathPrefix: "/api/v1/factory/requests/", suffix: "/cancel" },
  { method: "POST", pathPrefix: "/api/v1/factory/requests/", suffix: "/link-calc" },
  { method: "POST", path: "/api/v1/manufacturers/proposals" },
  { method: "POST", pathPrefix: "/api/v1/admin/manufacturer-proposals/", suffix: "/approve" },
  { method: "POST", pathPrefix: "/api/v1/admin/manufacturer-proposals/", suffix: "/reject" },
  { method: "POST", path: "/api/v1/manufacturer/pools" },
  { method: "POST", pathPrefix: "/api/v1/manufacturer/pools/", suffix: "/confirm" },
  { method: "POST", pathPrefix: "/api/v1/manufacturer/pools/", suffix: "/close" },
  { method: "POST", pathPrefix: "/api/v1/manufacturer/order-requests/", suffix: "/accept" },
  { method: "POST", pathPrefix: "/api/v1/manufacturer/order-requests/", suffix: "/reject" },
  { method: "PATCH", path: "/api/v1/platform/settings" },
  { method: "PATCH", path: "/api/v1/tariffs/update" },
] as const;

export function matchesProtectedMutation(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  const normalized = pathname.replace(/\/+/g, "/");
  if (normalized.includes("..")) return false;

  return PROTECTED_V1_MUTATIONS.some((rule) => {
    if (rule.method !== m) return false;
    if ("path" in rule && rule.path) return normalized === rule.path;
    if ("pathPrefix" in rule && rule.pathPrefix && "suffix" in rule) {
      const suffix = rule.suffix;
      if (!normalized.startsWith(rule.pathPrefix) || !normalized.endsWith(suffix)) {
        return false;
      }
      // expect /api/v1/calculations/:id/pay — exactly one id segment
      // suffix "" → /api/v1/manufacturer/skus/:id
      const rest = suffix
        ? normalized.slice(rule.pathPrefix.length, normalized.length - suffix.length)
        : normalized.slice(rule.pathPrefix.length);
      return rest.length > 0 && !rest.includes("/");
    }
    return false;
  });
}
