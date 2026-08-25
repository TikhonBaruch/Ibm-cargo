import { TARIFF_RUB } from "./format";
import type { TariffName } from "./types";

export type TariffInfo = {
  name: TariffName;
  price: number;
  sla: string;
  tag: string;
  featured?: boolean;
  summary: string;
  includes: string[];
  skip: string;
  bestFor: string;
};

export const TARIFFS: TariffInfo[] = [
  {
    name: "Код",
    price: TARIFF_RUB["Код"] ?? 990,
    sla: "сразу",
    tag: "Только ТН ВЭД",
    summary: "После оплаты — код ТН ВЭД. Без пошлины, НДС и брокера.",
    includes: [
      "Подбор кода ТН ВЭД ЕАЭС",
      "Пояснение, почему этот код",
    ],
    skip: "Не считает пошлину и НДС. Нет проверки брокером.",
    bestFor: "Нужен только код — для себя или поставщика.",
  },
  {
    name: "Таможня",
    price: TARIFF_RUB["Таможня"] ?? 2990,
    sla: "сразу + форма",
    tag: "Рекомендуем",
    featured: true,
    summary: "Код ТН ВЭД и таможенный расчёт: стоимость, пошлина, НДС.",
    includes: [
      "Код ТН ВЭД после оплаты",
      "Форма: инвойс, вес, количество → пошлина и НДС",
      "PDF с кодом и платежами",
    ],
    skip: "Брокер не включён. Для сопровождения возьмите «Под ключ».",
    bestFor: "Сами везёте и хотите цифры по платежам.",
  },
  {
    name: "Под ключ",
    price: TARIFF_RUB["Под ключ"] ?? 5990,
    sla: "код сразу · брокер ≤ 4 ч",
    tag: "Брокер включён",
    summary: "Код, таможенный расчёт и живой брокер — всё в одном пакете.",
    includes: [
      "Код ТН ВЭД и расчёт пошлины / НДС",
      "Проверка брокером и правки по рискам",
      "Чат с экспертом до PDF",
    ],
    skip: "Не включает подачу ДТ и сертификаты «под ключ» отдельно.",
    bestFor: "Нужен эксперт: спорный код, маркировка, выпуск.",
  },
];

export function tariffInfo(name: TariffName) {
  return TARIFFS.find((t) => t.name === name) ?? TARIFFS[0];
}

export function tariffPriceForCount(name: TariffName, positions = 1) {
  const n = Math.max(1, Math.round(positions) || 1);
  return (TARIFF_RUB[name] ?? 0) * n;
}

export type CodePackId = "one" | "m20" | "m100";

export const CODE_PACKS: {
  id: CodePackId;
  name: string;
  max: number;
  price: number;
  tag: string;
  featured?: boolean;
  summary: string;
  includes: string[];
}[] = [
  {
    id: "one",
    name: "Старт",
    max: 1,
    price: TARIFF_RUB["Код"] ?? 990,
    tag: "1 позиция",
    summary: "Первый просчёт бесплатно. Дальше 990 ₽ за один код.",
    includes: ["1 код ТН ВЭД ЕАЭС", "Первый раз — 0 ₽, затем 990 ₽"],
  },
  {
    id: "m20",
    name: "Стандарт",
    max: 20,
    price: 3990,
    tag: "Мульти до 20",
    featured: true,
    summary: "До 20 позиций из файла. Один пакет — коды всем строкам.",
    includes: ["Чтение CSV, Excel, PDF и фото", "Код ТН ВЭД каждой позиции"],
  },
  {
    id: "m100",
    name: "Профи",
    max: 100,
    price: 6990,
    tag: "Мульти до 100",
    summary: "До 100 позиций. Для большого инвойса.",
    includes: ["Чтение CSV, Excel, PDF и фото", "Код ТН ВЭД каждой позиции"],
  },
];

export function codePackInfo(id?: CodePackId | string) {
  return CODE_PACKS.find((p) => p.id === id) ?? CODE_PACKS[0];
}

export function codePackForCount(n: number): CodePackId {
  if (n <= 1) return "one";
  if (n <= 20) return "m20";
  return "m100";
}

export function codePackPrice(id: CodePackId | string | undefined, firstFree = false) {
  const pack = codePackInfo(id);
  if (pack.id === "one" && firstFree) return 0;
  return pack.price;
}

export function tariffHasCustoms(name: TariffName) {
  return name === "Таможня" || name === "Под ключ";
}

/** Route is shown only for customs / turnkey tariffs, not for «Код». */
export function tariffShowsRoute(name: TariffName) {
  return tariffHasCustoms(name);
}

export function tariffHasBroker(name: TariffName) {
  return name === "Под ключ";
}

export function upgradeCost(from: TariffName, to: TariffName) {
  return Math.max(0, (TARIFF_RUB[to] ?? 0) - (TARIFF_RUB[from] ?? 0));
}

export function wizardSteps(name: TariffName) {
  return tariffHasCustoms(name)
    ? (["Товар", "Тариф", "Оплата", "Код", "Платежи"] as const)
    : (["Товар", "Оплата", "Код"] as const);
}
