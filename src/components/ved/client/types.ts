import type { InvoiceCurrency, LandedWithoutFreight } from "@/lib/ved/landed-cost";

export type CalcItem = {
  id: string;
  name: string;
  description?: string | null;
  mediaUrl?: string | null;
  hsCodeAi?: string | null;
  hsCodeFinal?: string | null;
  dutyRub?: number | null;
  vatRub?: number | null;
  qty?: number | null;
  unitPrice?: number | null;
  attrs?: {
    brand?: string;
    material?: string;
    composition?: string;
    purpose?: string;
    originCountry?: string;
    netWeightKg?: number;
    hsHint?: string;
    model?: string;
    manufacturerName?: string;
    extra?: Record<string, string>;
  } | null;
};

export type ClientFeedbackReaction = "HELPFUL" | "NEEDS_WORK";

export type Calc = {
  id: string;
  number: string;
  title: string;
  description?: string | null;
  country?: string | null;
  shipmentValue?: string | null;
  status: string;
  /** Set after tariff charge — Pay CTA must hide even if list status lags. */
  paidAt?: string | null;
  /** True when PDF HTML exists (detail GET omits heavy pdfHtml body). */
  hasPdf?: boolean;
  totalPaymentsRub?: number | null;
  hsCode?: string | null;
  hsCodeFinal?: string | null;
  confidence?: number | null;
  dutyRub?: number | null;
  vatRub?: number | null;
  feeRub?: number | null;
  extraFeeRub?: number | null;
  extraFeeNote?: string | null;
  brokerComment?: string | null;
  clientFeedbackReaction?: "HELPFUL" | "NEEDS_WORK" | null;
  clientFeedbackComment?: string | null;
  clientFeedbackAt?: string | null;
  preferredBrokerUserId?: string | null;
  preferredBrokerUser?: { id: string; name?: string | null } | null;
  tariff?: { name: string; code: string; priceRub: number } | null;
  items?: CalcItem[];
  /** Create response / poll: AI_DRAIN still running. */
  aiDrainPending?: boolean;
  aiDraft?: {
    documents?: string[];
    disclaimer?: string;
    engine?: string;
    confidence?: number;
    llmEnrich?: string;
    llmEnrichPending?: boolean;
    chainId?: number;
    /** Test-mode: which LLM soft-fails (client-safe codes). */
    llmSoftFails?: string[];
    landedWithoutFreight?: LandedWithoutFreight;
  } | null;
};

/** Create button / busy copy for NewCalc. */
export type CreatePhase = "idle" | "uploading" | "creating" | "enriching" | "paying";

export type Broker = {
  id: string;
  userId: string;
  specialization?: string | null;
  rating: number;
  user: { id: string; name?: string | null };
};

export type Quote = {
  id: string;
  mode: string;
  etaDays: number;
  priceRub: number;
  carrierLabel: string;
  selected?: boolean;
};

export type Me = {
  name?: string;
  company?: {
    name: string;
    balanceRub: number;
    inn?: string | null;
    legalAddress?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    clientSegment?: ClientSegment | null;
    ledger?: Array<{
      id: string;
      amountRub: number;
      description?: string | null;
      createdAt: string;
    }>;
  } | null;
};

export type ClientSegment = "SINGLE" | "RETAIL_SMALL" | "WHOLESALE";

export type FactoryOrderRequest = {
  id: string;
  qty: number;
  note?: string | null;
  status: string;
  rejectReason?: string | null;
  calculationId?: string | null;
  manufacturerSku: { id?: string; sku: string; name: string; moq?: number | null };
  pool?: { id: string; status: string; qtyTotal?: number | null; targetQty?: number | null } | null;
};

