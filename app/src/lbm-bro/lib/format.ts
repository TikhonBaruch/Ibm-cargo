export const TARIFF_RUB: Record<string, number> = {
  Код: 990,
  Таможня: 2990,
  "Под ключ": 5990,
};

export function fmt(n: number) {
  return Math.round(n).toLocaleString("ru-RU");
}

export function fmtSla(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h} ч ${String(m).padStart(2, "0")} мин ${String(s).padStart(2, "0")} с`;
}

export function fmtSlaShort(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h <= 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

export function stageIndex(status: string, tariff?: string) {
  const customs = tariff === "Таможня" || tariff === "Под ключ";
  if (!customs) {
    return ({ draft: 0, pay: 1, ai: 2, ready: 2, broker: 2, done: 3 } as Record<string, number>)[status] ?? 0;
  }
  return ({ draft: 0, pay: 1, ai: 2, ready: 3, broker: 3, done: 4 } as Record<string, number>)[status] ?? 0;
}

export function todayShort() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
