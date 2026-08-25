/**
 * Server-side UI gate for cabinet layouts (defense in depth vs middleware).
 * RBAC tables stay in access.ts — do not duplicate role sets here.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/require-role";
import {
  isPublicAuthedPath,
  resolvePathAccess,
} from "@/lib/ved/access";
import {
  isSuperAdminLoginPath,
  isSuperAdminSurfacePath,
  SUPER_ADMIN_BASE,
} from "@/lib/ved/super-admin";

export type UiPathGate = { type: "allow" } | { type: "redirect"; to: string };

/** Pure decision for unit tests — no Next redirect. */
export function resolveUiPathGate(
  role: string | undefined,
  pathname: string,
  method = "GET"
): UiPathGate {
  if (isPublicAuthedPath(pathname, method)) return { type: "allow" };

  if (!role) {
    if (isSuperAdminSurfacePath(pathname) && !isSuperAdminLoginPath(pathname)) {
      return { type: "redirect", to: `${SUPER_ADMIN_BASE}/login` };
    }
    return { type: "redirect", to: "/login" };
  }

  const decision = resolvePathAccess(role, pathname);
  if (decision.type === "allow") return { type: "allow" };
  if (decision.type === "redirect") return decision;

  if (isSuperAdminSurfacePath(pathname)) {
    return { type: "redirect", to: `${SUPER_ADMIN_BASE}/login` };
  }
  return { type: "redirect", to: "/login" };
}

/** Call from RSC layouts. Prefix path is enough (`/cabinet` covers `/cabinet/*`). */
export async function requirePathAccess(pathname: string): Promise<void> {
  const session = await getSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const gate = resolveUiPathGate(role, pathname);
  if (gate.type === "redirect") {
    redirect(gate.to);
  }
}
