import type { ProductAttrs } from "@/lib/ved/product-description";

export type CalcItem = {
  id: string;
  name: string;
  description?: string | null;
  hsCodeAi?: string | null;
  hsCodeFinal?: string | null;
  dutyRub?: number | null;
  vatRub?: number | null;
  qty?: number | null;
  unitPrice?: number | null;
  mediaUrl?: string | null;
  manufacturerSkuId?: string | null;
  attrs?: ProductAttrs | null;
};

export type Calc = {
  id: string;
  number: string;
  title: string;
  description?: string | null;
  country?: string | null;
  shipmentValue?: string | null;
  status: string;
  hsCode?: string | null;
  hsCodeFinal?: string | null;
  confidence?: number | null;
  dutyRub?: number | null;
  vatRub?: number | null;
  feeRub?: number | null;
  extraFeeRub?: number | null;
  extraFeeNote?: string | null;
  totalPaymentsRub?: number | null;
  brokerComment?: string | null;
  clientFeedbackReaction?: "HELPFUL" | "NEEDS_WORK" | null;
  clientFeedbackComment?: string | null;
  clientFeedbackAt?: string | null;
  preferredBrokerUserId?: string | null;
  queuedAt?: string | null;
  claimedAt?: string | null;
  doneAt?: string | null;
  slaDeadline?: string | null;
  clientUser?: { name?: string | null };
  tariff?: { name: string; priceRub: number; brokerSharePct?: number } | null;
  items?: CalcItem[];
  similarPrecedents?: SimilarPrecedent[];
  aiDraft?: unknown;
};

export type SimilarPrecedent = {
  id: string;
  hsCode: string;
  hsCodeDigits: string;
  quality: string;
  score: number;
  canonicalText: string;
};

export type MapRow = {
  id: string;
  name: string;
  description: string;
  hsCodeAi: string;
  hsCodeFinal: string;
  dutyRub: number;
  vatRub: number;
  unitPrice: number;
  mediaUrl?: string | null;
  manufacturerSkuId?: string | null;
  attrs?: CalcItem["attrs"];
};

export type ChatMsg = {
  id: string;
  body: string;
  attachmentUrl?: string | null;
  author?: { name?: string | null; role?: string | null } | null;
  createdAt?: string;
};

export type PayoutRow = {
  id: string;
  periodLabel: string;
  amountRub: number;
  jobsCount: number;
  status: string;
};

export type BrokerProfileForm = {
  specialization: string;
  languages: string;
  about: string;
  acceptingJobs: boolean;
  rating?: number;
  closedPerWeek?: number;
};

/** F21 sidebar footer: rating + closed/week from BrokerProfile. */
export function formatBrokerSideFoot(opts: {
  preferredClaimHours: number;
  rating?: number | null;
  closedPerWeek?: number | null;
}): { slaLine: string; ratingLine: string } {
  const hours = opts.preferredClaimHours > 0 ? opts.preferredClaimHours : 4;
  const rating =
    opts.rating != null && Number.isFinite(opts.rating) ? opts.rating : 5;
  const closed =
    opts.closedPerWeek != null && Number.isFinite(opts.closedPerWeek)
      ? Math.max(0, Math.round(opts.closedPerWeek))
      : 0;
  return {
    slaLine: `SLA: ≤ ${hours} ч`,
    ratingLine: `Рейтинг ★ ${rating.toFixed(1)} · ${closed} закрыто / нед.`,
  };
}

export function getBrokerNav(base = "/broker") {
  const b = base.replace(/\/$/, "");
  const root = b || "/";
  const path = (suffix: string) => (b ? `${b}${suffix}` : suffix || "/");
  return [
    { href: root === "/" ? "/" : root, label: "Дашборд", icon: "home" as const },
    { href: path("/queue"), label: "Очередь", icon: "list" as const },
    { href: path("/work"), label: "В работе", icon: "briefcase" as const },
    { href: path("/chat"), label: "Чат", icon: "message" as const },
    { href: path("/sla"), label: "SLA / статистика", icon: "chart" as const },
    { href: path("/payouts"), label: "Выплаты", icon: "wallet" as const },
    { href: path("/profile"), label: "Профиль", icon: "user" as const },
  ];
}