export function formItemFromCatalogSku(sku: CatalogSku, qty = 1, item?: FormItem): FormItem {
  const preview = sku.clientPreview;
  const base = item || { name: "", qty: 1, unitPrice: 0 };
  return {
    ...base,
    manufacturerSkuId: sku.id,
    qty,
    name: base.name.trim() || sku.name,
    attrs: {
      ...base.attrs,
      brand: base.attrs?.brand?.trim() || sku.brand || preview?.attrs?.brand || "",
      material: base.attrs?.material?.trim() || preview?.attrs?.material || "",
      composition:
        base.attrs?.composition?.trim() || preview?.attrs?.composition || "",
      manufacturerName:
        base.attrs?.manufacturerName?.trim() ||
        sku.company?.name ||
        preview?.attrs?.manufacturerName ||
        "",
      originCountry:
        base.attrs?.originCountry?.trim() || sku.originCountry || preview?.attrs?.originCountry || "",
      netWeightKg:
        base.attrs?.netWeightKg != null && String(base.attrs.netWeightKg).trim() !== ""
          ? base.attrs.netWeightKg
          : sku.netWeightKg != null
            ? String(sku.netWeightKg)
            : "",
      hsHint: base.attrs?.hsHint?.trim() || sku.hsHint || preview?.attrs?.hsHint || "",
    },
  };
}

export type ChatMsg = {
  id: string;
  body: string;
  attachmentUrl?: string | null;
  author?: { name?: string | null; role?: string | null } | null;
};

export type ShipRow = {
  id: string;
  origin: string;
  destination: string;
  mode: string;
  status: string;
  trackingCode?: string | null;
  selectedQuote?: Quote | null;
  eta?: string | null;
  calculationId?: string | null;
  trackingEvents?: Array<{ at: string; status: string; label: string }> | null;
};

export type FormItemAttrs = {
  brand?: string;
  material?: string;
  composition?: string;
  purpose?: string;
  originCountry?: string;
  netWeightKg?: string;
  hsHint?: string;
  manufacturerName?: string;
  extra?: Record<string, string>;
};

export type FormItem = {
  name: string;
  qty?: number;
  unitPrice?: number;
  mediaUrl?: string;
  attrs?: FormItemAttrs;
  manufacturerSkuId?: string;
};

/** Published factory SKU card (GET /api/v1/catalog/skus) — no INN/PII. */
export type CatalogSku = {
  id: string;
  sku: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  originCountry?: string | null;
  netWeightKg?: number | null;
  hsHint?: string | null;
  moq?: number | null;
  packMultiple?: number | null;
  openPool?: { qtyTotal: number; targetQty?: number | null } | null;
  company: { id: string; name: string };
  clientPreview?: {
    name: string;
    description?: string;
    attrs?: FormItemAttrs & { model?: string; composition?: string };
  };
};

export type CalcForm = {
  title: string;
  description: string;
  country: string;
  shipmentValue: string;
  shipmentCurrency: InvoiceCurrency;
  tariffCode: string;
  preferredBrokerUserId: string;
};

export type TariffOption = {
  id: string;
  code: string;
  name: string;
  priceRub: number;
  maxPositions: number;
  slaHours?: number;
  description?: string | null;
};

/** Label for tariff select; falls back to code-based defaults if API empty. */
export function formatTariffOption(t: TariffOption): string {
  const price = t.priceRub.toLocaleString("ru-RU");
  const maxPos = maxPositionsForTariffCode(t.code);
  if (t.code === "EXPRESS") return `${t.name} — ${price} ₽ (1 позиция, только AI)`;
  return `${t.name} — ${price} ₽ (до ${maxPos} поз.)`;
}

/** Designer IA: exactly 5 sidebar tiles. Shipping/factory stay as home tiles / deep-links. */
export function getClientNav(
  base = "/cabinet",
  _env?: Record<string, string | undefined>
) {
  const b = base.replace(/\/$/, "");
  const root = b || "/";
  const path = (suffix: string) => (b ? `${b}${suffix}` : suffix || "/");
  return [
    { href: root === "/" ? "/" : root, label: "Главная", icon: "home" as const },
    { href: path("/orders"), label: "Заявки", icon: "list" as const },
    { href: path("/tnved"), label: "Справочник ТН ВЭД", icon: "list" as const },
    { href: path("/support"), label: "Чат", icon: "message" as const },
    { href: path("/profile"), label: "Компания", icon: "user" as const },
  ];
}

