"use client";

import type { ReactNode } from "react";
import { ClientShell } from "@/lbm-bro/components/client-shell";
import { ProtoBar } from "@/lbm-bro/components/proto-bar";
import { DemoProvider } from "@/lbm-bro/lib/store";

export function ClientLabProviders({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <ProtoBar />
      <ClientShell>{children}</ClientShell>
    </DemoProvider>
  );
}
