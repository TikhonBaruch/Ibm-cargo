/**
 * VED platform admin paths — own chrome via AdminVedCabinet / VedShell.
 * Used by app/admin/AdminChrome.tsx to skip the legacy CMS sidebar.
 */
export const ADMIN_CABINET_PATHS = new Set([
  "/admin",
  "/admin/bookings",
  "/admin/clients",
  "/admin/users",
  "/admin/brokers",
  "/admin/tariffs",
  "/admin/finance",
  "/admin/support",
  "/admin/integrations",
  "/admin/orch",
  "/admin/tnved",
  "/admin/ai-quality",
  "/admin/audit",
  "/admin/settings",
]);
