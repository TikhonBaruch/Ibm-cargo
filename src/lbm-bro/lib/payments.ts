import { fmt } from "./format";

export const FX: Record<string, number> = {
  USD: 90,
  EUR: 98,
  CNY: 12.5,
};

export const CUSTOMS_CALC_MSGS = [
  "Считаем таможенную стоимость…",
  "Пошлина по коду ТН ВЭД…",
  "НДС 20%…",
];

export const CUSTOMS_FEE = 15000;

export type PaymentDraft = {
  city: string;
  price: string;
  currency: string;
  qty: string;
  weightKg: string;
  places: string;
  incoterm: string;
};

export const EMPTY_PAYMENTS: PaymentDraft = {
  city: "Москва",
  price: "18000",
  currency: "USD",
  qty: "",
  weightKg: "",
  places: "",
  incoterm: "FOB",
};

const CHAPTER_DUTY: Record<string, number> = {
  "09": 0.05,
  "33": 0.065,
  "39": 0.065,
  "40": 0.1,
  "42": 0.1,
  "52": 0.1,
  "54": 0.1,
  "60": 0.1,
  "61": 0.1,
  "62": 0.1,
  "64": 0.1,
  "69": 0.12,
  "71": 0.1,
  "73": 0.1,
  "84": 0.05,
  "85": 0.05,
  "87": 0.05,
  "90": 0.05,
  "91": 0.1,
  "94": 0.1,
  "95": 0.1,
};

export function dutyRate(hs: string) {
  const d = (hs || "").replace(/\D/g, "");
  if (!d) return 0.07;
  if (d.startsWith("8471") || d.startsWith("851713") || d.startsWith("851714")) return 0;
  if (d.startsWith("842123")) return 0;
  if (d.startsWith("6105") || d.startsWith("6109") || d.startsWith("6110")) return 0.1;
  if (d.startsWith("8708")) return 0.05;
  const chapter = CHAPTER_DUTY[d.slice(0, 2)];
  return chapter ?? 0.07;
}

export function calcPayments(input: { price: string; currency: string; hs: string }) {
  const price = Number(input.price) || 0;
  const fx = FX[input.currency] || 90;
  const cv = price * fx;
  const rate = dutyRate(input.hs);
  const duty = Math.round(cv * rate);
  const vat = Math.round((cv + duty) * 0.2);
  const total = duty + vat + CUSTOMS_FEE;
  return { price, fx, cv, rate, duty, vat, fee: CUSTOMS_FEE, total };
}

export type PackPayLine = { hs: string; price?: string; qty?: string };

function linePriceNum(price?: string) {
  return Number(String(price ?? "").replace(",", ".")) || 0;
}

/** Суммарный расчёт по каждой позиции со своим кодом ТН ВЭД. */
export function calcPackPayments(
  lines: PackPayLine[],
  currency: string,
  totalFallback?: string,
) {
  const coded = lines.filter((l) => l.hs && l.hs !== "—");
  if (coded.length <= 1) {
    const hs = coded[0]?.hs || "—";
    const price = linePriceNum(coded[0]?.price) > 0 ? coded[0]!.price! : (totalFallback || "0");
    return { ...calcPayments({ price, currency, hs }), lineCount: coded.length };
  }

  const fx = FX[currency] || 90;
  const lineSum = coded.reduce((s, l) => s + linePriceNum(l.price), 0);
  const pool = lineSum > 0 ? 0 : (Number(totalFallback) || 0);
  let totalCv = 0;
  let totalDuty = 0;
  let totalVat = 0;
  let weightedRate = 0;
  let allocated = 0;

  for (const line of coded) {
    let price = linePriceNum(line.price);
    if (price <= 0 && pool > 0) {
      const qtySum = coded.reduce((s, l) => s + (Number(l.qty) || 1), 0);
      price = pool * ((Number(line.qty) || 1) / qtySum);
    }
    allocated += price;
    const part = calcPayments({ price: String(price), currency, hs: line.hs });
    totalCv += part.cv;
    totalDuty += part.duty;
    totalVat += part.vat;
    weightedRate += part.rate * price;
  }

  const totalPrice = lineSum > 0 ? lineSum : allocated;
  const rate = totalPrice > 0 ? weightedRate / totalPrice : dutyRate(coded[0].hs);
  return {
    price: totalPrice,
    fx,
    cv: totalCv,
    rate,
    duty: totalDuty,
    vat: totalVat,
    fee: CUSTOMS_FEE,
    total: totalDuty + totalVat + CUSTOMS_FEE,
    lineCount: coded.length,
  };
}

export function resolvePayments(input: {
  price: string;
  currency: string;
  hs: string;
  lines?: PackPayLine[];
}) {
  const coded = input.lines?.filter((l) => l.hs && l.hs !== "—") ?? [];
  if (coded.length >= 2) {
    return calcPackPayments(coded, input.currency, input.price);
  }
  const hs = coded[0]?.hs || input.hs;
  const price = coded.length === 1 && linePriceNum(coded[0].price) > 0 ? coded[0].price! : input.price;
  return { ...calcPayments({ price, currency: input.currency, hs }), lineCount: coded.length };
}

export function paymentsSummary(p: ReturnType<typeof calcPayments>) {
  return {
    duty: fmt(p.duty),
    vat: fmt(p.vat),
    fee: fmt(p.fee),
    sum: `${fmt(p.total)} ₽`,
  };
}

export function parseRub(v: string) {
  const n = Number(String(v || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