/** Normalize /broker/queue, /queue, /broker-app/queue → pane id. */
export function brokerPane(pathname: string): string {
  const p = (pathname || "/").replace(/\/$/, "") || "/";
  if (p.endsWith("/queue")) return "queue";
  if (p.endsWith("/work")) return "work";
  if (p.endsWith("/chat")) return "chat";
  if (p.endsWith("/sla")) return "sla";
  if (p.endsWith("/payouts")) return "payouts";
  if (p.endsWith("/profile")) return "profile";
  return "dashboard";
}

export const brokerNav = getBrokerNav("/broker");

export function hydrateMapRows(calc: Calc): MapRow[] {
  const items = calc.items || [];
  if (items.length === 0) {
    return [];
  }
  return items.map((it) => ({
    id: it.id,
    name: it.name,
    description: it.description || "",
    hsCodeAi: it.hsCodeAi || calc.hsCode || "",
    hsCodeFinal: it.hsCodeFinal || it.hsCodeAi || calc.hsCode || "",
    dutyRub: it.dutyRub ?? 0,
    vatRub: it.vatRub ?? 0,
    unitPrice: it.unitPrice ?? 0,
    mediaUrl: it.mediaUrl ?? null,
    manufacturerSkuId: it.manufacturerSkuId ?? null,
    attrs: it.attrs ?? null,
  }));
}

export function formatSlaCountdown(deadline?: string | null, now = Date.now()): string {
  if (!deadline) return "—";
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return "просрочен";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return `${h}ч ${m}м`;
}

/** Read-only factory snapshot label for work mapping (B2). Broker does not edit ManufacturerSku. */
export function factorySkuSnapshotLine(item: {
  manufacturerSkuId?: string | null;
  attrs?: CalcItem["attrs"];
}): string | null {
  const sku = item.attrs?.extra?.sku;
  if (!item.manufacturerSkuId && !sku) return null;
  const bits = [
    sku ? `SKU ${sku}` : null,
    item.attrs?.brand ? `бренд ${item.attrs.brand}` : null,
    item.attrs?.netWeightKg != null ? `${item.attrs.netWeightKg} кг` : null,
    item.attrs?.originCountry ? `origin ${item.attrs.originCountry}` : null,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "Эталон производителя (снимок)";
}

export function queueBadge(opts: {
  preferredBrokerUserId?: string | null;
  meId: string;
  queuedAt?: string | null;
  preferredClaimHours?: number;
}): "preferred" | "reserved" | "open" {
  if (!opts.preferredBrokerUserId) return "open";
  if (opts.preferredBrokerUserId === opts.meId) return "preferred";
  const hours = opts.preferredClaimHours ?? 4;
  if (opts.queuedAt) {
    const deadline = new Date(opts.queuedAt).getTime() + hours * 3600_000;
    if (Date.now() >= deadline) return "open";
  }
  return "reserved";
}

/** Soft-fill row duty/VAT from TN VED rate hints (D15 — broker may override). */
export function applyTnvedRowHint(
  row: MapRow,
  hint: { dutyPct?: number | null; vatPct?: number | null }
): Partial<MapRow> {
  const base = row.unitPrice || 0;
  if (base <= 0) return {};
  const patch: Partial<MapRow> = {};
  if (hint.dutyPct != null && Number.isFinite(hint.dutyPct)) {
    patch.dutyRub = Math.round((base * hint.dutyPct) / 100);
  }
  const duty = patch.dutyRub ?? row.dutyRub;
  if (hint.vatPct != null && Number.isFinite(hint.vatPct)) {
    patch.vatRub = Math.round(((base + duty) * hint.vatPct) / 100);
  }
  return patch;
}
