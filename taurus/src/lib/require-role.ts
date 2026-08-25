import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

export type AppRole =
  | "USER"
  | "EDITOR"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "SPECIALIST"
  | "CLIENT"
  | "BROKER"
  | "MANUFACTURER";

export async function getSession() {
  return getServerSession(authOptions);
}

/** Returns session if role is allowed; otherwise a NextResponse error. */
export async function requireRole(allowed: AppRole[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const role = (session.user as { role?: string }).role as AppRole | undefined;
  if (!role || !allowed.includes(role)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null as null };
}

export const PLATFORM_ROLES: AppRole[] = ["ADMIN", "SUPER_ADMIN", "EDITOR"];
export const ADMIN_ROLES: AppRole[] = ["ADMIN", "SUPER_ADMIN"];
export const SUPER_ONLY: AppRole[] = ["SUPER_ADMIN"];
export const CLIENT_ROLES: AppRole[] = ["CLIENT", "ADMIN", "SUPER_ADMIN"];
export const BROKER_ROLES: AppRole[] = ["BROKER", "ADMIN", "SUPER_ADMIN"];
export const MANUFACTURER_ROLES: AppRole[] = ["MANUFACTURER", "ADMIN", "SUPER_ADMIN"];
export const DOMAIN_ROLES: AppRole[] = ["CLIENT", "BROKER", "MANUFACTURER", "ADMIN", "SUPER_ADMIN"];
