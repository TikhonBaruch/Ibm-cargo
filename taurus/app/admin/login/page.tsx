"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy admin login → unified /login */
export default function AdminLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] text-[#7a7f89]">
      Перенаправление на вход…
    </div>
  );
}
