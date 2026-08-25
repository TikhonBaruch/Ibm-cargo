"use client";

import { SuperSiteSettingsPanel } from "@/components/admin/SuperSiteSettingsPanel";

export default function SuperSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-[#0f172a]">Настройки сайта</h1>
      <SuperSiteSettingsPanel />
    </div>
  );
}
