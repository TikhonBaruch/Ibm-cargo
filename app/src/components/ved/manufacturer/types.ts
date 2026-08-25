import type { VedIconName, VedNavItem } from "../VedShell";
import { factoryUiEnabled } from "@/lib/ved/cabinet-features";

export const SKU_FEATURE_KIND_LABELS: Record<string, string> = {
  COMPOSITION: "Состав %",
  ALCOHOL: "Спирт",
  ENGINE: "Двигатель",
  BATTERY: "Аккумулятор",
  RADIO: "Радио / шифрование",
  PRECIOUS: "Драгметаллы",
  SOFTWARE: "ПО / прошивка",
  CITES: "CITES / био",
  SPARE_PART: "Запчасть",
  KIT_COMPONENT: "Часть комплекта",
  OTHER: "Другое",
};

export const SKU_PACK_LEVEL_LABELS: Record<string, string> = {
  UNIT: "Изделие",
  INNER: "Внутр. упаковка",
  MASTER: "Master carton",
  PALLET: "Паллета",
  CONTAINER: "Контейнер",
};

export type SkuFeature = {
  kind: string;
  label?: string;
  value?: string;
  unit?: string;
  sharePct?: number;
  separatelyDeclared?: boolean;
  notes?: string;
};

export type SkuPackaging = {
  level: string;
  packType?: string;
  qtyPerParent?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  weightKg?: number;
  volumeM3?: number;
  stackable?: boolean;
  maxTiers?: number;
};

export type ManufacturerSku = {
  id: string;
  companyId: string;
  sku: string;
  gtin?: string | null;
  name: string;
  customsName?: string | null;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  originCountry?: string | null;
  factoryName?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: number;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
  volumeM3?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  description?: string | null;
  compositionText?: string | null;
  material?: string | null;
  purpose?: string | null;
  technicalSpecs?: string | null;
  hsHint?: string | null;
  features?: SkuFeature[] | null;
  packagings?: SkuPackaging[] | null;
  moq?: number | null;
  packMultiple?: number | null;
  incoterms?: string | null;
  demandCalcCount?: number;
  demandDoneCount?: number;
  clientPreview?: {
    name: string;
    description?: string;
    attrs?: Record<string, unknown>;
  };
  updatedAt?: string;
};

export type ManufacturerDash = {
  company?: { id: string; name: string; inn?: string | null; kind?: string };
  skuTotal: number;
  skuPublished: number;
  skuDraft: number;
  demandCalcs: number;
  demandDone: number;
  requestSubmitted?: number;
  poolsOpen?: number;
  poolsConfirmed?: number;
};

export type ManufacturerOrderRequest = {
  id: string;
  qty: number;
  note?: string | null;
  status: string;
  rejectReason?: string | null;
  createdAt?: string;
  manufacturerSku: { id: string; sku: string; name: string; moq?: number | null };
  clientCompany?: { name: string; inn?: string | null } | null;
  poolId?: string | null;
  poolStatus?: string | null;
};

export type ManufacturerPool = {
  id: string;
  status: string;
  title?: string | null;
  targetQty?: number | null;
  qtyTotal: number;
  manufacturerSku: { id: string; sku: string; name: string; moq?: number | null };
  requests: Array<{
    id: string;
    qty: number;
    status: string;
    note?: string | null;
    clientCompany?: { name: string; inn?: string | null } | null;
  }>;
};

export type ManufacturerCompany = {
  id: string;
  name: string;
  inn?: string | null;
  kpp?: string | null;
  legalAddress?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export function getManufacturerNav(
  base = "/manufacturer",
  env?: Record<string, string | undefined>
): VedNavItem[] {
  const b = base.replace(/\/$/, "");
  const href = (suffix: string) => (b ? `${b}${suffix}` : suffix || "/");
  const items: VedNavItem[] = [
    { href: href("") || "/", label: "Дашборд", icon: "dash" satisfies VedIconName },
    { href: href("/catalog"), label: "Каталог SKU", icon: "box" satisfies VedIconName },
    { href: href("/demand"), label: "Спрос", icon: "chart" satisfies VedIconName },
    { href: href("/pools"), label: "Сборные заказы", icon: "list" satisfies VedIconName },
    { href: href("/preview"), label: "Как видит клиент", icon: "clipboard" satisfies VedIconName },
    { href: href("/profile"), label: "Профиль", icon: "user" satisfies VedIconName },
  ];
  return items.filter((item) => {
    if (item.href.endsWith("/pools") && !factoryUiEnabled(env)) return false;
    return true;
  });
}

export type ManufacturerPane = "dashboard" | "catalog" | "demand" | "pools" | "preview" | "profile";

export function manufacturerPane(pathname: string): ManufacturerPane {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p.endsWith("/catalog")) return "catalog";
  if (p.endsWith("/demand")) return "demand";
  if (p.endsWith("/pools")) return "pools";
  if (p.endsWith("/preview")) return "preview";
  if (p.endsWith("/profile")) return "profile";
  return "dashboard";
}

export function emptySkuForm(): Partial<ManufacturerSku> {
  return {
    sku: "",
    name: "",
    status: "DRAFT",
    features: [],
    packagings: [],
  };
}

export function statusLabel(status: string) {
  if (status === "PUBLISHED") return "Опубликован";
  if (status === "ARCHIVED") return "Архив";
  return "Черновик";
}
