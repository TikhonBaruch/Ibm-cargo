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
