export type OrderStatus = "draft" | "pay" | "ai" | "ready" | "broker" | "done";
export type TariffName = "Код" | "Таможня" | "Под ключ";
export type OrderDocKind = "photo" | "pdf" | "other";

export type OrderDoc = {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: OrderDocKind;
  preview?: string;
  packLines?: { name: string; qty?: string; price?: string }[];
  packSource?: "csv" | "xlsx" | "pdf" | "ocr";
  /** Сырой текст OCR с фото/PDF — для классификации одной позиции */
  ocrText?: string;
};

export type HsLine = {
  id: string;
  n: number;
  name: string;
  qty: string;
  price: string;
  currency: string;
  hs: string;
  conf: number;
  why: string;
  risk: string;
  status: "wait" | "run" | "ok";
};

export type ClientOrder = {
  id: string;
  title: string;
  desc?: string;
  route: string;
  sum: string;
  status: OrderStatus;
  pill: string;
  pillClass: string;
  img: string;
  hs: string;
  conf: number;
  broker: string;
  duty: string;
  vat: string;
  fee: string;
  why: string;
  docs: OrderDoc[];
  risk: string;
  slaLeft: number;
  tariff: TariffName;
  country?: string;
  city?: string;
  price?: string;
  currency?: string;
  qty?: string;
  weightKg?: string;
  places?: string;
  incoterm?: string;
  customsPaid?: boolean;
  packSize?: number;
  lines?: HsLine[];
};

export type QueueJob = {
  id: string;
  client: string;
  tariff: string;
  conf: number;
  taken: boolean;
};

export type WorkJob = {
  id: string;
  client: string;
  taken: string;
  sla: string;
  status: string;
  pill: string;
};

export type Note = {
  id: string;
  title: string;
  text: string;
  tone: "" | "ok" | "warn";
  orderId: string;
};

export type ChatMsg = {
  from: "me" | "them";
  text: string;
  kind?: "text" | "voice";
  audioUrl?: string;
  durationSec?: number;
};

export type ChatSend = string | {
  text?: string;
  audioUrl: string;
  durationSec: number;
};

import type { ProductAttrs } from "@/lib/ved/product-description";

export type WizardDraft = {
  desc: string;
  country: string;
  city: string;
  price: string;
  currency: string;
  qty: string;
  weightKg: string;
  places: string;
  incoterm: string;
  tariff: TariffName;
  docs: OrderDoc[];
  packMode: "single" | "multi";
  packSize: number;
  lines: HsLine[];
  codePack: "one" | "m20" | "m100";
  /** Clarify attrsPatch seed for Phase 3 domain create. */
  attrs?: ProductAttrs;
};

export const EMPTY_WIZARD: WizardDraft = {
  desc: "",
  country: "Китай",
  city: "Москва",
  price: "18000",
  currency: "USD",
  qty: "",
  weightKg: "",
  places: "",
  incoterm: "FOB",
  tariff: "Код",
  docs: [],
  packMode: "single",
  packSize: 0,
  lines: [],
  codePack: "one",
};

export type HistoryItem = {
  title: string;
  text: string;
  tone: "" | "ok" | "warn";
  amount?: number;
};
