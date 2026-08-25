/**
 * Obscure SUPER_ADMIN surface (legacy CMS + audit). Not linked from product nav (D6).
 * Path is security-through-obscurity; RBAC still requires SUPER_ADMIN.
 */

function fromCharCodes(codes: readonly number[]): string {
  return String.fromCharCode(...codes);
}

export const SUPER_ADMIN_BASE = fromCharCodes([47, 50, 49, 55, 56, 55, 51, 55]);

export const SUPER_ADMIN_LOGIN_EMAIL = fromCharCodes([
  50, 49, 55, 56, 55, 51, 55, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109,
]);

/** Roles VED `/admin/users` may list or create. Never SUPER_ADMIN (D28 / S2). */
export const VED_STAFF_VISIBLE_ROLES = [
  "ADMIN",
  "EDITOR",
  "CLIENT",
  "BROKER",
  "SPECIALIST",
  "MANUFACTURER",
] as const;

export function isHiddenSuperRole(role: string | undefined | null): boolean {
  return role === "SUPER_ADMIN";
}

export function isVedCreatableRole(role: string): boolean {
  return (VED_STAFF_VISIBLE_ROLES as readonly string[]).includes(role);
}

export function vedUserListWhere(): { role: { not: "SUPER_ADMIN" } } {
  return { role: { not: "SUPER_ADMIN" } };
}

export function isSuperAdminSurfacePath(pathname: string): boolean {
  return (
    pathname === SUPER_ADMIN_BASE ||
    pathname.startsWith(`${SUPER_ADMIN_BASE}/`)
  );
}

export function isSuperAdminLoginPath(pathname: string): boolean {
  return pathname === `${SUPER_ADMIN_BASE}/login`;
}

/** CMS segments under SUPER_ADMIN_BASE (and old /admin/* redirects).
 *  Do not include VED cabinet segments (bookings, users, settings, audit, …). */
export const SUPER_ADMIN_CMS_SEGMENTS = [
  "chat",
  "posts",
  "promos",
  "reviews",
  "gallery",
  "specialists",
  "telegram",
  "seo",
  "infra",
] as const;
