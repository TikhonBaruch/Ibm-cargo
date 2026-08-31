import {
  designerManufacturerChromeEnabled,
  factoryUiEnabled,
} from "@/lib/ved/cabinet-features";

export type AdminCalc = {
  id: string;
  number: string;
  title: string;
  description?: string | null;
  country?: string | null;
  shipmentValue?: string | null;
  status: string;
  confidence?: number | null;
  brokerComment?: string | null;
  extraFeeRub?: number | null;
  extraFeeNote?: string | null;
  dutyRub?: number | null;
  vatRub?: number | null;
  feeRub?: number | null;
  aiDraft?: unknown;
  clientUser?: { name?: string | null };
  brokerUser?: { id: string; name?: string | null } | null;
  company?: { id?: string; name: string } | null;
  tariff?: { name: string } | null;
  pdfHtml?: string | null;
  hasPdf?: boolean;
  items?: Array<{
    id: string;
    name: string;
    description?: string | null;
    qty?: number | null;
    hsCodeAi?: string | null;
    hsCodeFinal?: string | null;
    attrs?: {
      brand?: string;
      material?: string;
      originCountry?: string;
      netWeightKg?: number;
      hsHint?: string;
    } | null;
  }>;
};

export type AdminClientRow = {
  id: string;
  name: string;
  balanceRub: number;
  inn?: string | null;
  kind?: string | null;
  clientSegment?: string | null;
  _count?: { calculations: number; manufacturerSkus?: number };
};

export type AdminBrokerRow = {
  id: string;
  moderationStatus: string;
  acceptingJobs?: boolean;
  specialization?: string | null;
  languages?: string | null;
  about?: string | null;
  rating: number;
  user: { id: string; name?: string | null; email?: string | null; phone?: string | null };
};

export type AdminTariffRow = {
  id: string;
  code: string;
  name: string;
  priceRub: number;
  brokerSharePct: number;
  slaHours: number;
};

export type AdminPayoutRow = {
  id: string;
  periodLabel: string;
  amountRub: number;
  status: string;
  brokerProfile?: { user?: { name?: string | null } };
};

export type PlatformSettings = {
  confidenceThreshold: number;
  defaultSlaHours: number;
  preferredClaimHours: number;
  usdRate: number;
  cnyRate: number;
  eurRate: number;
  fxBufferPct: number;
  marketplaceEnabled: boolean;
  autoAssignBrokers: boolean;
  maintenanceMode: boolean;
  paymentsEnabled: boolean;
  llmEnrichEnabled: boolean;
  notifyEnabled: boolean;
  mockTopupAllowed: boolean;
};

export type IntegrationBlock = {
  host: string | null;
  configured: boolean;
  health: { ok: boolean | null; configured: boolean; latencyMs?: number; error?: string } | null;
  recent: Array<{
    id: string;
    operation: string;
    status: string;
    durationMs: number | null;
    error: string | null;
    createdAt: string;
  }>;
};

export type AdminIntegrations = {
  toggles: PlatformSettings;
  payments: IntegrationBlock;
  llm: IntegrationBlock;
  notify?: IntegrationBlock;
};

export type AdminCompanyDetail = {
  id: string;
  name: string;
  inn?: string | null;
  kpp?: string | null;
  legalAddress?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  balanceRub: number;
  kind?: string | null;
  clientSegment?: string | null;
  users: Array<{ id: string; name: string | null; email: string | null; role: string }>;
  ledgerEntries: Array<{
    id: string;
    kind: string;
    amountRub: number;
    balanceAfter: number;
    description: string | null;
    createdAt: string;
  }>;
  calculations: Array<{
    id: string;
    number: string;
    title: string;
    status: string;
    confidence: number | null;
  }>;
  manufacturerStats?: {
    skuTotal: number;
    skuPublished: number;
    skuDraft: number;
    requestsSubmitted: number;
    poolsOpen: number;
  } | null;
  _count?: { calculations: number };
};

export type AdminOrchCall = {
  id: string;
  service: string;
  operation: string;
  status: string;
  durationMs?: number | null;
  error?: string | null;
  calculationId?: string | null;
  requestMeta?: unknown;
  createdAt: string;
};

