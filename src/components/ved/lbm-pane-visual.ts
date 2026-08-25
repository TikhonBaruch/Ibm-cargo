/**
 * Visual mapping from live D8/D10 onto lbm-bro chrome.
 * Copy and step indexes only — no domain mutations, no prototype tariffs.
 */

const BROKER_STATUSES = new Set(["QUEUED", "IN_REVIEW", "SLA_RISK"]);
const PAY_STATUSES = new Set(["AI_READY", "AWAITING_PAYMENT"]);
const AI_STATUSES = new Set(["AI_PROCESSING", "AI_DRAIN", "CREATED"]);

export function clientOrderNextStep(input: {
  status: string;
  paidAt?: string | null;
}): string {
  const { status, paidAt } = input;
  if (status === "DONE") return "PDF готов · скачать";
  if (status === "CANCELLED") return "Заявка отменена";
  if (status === "IN_REVIEW") return "Брокер проверяет код";
  if (status === "SLA_RISK") return "SLA риск · брокер в работе";
  if (status === "QUEUED") return "Ожидайте брокера";
  if (PAY_STATUSES.has(status) && !paidAt) return "Оплатить тариф";
  if (AI_STATUSES.has(status)) return "AI подбирает код";
  return "Открыть заявку";
}

export function clientOrderHsLabel(input: {
  hsCode?: string | null;
  hsCodeFinal?: string | null;
}): string {
  const hs = (input.hsCodeFinal || input.hsCode || "").trim();
  return hs || "—";
}

export function clientOrderStepper(input: {
  status: string;
  tariffCode?: string | null;
}): { labels: string[]; current: number } {
  const withBroker = input.tariffCode !== "EXPRESS";
  const labels = withBroker
    ? ["Товар", "Оплата", "Брокер", "PDF"]
    : ["Товар", "Оплата", "PDF"];
  let current = 0;
  if (input.status === "DONE") current = labels.length - 1;
  else if (BROKER_STATUSES.has(input.status)) current = withBroker ? 2 : labels.length - 1;
  else if (PAY_STATUSES.has(input.status)) current = 1;
  else current = 0;
  return { labels, current };
}

export function newCalcWizardProgress(input: {
  hasGoods: boolean;
  hasTariff: boolean;
}): { labels: string[]; current: number } {
  const labels = ["Товар", "Тариф", "Запуск"];
  let current = 1;
  if (!input.hasGoods) current = 1;
  else if (!input.hasTariff) current = 2;
  else current = 3;
  return { labels, current };
}

export function wizardStepClass(stepN: number, current: number): string {
  if (stepN < current) return "done";
  if (stepN === current) return "on";
  return "";
}

export function tariffMiniBlurb(code: string): string {
  if (code === "EXPRESS") return "1 позиция, только AI — без очереди брокера при high conf";
  if (code === "STANDARD") return "До 3 позиций · очередь брокера после оплаты";
  if (code === "PRO") return "До 10 позиций · очередь брокера после оплаты";
  return "Тариф D10";
}

