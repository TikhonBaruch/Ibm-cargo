"use client";

import { SuperSeoPanel } from "@/components/admin/SuperSeoPanel";

export default function SuperSeoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-[#0f172a]">SEO</h1>
      <SuperSeoPanel />
    </div>
  );
}
