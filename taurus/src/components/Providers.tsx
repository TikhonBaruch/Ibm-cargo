"use client";

import { SessionProvider } from "next-auth/react";
import { VedToastProvider } from "@/components/ved/feedback/VedToast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <VedToastProvider>{children}</VedToastProvider>
    </SessionProvider>
  );
}
