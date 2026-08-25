import { isOrderPlaceholder, pickOrderCover, sanitizeOrderImage } from "./docs";
import type { ClientOrder, HistoryItem, Note } from "./types";

export const DEMO_STORAGE_KEY = "lbm-demo-v2";

export type PersistedDemo = {
  orders: ClientOrder[];
  notes: Note[];
  balance: number;
  history: HistoryItem[];
  freeHsUsed?: boolean;
};

function dedupeOrders(orders: ClientOrder[]): ClientOrder[] {
  const seen = new Set<string>();
  return orders.filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

function slimOrders(orders: ClientOrder[]): ClientOrder[] {
  return dedupeOrders(orders).map((o) => {
    const img = sanitizeOrderImage(o.img);
    return {
      ...o,
      img: isOrderPlaceholder(img) ? pickOrderCover({ ...o, img }) : img,
      docs: (o.docs || []).map((d) => ({
        ...d,
        preview: d.preview?.startsWith("blob:") || (d.preview && d.preview.length > 180_000)
          ? undefined
          : d.preview,
      })),
    };
  });
}

export function readPersistedDemo(): PersistedDemo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedDemo;
    if (!Array.isArray(data.orders) || !data.orders.length) return null;
    if (typeof data.balance !== "number") return null;
    return {
      orders: slimOrders(data.orders),
      notes: Array.isArray(data.notes) ? data.notes : [],
      balance: data.balance,
      history: Array.isArray(data.history) ? data.history : [],
      freeHsUsed: Boolean(data.freeHsUsed),
    };
  } catch {
    return null;
  }
}

export function writePersistedDemo(data: PersistedDemo) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
      orders: slimOrders(data.orders),
      notes: data.notes,
      balance: data.balance,
      history: data.history,
      freeHsUsed: Boolean(data.freeHsUsed),
    }));
  } catch {
    // quota / private mode
  }
}
