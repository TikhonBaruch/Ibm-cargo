"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { INITIAL_HISTORY, INITIAL_NOTES, INITIAL_ORDERS, INITIAL_QUEUE, INITIAL_WORK } from "./demo-data";
import { readPersistedDemo, writePersistedDemo } from "./demo-persist";
import { orderCoverUrl, revokeDoc } from "./docs";
import { fmt, TARIFF_RUB, todayShort } from "./format";
import { classifyName, packInvoiceSum, resolvePack } from "./batch-hs";
import { preloadClassifier, type TnvedData } from "./tnved-lookup";
import { codePackPrice, tariffHasBroker, tariffHasCustoms, upgradeCost } from "./tariffs";
import { parseRub, CUSTOMS_FEE } from "./payments";
import { productTitle } from "./product-copy";
import type {
  ChatMsg, ChatSend, ClientOrder, HistoryItem, Note, OrderDoc, QueueJob, TariffName, WizardDraft, WorkJob,
} from "./types";
import { EMPTY_WIZARD } from "./types";

type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };

type DemoCtx = {
  toast: string;
  showToast: (msg: string) => void;
  orders: ClientOrder[];
  notes: Note[];
  noteDot: boolean;
  currentOrderId: string;
  setCurrentOrderId: (id: string) => void;
  balance: number;
  history: HistoryItem[];
  queue: QueueJob[];
  work: WorkJob[];
  queueCount: number;
  workCount: number;
  activeJobId: string;
  hsEdit: string;
  setHsEdit: (v: string) => void;
  hsComment: string;
  setHsComment: (v: string) => void;
  support: ChatMsg[];
  brokerChat: ChatMsg[];
  chatBadge: number;
  wizard: WizardDraft;
  setWizard: (patch: Partial<WizardDraft>) => void;
  prepareWizard: (seed: Partial<WizardDraft>) => void;
  beginNewCalculation: (opts?: { keepSeed?: boolean }) => void;
  initWizardSession: () => void;
  wizardSession: number;
  tnvedReady: boolean;
  tnvedData: TnvedData | null;
  freeHsUsed: boolean;
  consumeFreeHs: () => void;
  setOrderDocs: (orderId: string, docs: OrderDoc[]) => void;
  payOrder: (id: string) => boolean;
  sendToBroker: (id: string) => void;
  applyAiResult: (id: string, patch: Partial<ClientOrder>) => void;
  applyPayments: (id: string, patch: Partial<ClientOrder>, opts?: { send?: boolean }) => void;
  upgradeTariff: (id: string, next: TariffName) => boolean;
  payCustomsBill: (id: string) => boolean;
  finishWizard: (kind: "paid" | "draft") => string;
  takeJob: (id: string) => void;
  approveJob: () => void;
  assignBroker: (name: string) => void;
  topup: (amount: number) => void;
  sendSupport: (payload: ChatSend) => void;
  sendBrokerChat: (payload: ChatSend) => void;
  tickSla: (id: string) => void;
};

const Ctx = createContext<DemoCtx | null>(null);

/** Demo order numbers start at 47xxx; pick next free id (no random collisions). */
function nextOrderId(existing: ClientOrder[]): string {
  const used = new Set(existing.map((o) => o.id));
  const numeric = existing
    .map((o) => Number(o.id))
    .filter((n) => Number.isFinite(n) && n >= 47000 && n < 99999);
  let candidate = (numeric.length ? Math.max(...numeric) : 47999) + 1;
  while (used.has(String(candidate))) candidate += 1;
  return String(candidate);
}

