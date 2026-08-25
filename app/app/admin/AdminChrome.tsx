"use client";

/**
 * VED platform admin layout — ADMIN (+ SUPER_ADMIN for ops).
 * Legacy CMS is on the obscure SUPER surface only (D6).
 */
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { ADMIN_CABINET_PATHS } from "@/lib/ved/admin-paths";
import { SUPER_ADMIN_CMS_SEGMENTS, SUPER_ADMIN_BASE } from "@/lib/ved/super-admin";

export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  // Old CMS URLs under /admin → obscure surface (server pages also redirect)
  useEffect(() => {
    if (!pathname) return;
    const seg = pathname.replace(/^\/admin\/?/, "").split("/")[0];
    if (seg && (SUPER_ADMIN_CMS_SEGMENTS as readonly string[]).includes(seg)) {
      router.replace(`${SUPER_ADMIN_BASE}/${seg}`);
    }
  }, [pathname, router]);

  useEffect(() => {
    if (status !== "authenticated" || !userRole) return;
    if (userRole === "CLIENT") router.replace("/cabinet");
    if (userRole === "BROKER") router.replace("/broker");
  }, [status, userRole, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa]">
        <div className="text-[#7a7f89]">Загрузка...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <>{children}</>;
  }

  // VED product admin uses AdminVedCabinet / VedShell chrome
  if (pathname && ADMIN_CABINET_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  // Non-cabinet /admin paths (redirects in progress): minimal shell
  return <>{children}</>;
}
