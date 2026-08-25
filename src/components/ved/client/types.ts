import { factoryUiEnabled, shippingUiEnabled } from "@/lib/ved/cabinet-features";
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
export type CreatePhase = "idle" | "uploading" | "creating" | "enriching";

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

export function getClientNav(
  base = "/cabinet",
  env?: Record<string, string | undefined>
) {
  const b = base.replace(/\/$/, "");
  const root = b || "/";
  const path = (suffix: string) => (b ? `${b}${suffix}` : suffix || "/");
  const items = [
    { href: root === "/" ? "/" : root, label: "Дашборд", icon: "home" as const },
    { href: path("/orders"), label: "Заявки / просчёты", icon: "list" as const },
    { href: path("/factory"), label: "Производитель", icon: "box" as const },
    { href: path("/brokers"), label: "Брокеры", icon: "users" as const },
    { href: path("/shipping"), label: "Перевозка", icon: "truck" as const },
    { href: path("/balance"), label: "Баланс", icon: "wallet" as const },
    { href: path("/support"), label: "Поддержка", icon: "message" as const },
    // Profile owns company settings; /settings redirects → /profile
    { href: path("/profile"), label: "Профиль", icon: "user" as const },
  ];
  return items.filter((item) => {
    if (item.href.endsWith("/shipping") && !shippingUiEnabled(env)) return false;
    if (item.href.endsWith("/factory") && !factoryUiEnabled(env)) return false;
    return true;
  });
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
  if (p.endsWith("/orders")) return "orders";
  if (p.endsWith("/factory")) return "factory";
  if (p.endsWith("/new")) return "new";
  if (p.endsWith("/brokers")) return "brokers";
  if (p.endsWith("/shipping")) return "shipping";
  if (p.endsWith("/balance")) return "balance";
  if (p.endsWith("/profile") || p.endsWith("/settings")) return "profile";
  if (p.endsWith("/support")) return "support";
  return "dashboard";
}

export function maxPositionsForTariffCode(code: string): number {
  if (code === "PRO") return 10;
  if (code === "STANDARD") return 3;
  return 1;
}