export const PLACEHOLDER_THUMBS = [
  "/cabinets/assets/product-laptop.jpg",
  "/cabinets/assets/ob-2-docs.jpg",
  "/cabinets/assets/ob-3-cargo.jpg",
  "/cabinets/assets/ob-2-fleet.jpg",
  "/cabinets/assets/ob-1-warehouse.jpg",
];

export function calcThumb(c: Calc, index = 0): string {
  const fromItem = c.items?.find((it) => it.mediaUrl)?.mediaUrl;
  if (fromItem) return fromItem;
  return PLACEHOLDER_THUMBS[index % PLACEHOLDER_THUMBS.length];
}

export function clientPane(pathname: string): string {
  const p = (pathname || "/").replace(/\/$/, "") || "/";
  if (/\/orders\/[^/]+$/.test(p)) return "order";
  if (p.endsWith("/orders")) return "orders";
  if (p.endsWith("/factory")) return "factory";
  if (p.endsWith("/new")) return "new";
  if (p.endsWith("/brokers")) return "brokers";
  if (p.endsWith("/shipping")) return "shipping";
  if (p.endsWith("/balance")) return "balance";
  if (p.endsWith("/profile") || p.endsWith("/settings")) return "profile";
  if (p.endsWith("/support")) return "support";
  if (p.endsWith("/tnved")) return "tnved";
  if (p.endsWith("/faq")) return "faq";
  if (p.endsWith("/guide")) return "guide";
  if (p.endsWith("/clearance")) return "clearance";
  return "dashboard";
}

export function orderIdFromPath(pathname: string): string | null {
  const m = (pathname || "").replace(/\/$/, "").match(/\/orders\/([^/?#]+)$/);
  return m?.[1] || null;
}

export function clientOrderHref(ordersHref: string, id: string): string {
  const base = ordersHref.replace(/\/$/, "");
  return `${base}/${id}`;
}

export function maxPositionsForTariffCode(code: string): number {
  if (code === "PRO") return 10;
  if (code === "STANDARD") return 3;
  return 1;
}

/** Mobile tabbar destinations (M0d/M2a) — 4 tabs + center New CTA. */
export type ClientMobileTab = {
  key: "home" | "orders" | "chat" | "company";
  href: string;
  label: string;
  icon: "home" | "list" | "message" | "user";
};

export function buildClientMobileTabs(
  nav: Array<{ href: string; label: string }>,
  opts?: { newHref?: string }
): { tabs: ClientMobileTab[]; newHref: string } {
  const find = (pred: (label: string) => boolean) => nav.find((n) => pred(n.label));
  const home = find((l) => l === "Главная" || l === "Дашборд");
  const orders = find((l) => l.startsWith("Заявки"));
  const chat = find((l) => l === "Чат" || l === "Поддержка");
  const company = find((l) => l === "Компания" || l === "Профиль");
  const root = home?.href || nav[0]?.href || "/cabinet";
  const base = root.replace(/\/$/, "") || "/cabinet";
  const path = (suffix: string) => `${base}${suffix}`;
  const tabs: ClientMobileTab[] = [
    { key: "home", href: root, label: "Главная", icon: "home" },
    { key: "orders", href: orders?.href || path("/orders"), label: "Заявки", icon: "list" },
    { key: "chat", href: chat?.href || path("/support"), label: "Чат", icon: "message" },
    { key: "company", href: company?.href || path("/profile"), label: "Компания", icon: "user" },
  ];
  return { tabs, newHref: opts?.newHref || path("/new") };
}

export function clientMobileTabActive(
  pathname: string,
  tab: ClientMobileTab,
  highlightHref: string
): boolean {
  if (tab.key === "home") {
    return highlightHref === tab.href || pathname === tab.href || pathname.replace(/\/$/, "") === tab.href.replace(/\/$/, "");
  }
  if (tab.key === "orders") {
    return (
      highlightHref === tab.href ||
      pathname === tab.href ||
      pathname.startsWith(`${tab.href}/`) ||
      /\/new$/.test(pathname.replace(/\/$/, ""))
    );
  }
  return highlightHref === tab.href || pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}