export type AdminOrchState = {
  health: {
    ok: boolean;
    outbox: { pending: number; sending: number; failed: number; dead: number };
    calls: { total: number; byStatus: Record<string, number> };
    deps: Array<{ service: string; configured: boolean; ok: boolean | null }>;
  };
  jobs: Array<{
    id: string;
    kind: string;
    status: string;
    attempts: number;
    lastError?: string | null;
    createdAt: string;
    calculationId?: string | null;
  }>;
  outbox: Array<{
    id: string;
    template: string;
    to: string;
    status: string;
    attempts: number;
    lastError?: string | null;
    createdAt: string;
  }>;
  calls?: AdminOrchCall[];
};

export type AdminAuditRow = {
  id: string;
  action: string;
  entity: string;
  details?: string | null;
  userName?: string | null;
  createdAt: string;
};

export type AdminStaffUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: string;
};

export type PayoutStatusFilter = "ALL" | "ACCRUED" | "DOCS_REQUESTED" | "PAID";

export function adminPath(navBase: string, suffix: string) {
  const b = navBase.replace(/\/$/, "");
  if (!suffix || suffix === "/") return b || "/";
  return b ? `${b}${suffix}` : suffix;
}

export function getAdminNav(
  navBase: string,
  env?: Record<string, string | undefined>
) {
  const item = (
    group: string,
    suffix: string,
    label: string,
    icon: "home" | "list" | "users" | "shield" | "message" | "chart" | "tag" | "sparkles" | "clipboard" | "settings" | "box"
  ) => ({
    href: adminPath(navBase, suffix),
    label,
    icon,
    group,
  });
  return [
    item("Операции", "/", "Дашборд", "home"),
    item("Операции", "/bookings", "Заявки", "list"),
    item("Операции", "/clients", "Клиенты", "users"),
    item("Операции", "/manufacturers", "Производители", "box"),
    item("Операции", "/brokers", "Брокеры", "shield"),
    item("Операции", "/support", "Поддержка", "message"),
    item("Операции", "/finance", "Финансы", "chart"),
    item("Каталог", "/tariffs", "Тарифы", "tag"),
    item("Каталог", "/tnved", "ТН ВЭД", "tag"),
    item("Каталог", "/ai-quality", "AI-качество", "sparkles"),
    item("Платформа", "/users", "Пользователи", "users"),
    item("Платформа", "/integrations", "Интеграции", "sparkles"),
    item("Платформа", "/orch", "Оркестрация", "clipboard"),
    item("Платформа", "/audit", "Журнал", "clipboard"),
    item("Платформа", "/settings", "Настройки", "settings"),
  ].filter((item) => {
    if (
      item.href.endsWith("/manufacturers") &&
      !(factoryUiEnabled(env) && designerManufacturerChromeEnabled(env))
    ) {
      return false;
    }
    return true;
  });
}

export function adminPageMeta(pathname: string, p: (s: string) => string) {
  if (pathname === p("/")) return { title: "Дашборд платформы", lead: "Операции, AI, брокеры — live-сводка" };
  if (pathname === p("/bookings")) return { title: "Заявки", lead: "Статусы по всей платформе" };
  if (pathname === p("/clients")) return { title: "Клиенты", lead: "Компании, баланс, корректировки" };
  if (pathname === p("/manufacturers"))
    return {
      title: "Производители",
      lead: "Утверждение предложений клиента/брокера · постоянный каталог",
    };
  if (pathname === p("/users")) return { title: "Пользователи", lead: "Staff и клиенты (без скрытых ролей)" };
  if (pathname === p("/brokers")) return { title: "Брокеры", lead: "Модерация, рейтинг, приём заявок" };
  if (pathname === p("/tariffs")) return { title: "Тарифы", lead: "Цены, доля брокера, SLA" };
  if (pathname === p("/finance")) return { title: "Финансы", lead: "Выплаты брокерам · CSV" };
  if (pathname === p("/support")) return { title: "Поддержка", lead: "Ответы на обращения клиентов" };
  if (pathname === p("/integrations")) return { title: "Интеграции", lead: "Платежка, LLM и notify" };
  if (pathname === p("/orch")) return { title: "Оркестрация", lead: "Jobs / Outbox / ServiceCall (D26)" };
  if (pathname === p("/tnved"))
    return { title: "ТН ВЭД", lead: "Добавить код формой, CSV или проверить справочник" };
  if (pathname === p("/ai-quality")) return { title: "AI-качество", lead: "Порог confidence и автоназначение" };
  if (pathname === p("/audit")) return { title: "Журнал", lead: "Действия администраторов" };
  if (pathname === p("/settings")) return { title: "Настройки", lead: "Платформенные флаги и выключатели" };
  return { title: "Админ", lead: "" };
}
