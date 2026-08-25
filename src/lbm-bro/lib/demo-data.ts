import { ORDER_PLACEHOLDER, seedDoc } from "./docs";
import type { ClientOrder, HistoryItem, Note, QueueJob, WorkJob } from "./types";

export const INITIAL_ORDERS: ClientOrder[] = [
  {
    id: "47892", title: "Ноутбуки Lenovo ThinkPad", desc: "Ноутбуки Lenovo ThinkPad\n\nУточнения (ИИ):\nОтвет: Intel Core i7, экран 14 дюймов, вес 1.4 кг",
    route: "Китай → Москва", sum: "1 248 700 ₽",
    status: "done", pill: "Готово", pillClass: "ok", img: "/lbm-bro/assets/cover-laptop.svg",
    hs: "8471 30 000 0", conf: 94, broker: "Иванов", duty: "113 400", vat: "346 680", fee: "15 000",
    why: "Портативные вычислительные машины массой не более 10 кг. Код подтверждён по описанию процессора и экрана.",
    docs: [seedDoc("47892-inv", "Invoice.pdf"), seedDoc("47892-pl", "Packing list.pdf")], risk: "Низкий", slaLeft: 0, tariff: "Таможня",
    country: "Китай", city: "Москва", incoterm: "FOB", price: "18000", currency: "USD", qty: "120", weightKg: "240", places: "10", customsPaid: true,
  },
  {
    id: "47880", title: "Ткани 100% хлопок", desc: "Ткани 100% хлопок, неотбеленные",
    route: "Турция → Москва", sum: "—",
    status: "broker", pill: "У брокера", pillClass: "blue", img: "/lbm-bro/assets/cover-fabric.svg",
    hs: "5208 11 000 0", conf: 84, broker: "Иванов", duty: "—", vat: "—", fee: "—",
    why: "Ткани хлопчатобумажные, неотбеленные. Брокер уточняет плотность для финального кода.",
    docs: [seedDoc("47880-inv", "Invoice.pdf"), seedDoc("47880-photo", "Фото рулона.jpg")], risk: "Нужен сертификат соответствия", slaLeft: 7380, tariff: "Под ключ",
    country: "Турция", city: "Москва", incoterm: "CIF", price: "4200", currency: "EUR", qty: "800", weightKg: "1600", places: "40",
  },
  {
    id: "47861", title: "Автозапчасти", desc: "Автозапчасти для легковых автомобилей",
    route: "Китай → РФ", sum: "2 990 ₽",
    status: "pay", pill: "Оплата", pillClass: "warn", img: "/lbm-bro/assets/cover-auto.svg",
    hs: "8708 99 000 9", conf: 78, broker: "—", duty: "—", vat: "—", fee: "тариф",
    why: "Код откроется после оплаты тарифа. Стоимость и налоги — следующей формой.",
    docs: [seedDoc("47861-inv", "Invoice.pdf")], risk: "Средний", slaLeft: 0, tariff: "Таможня",
    country: "Китай", city: "Москва", incoterm: "FOB", price: "9600", currency: "USD",
  },
  {
    id: "47840", title: "Оборудование", desc: "Оборудование",
    route: "ЕС → РФ", sum: "—",
    status: "draft", pill: "Черновик", pillClass: "muted", img: ORDER_PLACEHOLDER,
    hs: "—", conf: 0, broker: "—", duty: "—", vat: "—", fee: "—",
    why: "", docs: [], risk: "—", slaLeft: 0, tariff: "Код",
    country: "Германия", city: "Санкт-Петербург", incoterm: "EXW",
  },
];

export const INITIAL_NOTES: Note[] = [
  { id: "n1", title: "Иванов ответил по #47880", text: "Нужна плотность ткани", tone: "", orderId: "47880" },
  { id: "n2", title: "PDF готов #47892", text: "Можно скачать отчёт", tone: "ok", orderId: "47892" },
  { id: "n3", title: "Оплата #47861", text: "Тариф Таможня 2 990 ₽", tone: "warn", orderId: "47861" },
];

export const INITIAL_QUEUE: QueueJob[] = [
  { id: "47895", client: "ООО Альфа", tariff: "Таможня", conf: 92, taken: false },
  { id: "47894", client: "ИП Смирнов", tariff: "Под ключ", conf: 71, taken: false },
  { id: "47891", client: "ООО Гамма", tariff: "Код", conf: 88, taken: false },
];

export const INITIAL_WORK: WorkJob[] = [
  { id: "47892", client: "ООО Импортёр", taken: "сегодня 10:20", sla: "2 ч 10 мин", status: "Правка", pill: "blue" },
  { id: "47880", client: "ООО Текстиль", taken: "вчера 16:40", sla: "45 мин", status: "Ждёт ответ", pill: "warn" },
];

export const INITIAL_HISTORY: HistoryItem[] = [
  { title: "Просчёт #47892 Таможня", text: "12.07 · −2 990 ₽", tone: "warn", amount: -2990 },
  { title: "Пополнение картой", text: "10.07 · +10 000 ₽", tone: "ok", amount: 10000 },
  { title: "Просчёт #47840 Код", text: "03.07 · −990 ₽", tone: "warn", amount: -990 },
];