function toChatMsg(payload: ChatSend): ChatMsg | null {
  if (typeof payload === "string") {
    const text = payload.trim();
    if (!text) return null;
    return { from: "me", text };
  }
  if (payload.audioUrl) {
    return {
      from: "me",
      kind: "voice",
      audioUrl: payload.audioUrl,
      durationSec: payload.durationSec,
      text: payload.text?.trim() || "Голосовое сообщение",
    };
  }
  return null;
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState("");
  const audioRef = useRef<AudioContext | null>(null);
  const primeAudio = useCallback(() => {
    try {
      const Ctx = (window.AudioContext || (window as WindowWithAudio).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return;
      if (!audioRef.current) audioRef.current = new Ctx();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
    } catch {
      // ignore
    }
  }, []);
  const playBeep = useCallback(() => {
    try {
      const Ctx = (window.AudioContext || (window as WindowWithAudio).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return;
      if (!audioRef.current) audioRef.current = new Ctx();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      o.start(now);
      o.stop(now + 0.2);
    } catch {
      // ignore audio errors
    }
  }, []);

  const notify = useCallback((msg: string) => {
    // Visual toast + sound + OS notification (when allowed).
    setToast(msg);
    playBeep();
    try {
      if ("Notification" in window) {
        const n = window.Notification;
        if (n.permission === "granted") {
          new n("LBM Брокер", { body: msg });
        } else if (n.permission === "default") {
          void n.requestPermission().then((p) => {
            if (p === "granted") {
              new n("LBM Брокер", { body: msg });
            }
          });
        }
      }
    } catch {
      // ignore notification errors
    }
    window.setTimeout(() => setToast(""), 2400);
  }, [playBeep]);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [notes, setNotes] = useState(INITIAL_NOTES);
  const [noteDot, setNoteDot] = useState(true);
  const [currentOrderId, setCurrentOrderId] = useState("47880");
  const [balance, setBalance] = useState(12400);
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [persistReady, setPersistReady] = useState(false);
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [work, setWork] = useState(INITIAL_WORK);
  const [queueCount, setQueueCount] = useState(12);
  const [workCount, setWorkCount] = useState(4);
  const [activeJobId, setActiveJobId] = useState("47892");
  const [hsEdit, setHsEdit] = useState("8471 30 000 0");
  const [hsComment, setHsComment] = useState("");
  const [support, setSupport] = useState<ChatMsg[]>([
    { from: "them", text: "Здравствуйте! Я поддержка LBM Брокер. Чем помочь?" },
    { from: "them", text: "По заявке #47880 брокер Иванов ждёт плотность ткани." },
  ]);
  const [brokerChat, setBrokerChat] = useState<ChatMsg[]>([
    { from: "them", text: "Клиент: нужен сертификат соответствия по ткани" },
    { from: "me", text: "Запросил у вас плотность и состав — жду уточнение для кода ТН ВЭД" },
  ]);
  const [chatBadge, setChatBadge] = useState(3);
  const [wizard, setWizardState] = useState<WizardDraft>(() => ({ ...EMPTY_WIZARD, docs: [] }));
  const [wizardSession, setWizardSession] = useState(0);
  const wizardSeedRef = useRef<Partial<WizardDraft> | null>(null);
  const [freeHsUsed, setFreeHsUsed] = useState(false);
  const [tnvedData, setTnvedData] = useState<TnvedData | null>(null);
  const [tnvedReady, setTnvedReady] = useState(false);

  // Hydrate demo state from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    const saved = readPersistedDemo();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only restore after hydration
      setOrders(saved.orders);
      setNotes(saved.notes.length ? saved.notes : INITIAL_NOTES);
      setBalance(saved.balance);
      setHistory(saved.history.length ? saved.history : INITIAL_HISTORY);
      setFreeHsUsed(Boolean(saved.freeHsUsed));
    }
    setPersistReady(true);
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    const t = window.setTimeout(() => {
      writePersistedDemo({ orders, notes, balance, history, freeHsUsed });
    }, 280);
    return () => window.clearTimeout(t);
  }, [persistReady, orders, notes, balance, history, freeHsUsed]);

  useEffect(() => {
    let cancelled = false;
    preloadClassifier()
      .then(([data]) => {
        if (!cancelled) {
          setTnvedData(data);
          setTnvedReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setTnvedReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  const showToast = useCallback((msg: string) => {
    void msg;
    // Action hints are silent — only notify() shows system events.
  }, []);

  const setWizard = useCallback((patch: Partial<WizardDraft>) => {
    setWizardState((w) => ({ ...w, ...patch }));
  }, []);

  const prepareWizard = useCallback((seed: Partial<WizardDraft>) => {
    wizardSeedRef.current = seed;
  }, []);

  const beginNewCalculation = useCallback((opts?: { keepSeed?: boolean }) => {
    if (!opts?.keepSeed) wizardSeedRef.current = null;
    setWizardSession((n) => n + 1);
  }, []);

  const initWizardSession = useCallback(() => {
    const seed = wizardSeedRef.current;
    wizardSeedRef.current = null;
    setWizardState((prev) => {
      for (const d of prev.docs) revokeDoc(d);
      return { ...EMPTY_WIZARD, docs: [], ...(seed || {}) };
    });
  }, []);

  const consumeFreeHs = useCallback(() => {
    setFreeHsUsed(true);
  }, []);

  const pushDebit = useCallback((amount: number, title: string) => {
    setBalance((b) => b - amount);
    setHistory((h) => [{
      title,
      text: `${todayShort()} · −${fmt(amount)} ₽`,
      tone: "warn",
      amount: -amount,
    }, ...h]);
  }, []);

  const pushCredit = useCallback((amount: number, title: string) => {
    setBalance((b) => b + amount);
    setHistory((h) => [{
      title,
      text: `${todayShort()} · +${fmt(amount)} ₽`,
      tone: "ok",
      amount,
    }, ...h]);
  }, []);

  const payOrder = useCallback((id: string) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return false;
    if (o.status !== "pay" && o.status !== "draft") return true;
    const feeAmt = TARIFF_RUB[o.tariff] || 2990;
    if (balance < feeAmt) {
      showToast("Недостаточно средств — пополните баланс");
      return false;
    }
    pushDebit(feeAmt, `Тариф ${o.tariff} #${id}`);
    const customs = tariffHasCustoms(o.tariff);
    setOrders((list) => list.map((x) => x.id === id
      ? {
        ...x,
        status: customs ? "ai" : "done",
        pill: "Код готов",
        pillClass: customs ? "blue" : "ok",
        broker: "—",
        hs: x.hs && x.hs !== "—" ? x.hs : classifyName(x.desc || "", tnvedData).hs,
        conf: x.conf || classifyName(x.desc || "", tnvedData).conf,
        why: customs
          ? "Код открыт после оплаты. Дальше — таможенный расчёт по этому коду."
          : "Код открыт. Таможенный расчёт и брокер в этот тариф не входят.",
        duty: "—",
        vat: "—",
        sum: `${fmt(feeAmt)} ₽`,
        fee: fmt(feeAmt),
      }
      : x));
    return true;
  }, [orders, balance, showToast, pushDebit, tnvedData]);

  const sendToBroker = useCallback((id: string) => {
    const o = orders.find((x) => x.id === id);
    if (!o || o.status !== "ready") return;
    setOrders((list) => list.map((x) => x.id === id
      ? { ...x, status: "broker", pill: "У брокера", pillClass: "blue", broker: x.broker && x.broker !== "—" ? x.broker : "Иванов", slaLeft: 4 * 3600 }
      : x));
    setQueue((q) => [{ id, client: "ООО Импортёр", tariff: o.tariff, conf: o.conf || 94, taken: false }, ...q]);
    setQueueCount((n) => n + 1);
  }, [orders]);

  const applyAiResult = useCallback((id: string, patch: Partial<ClientOrder>) => {
    setOrders((list) => list.map((x) => x.id === id ? { ...x, ...patch } : x));
  }, []);

  const applyPayments = useCallback((id: string, patch: Partial<ClientOrder>, opts?: { send?: boolean }) => {
    const current = orders.find((x) => x.id === id);
    setOrders((list) => list.map((x) => {
      if (x.id !== id) return x;
      if (x.status === "broker" || x.status === "done") return { ...x, ...patch };
      const next = { ...x, ...patch };
      if (opts?.send) {
        return {
          ...next,
          status: "broker" as const,
          pill: "У брокера",
          pillClass: "blue",
          broker: next.broker && next.broker !== "—" ? next.broker : "Иванов",
          slaLeft: 4 * 3600,
        };
      }
      return {
        ...next,
        status: "ready" as const,
        pill: "Платежи готовы",
        pillClass: "ok",
      };
    }));
    if (opts?.send && current) {
      setQueue((q) => [{ id, client: "ООО Импортёр", tariff: current.tariff, conf: current.conf || 94, taken: false }, ...q]);
      setQueueCount((n) => n + 1);
    }
  }, [orders]);

  const upgradeTariff = useCallback((id: string, next: TariffName) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return false;
    if (o.tariff === next) return true;
    const delta = upgradeCost(o.tariff, next);
    if (delta > 0 && balance < delta) {
      showToast("Недостаточно средств — пополните баланс");
      return false;
    }
    if (delta > 0) pushDebit(delta, `Доплата ${next} #${id}`);
    const hasCalc = Boolean(o.duty && o.duty !== "—");
    const toCustoms = tariffHasCustoms(next);
    setOrders((list) => list.map((x) => {
      if (x.id !== id) return x;
      let status = x.status;
      let pill = x.pill;
      let pillClass = x.pillClass;
      if (toCustoms && !hasCalc) {
        status = "ai";
        pill = "Код готов";
        pillClass = "blue";
      } else if (tariffHasBroker(next) && hasCalc && x.status !== "broker" && x.status !== "done") {
        status = "ready";
        pill = "Платежи готовы";
        pillClass = "ok";
      } else if (tariffHasBroker(next) && hasCalc && x.status === "done") {
        status = "ready";
        pill = "Платежи готовы";
        pillClass = "ok";
      }
      return { ...x, tariff: next, status, pill, pillClass };
    }));
    return true;
  }, [orders, balance, showToast, pushDebit]);

  const payCustomsBill = useCallback((id: string) => {
    const o = orders.find((x) => x.id === id);
    if (!o || o.customsPaid) return true;
    const duty = parseRub(o.duty);
    const vat = parseRub(o.vat);
    if (duty + vat <= 0) return false;
    const amount = duty + vat + CUSTOMS_FEE;
    if (balance < amount) {
      showToast("Недостаточно средств — пополните баланс");
      return false;
    }
    pushDebit(amount, `Таможня #${id}`);
    setOrders((list) => list.map((x) => x.id === id
      ? { ...x, customsPaid: true, pill: x.status === "broker" ? x.pill : "Таможня оплачена", pillClass: x.status === "broker" ? x.pillClass : "ok" }
      : x));
    return true;
  }, [orders, balance, showToast, pushDebit]);

  const finishWizard = useCallback((kind: "paid" | "draft") => {
    const firstFree = (wizard.packMode || (wizard.packSize ? "multi" : "single")) !== "multi" && !freeHsUsed;
    const feeAmt = kind === "paid"
      ? codePackPrice(wizard.codePack || ((wizard.packMode === "multi" || wizard.packSize) ? "m20" : "one"), firstFree)
      : 0;
    if (kind === "paid" && balance < feeAmt) return "";
    const pack = resolvePack(wizard.packMode || (wizard.packSize ? "multi" : "single"), wizard.packSize, wizard.docs, wizard.currency, wizard.lines);
    const invoice = pack.packSize
      ? String(Math.round(packInvoiceSum(pack.lines)) || wizard.price || "")
      : wizard.price;
    const num = nextOrderId(orders);
    const o: ClientOrder = {
      id: num,
      title: pack.packSize ? `Пакет ${pack.packSize} позиций` : productTitle(wizard.desc),
      desc: wizard.desc,
      route: `${wizard.country} → ${wizard.city}`,
      sum: kind === "paid" ? (feeAmt ? `${fmt(feeAmt)} ₽` : "0 ₽") : "—",
      status: kind === "paid" ? "ai" : "draft",
      pill: kind === "paid" ? (feeAmt ? "Оплата прошла" : "Первый код бесплатно") : "Черновик",
      pillClass: kind === "paid" ? "blue" : "muted",
      img: orderCoverUrl(wizard.docs),
      hs: "—",
      conf: 0,
      broker: "—",
      duty: "—",
      vat: "—",
      fee: kind === "paid" ? (feeAmt ? fmt(feeAmt) : "0") : "тариф",
      why: pack.packSize ? `Пакет на ${pack.packSize} позиций. Коды откроются после обработки.` : "",
      docs: [...wizard.docs],
      risk: "—",
      slaLeft: 0,
      tariff: "Код",
      country: wizard.country,
      city: wizard.city,
      price: invoice,
      currency: wizard.currency,
      qty: pack.packSize ? String(pack.packSize) : wizard.qty,
      weightKg: wizard.weightKg,
      places: wizard.places,
      incoterm: wizard.incoterm,
      packSize: pack.packSize || undefined,
      lines: pack.lines.length ? pack.lines : undefined,
    };
    if (kind === "paid") {
      if (feeAmt) pushDebit(feeAmt, `Тариф ${wizard.tariff} #${num}`);
      else setFreeHsUsed(true);
    } else {
      initWizardSession();
    }
    setOrders((list) => [o, ...list]);
    setCurrentOrderId(num);
    return num;
  }, [wizard, balance, freeHsUsed, pushDebit, initWizardSession, orders]);

  const takeJob = useCallback((id: string) => {
    const clean = id.replace("#", "");
    setQueue((q) => q.map((j) => j.id === clean ? { ...j, taken: true } : j));
    setActiveJobId(clean);
    const o = orders.find((x) => x.id === clean);
    setHsEdit(o && o.hs !== "—" ? o.hs : "8471 30 000 0");
    setQueueCount((n) => Math.max(0, n - 1));
    setWorkCount((n) => n + 1);
    setWork((w) => [{
      id: clean, client: o ? "ООО Импортёр" : "Новый клиент", taken: "только что", sla: "3 ч 50 мин", status: "Новая", pill: "blue",
    }, ...w]);
    showToast(`Заявка #${clean} закреплена за вами`);
  }, [orders, showToast]);

  const approveJob = useCallback(() => {
    const code = hsEdit;
    const note = hsComment || "без комментария";
    setOrders((list) => list.map((x) => x.id === activeJobId
      ? { ...x, status: "done", pill: "Готово", pillClass: "ok", hs: code, why: note === "без комментария" ? x.why : note, slaLeft: 0 }
      : x));
    setNotes((list) => [{
      id: `n-${Date.now()}`, title: `PDF готов #${activeJobId}`, text: `Брокер утвердил ТН ВЭД ${code}`, tone: "ok", orderId: activeJobId,
    }, ...list]);
    setNoteDot(true);
    notify(`Утверждено · клиент получил PDF · ТН ВЭД ${code}`);
  }, [hsEdit, hsComment, activeJobId, notify]);

  const assignBroker = useCallback((name: string) => {
    setOrders((list) => list.map((x) => x.id === currentOrderId ? { ...x, broker: name } : x));
    showToast(`На заявку #${currentOrderId} назначен брокер ${name}`);
  }, [currentOrderId, showToast]);

  const topup = useCallback((amount: number) => {
    if (amount <= 0) return;
    pushCredit(amount, "Пополнение");
    showToast(`Баланс пополнен на ${fmt(amount)} ₽`);
  }, [showToast, pushCredit]);

  const sendSupport = useCallback((payload: ChatSend) => {
    const row = toChatMsg(payload);
    if (!row) return;
    setSupport((s) => [...s, row]);
    setChatBadge(1);
    primeAudio();
    window.setTimeout(() => {
      setSupport((s) => [...s, { from: "them", text: row.kind === "voice"
        ? "Голосовое получили. Ответим в течение 15 минут."
        : `Приняли #S-${Math.floor(Math.random() * 900 + 100)}. Ответим в течение 15 минут.` }]);
      notify("Пришло сообщение в чат поддержки");
    }, 700);
  }, [notify, primeAudio]);

  const sendBrokerChat = useCallback((payload: ChatSend) => {
    const row = toChatMsg(payload);
    if (!row) return;
    setBrokerChat((s) => [...s, row]);
  }, []);

  const setOrderDocs = useCallback((orderId: string, docs: OrderDoc[]) => {
    setOrders((list) => list.map((x) => {
      if (x.id !== orderId) return x;
      return { ...x, docs, img: orderCoverUrl(docs) };
    }));
  }, []);

  const tickSla = useCallback((id: string) => {
    setOrders((list) => list.map((x) => x.id === id && x.slaLeft > 0 ? { ...x, slaLeft: x.slaLeft - 1 } : x));
  }, []);

  const value = useMemo<DemoCtx>(() => ({
    toast, showToast, orders, notes, noteDot, currentOrderId, setCurrentOrderId,
    balance, history, queue, work, queueCount, workCount, activeJobId,
    hsEdit, setHsEdit, hsComment, setHsComment, support, brokerChat, chatBadge,
    wizard, setWizard, prepareWizard, beginNewCalculation, initWizardSession, wizardSession, tnvedReady, tnvedData, freeHsUsed, consumeFreeHs, setOrderDocs, payOrder, sendToBroker, applyAiResult, applyPayments, upgradeTariff, payCustomsBill, finishWizard, takeJob, approveJob, assignBroker, topup,
    sendSupport, sendBrokerChat, tickSla,
  }), [
    toast, showToast, orders, notes, noteDot, currentOrderId, balance, history, queue, work,
    queueCount, workCount, activeJobId, hsEdit, hsComment, support, brokerChat, chatBadge,
    wizard, setWizard, prepareWizard, beginNewCalculation, initWizardSession, wizardSession, tnvedReady, tnvedData, freeHsUsed, consumeFreeHs, setOrderDocs, payOrder, sendToBroker, applyAiResult, applyPayments, upgradeTariff, payCustomsBill, finishWizard, takeJob, approveJob, assignBroker, topup,
    sendSupport, sendBrokerChat, tickSla,
  ]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={`toast${toast ? " show" : ""}`} role="status">{toast}</div>
    </Ctx.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}

export function useOrder(id: string) {
  const { orders } = useDemo();
  return orders.find((o) => o.id === id);
}

export type { TariffName };