export function formatRub(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toLocaleString("ru-RU")} ₽`;
}

/** Superapp home feed chips — same labels as the mock, D8 matching. */
export type LiveFeedFilter = "all" | "pay" | "hs" | "work" | "done";

export const LIVE_FEED_FILTERS: { id: LiveFeedFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "pay", label: "Оплата" },
  { id: "hs", label: "ТН ВЭД" },
  { id: "work", label: "В работе" },
  { id: "done", label: "Готово" },
];

export function liveFeedMatch(
  c: {
    status: string;
    paidAt?: string | null;
    hsCode?: string | null;
    hsCodeFinal?: string | null;
  },
  filter: LiveFeedFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "pay") return PAY_STATUSES.has(c.status) && !c.paidAt;
  if (filter === "hs") return clientOrderHsLabel(c) !== "—";
  if (filter === "work") return BROKER_STATUSES.has(c.status) || AI_STATUSES.has(c.status);
  return c.status === "DONE";
}

export function liveFeedMeta(c: {
  number: string;
  status: string;
  paidAt?: string | null;
  hsCode?: string | null;
  hsCodeFinal?: string | null;
  items?: unknown[] | null;
}): string {
  const pack = c.items?.length ? `${c.items.length} поз.` : "";
  const hs = clientOrderHsLabel(c);
  const hsPart = hs !== "—" ? `ТН ВЭД ${hs}` : "код после оплаты";
  return `${c.number} · ${[pack, hsPart, clientOrderNextStep(c)].filter(Boolean).join(" · ")}`;
}

export function liveFeedProgress(status: string): number {
  if (status === "DONE") return 100;
  if (status === "SLA_RISK") return 92;
  if (status === "IN_REVIEW") return 88;
  if (status === "QUEUED") return 78;
  if (AI_STATUSES.has(status)) return 58;
  if (PAY_STATUSES.has(status)) return 36;
  if (status === "CANCELLED") return 0;
  return 18;
}

/** Initials glyph for feed/order art when there is no photo (mock `calcThumb`). */
export function liveCalcInitials(title: string): string {
  const latin = title.replace(/[а-яё]/gi, "").replace(/\s+/g, "").slice(0, 2).toUpperCase();
  return latin || "HS";
}

export type LiveBellNote = {
  id: string;
  title: string;
  text: string;
  href: string;
  tone: "ok" | "warn" | "info";
};

export function liveBellNotes(
  calcs: Array<{
    id: string;
    number: string;
    title: string;
    status: string;
    paidAt?: string | null;
  }>,
  ordersHref: string,
  unreadCount = 0,
): LiveBellNote[] {
  const orderUrl = (id: string) => `${ordersHref}?id=${encodeURIComponent(id)}`;
  const notes: LiveBellNote[] = [];
  if (unreadCount > 0) {
    notes.push({
      id: "unread",
      title: "Сообщения",
      text: `${unreadCount} без ответа в чате`,
      href: ordersHref,
      tone: "warn",
    });
  }
  for (const c of calcs) {
    if (PAY_STATUSES.has(c.status) && !c.paidAt) {
      notes.push({
        id: `pay-${c.id}`,
        title: "Оплата",
        text: `${c.number} · ${c.title}`,
        href: orderUrl(c.id),
        tone: "warn",
      });
    } else if (c.status === "SLA_RISK") {
      notes.push({
        id: `sla-${c.id}`,
        title: "SLA",
        text: `${c.number} · риск срока`,
        href: orderUrl(c.id),
        tone: "warn",
      });
    } else if (c.status === "QUEUED" || c.status === "IN_REVIEW") {
      notes.push({
        id: `work-${c.id}`,
        title: "У брокера",
        text: `${c.number} · ${clientOrderNextStep(c)}`,
        href: orderUrl(c.id),
        tone: "info",
      });
    } else if (c.status === "DONE") {
      notes.push({
        id: `done-${c.id}`,
        title: "PDF готов",
        text: `${c.number} · ${c.title}`,
        href: orderUrl(c.id),
        tone: "ok",
      });
    }
  }
  return notes.slice(0, 8);
}

export function resolveClientSearch(input: {
  q: string;
  calcs: Array<{
    id: string;
    number: string;
    title: string;
    hsCode?: string | null;
    hsCodeFinal?: string | null;
  }>;
  brokerNames: string[];
  path: (suffix: string) => string;
}): string | null {
  const raw = input.q.trim();
  if (!raw) return null;
  const query = raw.toLowerCase().replace(/^#/, "");
  const hit = input.calcs.find((c) => {
    const hs = `${c.hsCode || ""} ${c.hsCodeFinal || ""}`.toLowerCase();
    return (
      c.number.toLowerCase().includes(query) ||
      c.title.toLowerCase().includes(query) ||
      hs.includes(query)
    );
  });
  if (hit) return `${input.path("/orders")}?id=${encodeURIComponent(hit.id)}`;
  if (query.includes("брок") || input.brokerNames.some((n) => n.toLowerCase().includes(query))) {
    return input.path("/brokers");
  }
  if (query.includes("баланс") || query.includes("пополн")) return input.path("/balance");
  if (query.includes("чат") || query.includes("поддерж")) return input.path("/support");
  return `${input.path("/tnved")}?q=${encodeURIComponent(raw)}`;
}

export function clientNavHighlight(pathname: string, nav: Array<{ href: string; label: string }>): string {
  const p = (pathname || "/").replace(/\/$/, "") || "/";
  const byLabel = (match: string | RegExp) =>
    nav.find((n) => (typeof match === "string" ? n.label === match : match.test(n.label)))?.href;
  const home = byLabel("Главная") || byLabel("Дашборд");
  const orders = byLabel(/^Заявки/);
  const tnved = byLabel("Справочник ТН ВЭД");
  const chat = byLabel("Чат") || byLabel("Поддержка");
  const company = byLabel("Компания") || byLabel("Профиль");

  if (
    p.endsWith("/orders") ||
    p.endsWith("/new") ||
    p.endsWith("/shipping") ||
    p.endsWith("/brokers") ||
    p.endsWith("/factory") ||
    p.endsWith("/clearance")
  ) {
    return orders || p;
  }
  if (p.endsWith("/balance") || p.endsWith("/profile") || p.endsWith("/settings")) {
    return company || p;
  }
  if (p.endsWith("/faq") || p.endsWith("/guide")) return home || p;
  if (p.endsWith("/tnved")) return tnved || p;
  if (p.endsWith("/support")) return chat || p;
  return home && (p === home.replace(/\/$/, "") || p === home) ? home : p;
}
