import type { ClientOrder, OrderStatus } from "./types";

export type FeedFilter = "all" | "pay" | "hs" | "work" | "done";

export const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "pay", label: "Оплата" },
  { id: "hs", label: "ТН ВЭД" },
  { id: "work", label: "В работе" },
  { id: "done", label: "Готово" },
];

export function hasHsCode(o: Pick<ClientOrder, "hs">) {
  return Boolean(o.hs && o.hs !== "—" && !o.hs.includes("— —"));
}

export function feedMatch(o: ClientOrder, filter: FeedFilter) {
  if (filter === "all") return true;
  if (filter === "pay") return o.status === "pay" || o.status === "draft";
  if (filter === "hs") return hasHsCode(o);
  if (filter === "work") return o.status === "ai" || o.status === "ready" || o.status === "broker";
  return o.status === "done";
}

export function feedMeta(o: ClientOrder) {
  const pack = o.lines?.length ? `${o.lines.length} поз.` : "";
  const hs = hasHsCode(o) ? `ТН ВЭД ${o.hs}` : "код после оплаты";
  const step =
    o.status === "broker"
      ? "у брокера"
      : o.status === "ready"
        ? "платежи готовы"
        : o.status === "ai"
          ? "нужен таможенный расчёт"
          : o.status === "pay"
            ? "ожидает оплату"
            : o.status === "draft"
              ? "черновик"
              : "готово";
  return `#${o.id} · ${[pack, hs, step].filter(Boolean).join(" · ")}`;
}

export function feedProgress(status: OrderStatus) {
  if (status === "draft") return 18;
  if (status === "pay") return 36;
  if (status === "ai") return 58;
  if (status === "ready") return 78;
  if (status === "broker") return 88;
  return 100;
}
