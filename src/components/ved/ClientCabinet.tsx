"use client";

/**
 * Client cabinet (product branch 1): create/pay, preferred broker, shipping after DONE,
 * chat attachments. Panes in ./client/* — see docs/knowledge/branches.md, ADR D15/D17.
 */
import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { factoryUiEnabled, shippingUiEnabled } from "@/lib/ved/cabinet-features";
import { formatShipmentInvoice, parseShipmentInvoice } from "@/lib/ved/landed-cost";
import { isAiDrainPending, waitForAiEnrich } from "@/lib/ved/ai-drain-client";
import { compressImageForUpload } from "@/lib/ved/compress-image-client";
import { VedEmptyState, api } from "./VedShell";
import { LbmCabinetsShell } from "./LbmCabinetsShell";
import { useVedToast } from "./feedback/VedToast";
import { DashboardPane } from "./client/DashboardPane";
import { ClientSuperappHome } from "./client/ClientSuperappHome";
import { OrderDetail } from "./client/OrderDetail";
import { OrderDetailDrawer } from "./client/OrderDetailDrawer";
import { OrderChat } from "./client/OrderChat";
import { NewCalcPane } from "./client/NewCalcPane";
import { BrokersPane } from "./client/BrokersPane";
import { ShippingPane } from "./client/ShippingPane";
import { BalancePane } from "./client/BalancePane";
import { CompanySettingsPane } from "./client/CompanySettingsPane";
import { SupportPane, type SupportThread } from "./client/SupportPane";
import { FactoryPane } from "./client/FactoryPane";
import type { SupportTicketAction } from "@/lib/ved/support-ticket";
import {
  clientPane,
  getClientNav,
  type Broker,
  type Calc,
  type CalcForm,
  type ChatMsg,
  type ClientFeedbackReaction,
  type CreatePhase,
  type FormItem,
  type Me,
  type Quote,
  type ShipRow,
  type TariffOption,
  type CatalogSku,
  type ClientSegment,
  type FactoryOrderRequest,
  formItemFromCatalogSku,
} from "./client/types";
import { factoryNavBadge } from "@/lib/ved/sku-order";

const PAGE_META: Record<string, { title: string; lead: string }> = {
  dashboard: { title: "Дашборд", lead: "Сводка по просчётам, брокерам и платежам" },
  orders: { title: "Заявки / просчёты", lead: "История AI-расчётов и проверок брокером" },
  factory: { title: "Производитель", lead: "Сборный заказ и каталог · добавить производителя" },
  new: { title: "Новый просчёт", lead: "Опишите партию — AI подготовит черновик ТН ВЭД" },
  brokers: { title: "Брокеры", lead: "Выберите предпочтительного брокера для очереди" },
  shipping: { title: "Перевозка", lead: "Оформление после статуса DONE · котировки и трекинг" },
  balance: { title: "Баланс", lead: "Оплата тарифов с баланса компании" },
  profile: { title: "Профиль", lead: "Реквизиты и контакты компании" },
  support: { title: "Поддержка", lead: "FAQ и обращения · по заявкам — чат с брокером" },
};

export function ClientCabinet() {
  return (
    <Suspense fallback={<VedEmptyState title="Загрузка кабинета…" hint="Подтягиваем заявки, баланс и тарифы." />}>
      <ClientCabinetInner />
    </Suspense>
  );
}

function ClientCabinetInner() {
  const pathname = usePathname() || "/cabinet";
  const router = useRouter();
  const search = useSearchParams();
  const { toast } = useVedToast();
  const shippingOn = shippingUiEnabled();
  const factoryOn = factoryUiEnabled();
  const paneRaw = clientPane(pathname);
  // Shipping pane stays in code/routes; when UI flag off, treat as dashboard (no empty flash).
  const pane =
    !shippingOn && paneRaw === "shipping"
      ? "dashboard"
      : !factoryOn && paneRaw === "factory"
        ? "dashboard"
        : paneRaw;
  const navBase = process.env.NEXT_PUBLIC_CLIENT_BASE ?? "/cabinet";
  const nav = getClientNav(navBase);
  const path = (suffix: string) => {
    const b = navBase.replace(/\/$/, "");
    return b ? `${b}${suffix}` : suffix || "/";
  };
  const cabinetHome = path("");
  const deepOpenedRef = useRef<string | null>(null);

  const [me, setMe] = useState<Me | null>(null);
  const [calcs, setCalcs] = useState<Calc[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [tariffs, setTariffs] = useState<TariffOption[]>([]);
  const [shipping, setShipping] = useState<ShipRow[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createPhase, setCreatePhase] = useState<CreatePhase>("idle");
  const [selected, setSelected] = useState<Calc | null>(null);
  const [preferredBrokerUserId, setPreferredBrokerUserId] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [waitingOn, setWaitingOn] = useState<"CLIENT" | "BROKER" | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [form, setForm] = useState<CalcForm>({
    title: "",
    description: "",
    country: "Китай",
    shipmentValue: "18000",
    shipmentCurrency: "USD",
    tariffCode: "STANDARD",
    preferredBrokerUserId: "",
  });
  const [items, setItems] = useState<FormItem[]>([{ name: "", qty: 1, unitPrice: 0 }]);
  const [topup, setTopup] = useState(5000);
  const [topupMethod, setTopupMethod] = useState<"stub" | "card" | "sbp">("stub");
  const [pendingTopupHint, setPendingTopupHint] = useState("");
  const [shipForm, setShipForm] = useState({
    origin: "Шанхай",
    destination: "Москва",
    mode: "LCL",
    calculationId: "",
    comment: "",
  });
  const [profile, setProfile] = useState({
    name: "",
    inn: "",
    kpp: "",
    legalAddress: "",
    contactEmail: "",
    contactPhone: "",
    clientSegment: "SINGLE" as ClientSegment,
  });
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [supportBox, setSupportBox] = useState<"active" | "archive">("active");
  const [supportSelected, setSupportSelected] = useState<SupportThread | null>(null);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportBody, setSupportBody] = useState("");
  const [supportReply, setSupportReply] = useState("");
  const [supportHint, setSupportHint] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [bootLoading, setBootLoading] = useState(true);
  const [catalogSkus, setCatalogSkus] = useState<CatalogSku[]>([]);
  const [factoryRequests, setFactoryRequests] = useState<FactoryOrderRequest[] | null>(null);
  const factoryPrefillRef = useRef(false);

  const reload = async () => {
    const tasks: Array<{ key: string; run: () => Promise<unknown> }> = [
      { key: "me", run: () => api<Me>("/api/v1/me") },
      { key: "calculations", run: () => api<Calc[]>("/api/v1/calculations") },
      { key: "brokers", run: () => api<Broker[]>("/api/v1/brokers") },
      ...(shippingOn
        ? [{ key: "shipping", run: () => api<ShipRow[]>("/api/v1/shipping") }]
        : []),
      ...(factoryOn
        ? [{ key: "factory", run: () => api<FactoryOrderRequest[]>("/api/v1/factory/requests") }]
        : []),
      { key: "tariffs", run: () => api<TariffOption[]>("/api/v1/tariffs") },
      { key: "support", run: () => api<SupportThread[]>(`/api/v1/chat?scope=support&box=${supportBox}`) },
      { key: "unread", run: () => api<{ count: number }>("/api/v1/chat?scope=unread") },
    ];
    const settled = await Promise.allSettled(tasks.map((t) => t.run()));
    const failures: string[] = [];
    settled.forEach((result, i) => {
      const key = tasks[i].key;
      if (result.status === "rejected") {
        failures.push(`${key}: ${result.reason instanceof Error ? result.reason.message : "error"}`);
        if (key === "factory") setFactoryRequests([]);
        return;
      }
      const value = result.value;
      if (key === "me") {
        const m = value as Me;
        setMe(m);
        if (m.company) {
          setProfile({
            name: m.company.name || "",
            inn: m.company.inn || "",
            kpp: (m.company as { kpp?: string | null }).kpp || "",
            legalAddress: m.company.legalAddress || "",
            contactEmail: m.company.contactEmail || "",
            contactPhone: m.company.contactPhone || "",
            clientSegment: (m.company.clientSegment as ClientSegment) || "SINGLE",
          });
        }
      } else if (key === "calculations") setCalcs(value as Calc[]);
      else if (key === "brokers") setBrokers(value as Broker[]);
      else if (key === "shipping") setShipping(value as ShipRow[]);
      else if (key === "tariffs") setTariffs(value as TariffOption[]);
      else if (key === "support") setSupportThreads(value as SupportThread[]);
      else if (key === "unread") setUnreadCount((value as { count: number }).count ?? 0);
      else if (key === "factory") setFactoryRequests(value as FactoryOrderRequest[]);
    });
    // Support/unread optional for cabinets that fail chat scope; don't hard-fail reload.
    const hard = failures.filter(
      (f) => !f.startsWith("support:") && !f.startsWith("unread:") && !f.startsWith("factory:")
    );
    if (hard.length) {
      setError(hard.join("; "));
    } else {
      setError("");
    }
  };

  const bootReload = async () => {
    try {
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBootLoading(false);
    }
  };

  const retryBoot = () => {
    setError("");
    setBootLoading(true);
    void bootReload();
  };

  useEffect(() => {
    void bootReload();
  }, []);

  useEffect(() => {
    if (pane !== "dashboard" && pane !== "orders" && pane !== "factory") return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      reload().catch(() => undefined);
    }, 45_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- soft poll like broker
  }, [pane]);

  const loadQuotes = async () => {
    const q = await api<Quote[]>(
      `/api/v1/shipping?quotes=1&origin=${encodeURIComponent(shipForm.origin)}&destination=${encodeURIComponent(shipForm.destination)}&mode=${shipForm.mode}`
    );
    setQuotes(q);
    const sel = q.find((x) => x.selected) || q[0];
    setSelectedQuoteId(sel?.id || "");
  };

  useEffect(() => {
    if (!shippingOn && paneRaw === "shipping") {
      router.replace(cabinetHome);
    }
    if (!factoryOn && paneRaw === "factory") {
      router.replace(cabinetHome);
    }
  }, [paneRaw, shippingOn, factoryOn, router, cabinetHome]);

  useEffect(() => {
    if (!shippingOn || pane !== "shipping") return;
    loadQuotes().catch((e) => {
      setQuotes([]);
      setError(e instanceof Error ? e.message : "Не удалось загрузить котировки");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane, shipForm.origin, shipForm.destination, shipForm.mode, shippingOn]);

  const uploadFile = async (file: File) => {
    const compressed = await compressImageForUpload(file);
    const fd = new FormData();
    fd.append("file", compressed);
    const res = await fetch("/api/v1/uploads", { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok) throw new Error(data.error || "Upload failed");
    if (!data.url) throw new Error("Upload failed");
    return { url: data.url };
  };

  const createCalc = async (override?: {
    items?: FormItem[];
    form?: Partial<CalcForm>;
  }) => {
    setBusy(true);
    setCreatePhase("creating");
    setError("");
    try {
      const f = { ...form, ...override?.form };
      const sourceItems = override?.items ?? items;
      const payloadItems = sourceItems
        .filter((it) => it.name.trim() || it.manufacturerSkuId)
        .map((it) => {
          const attrs: Record<string, string | number> = {};
          if (it.attrs?.brand?.trim()) attrs.brand = it.attrs.brand.trim();
          if (it.attrs?.material?.trim()) attrs.material = it.attrs.material.trim();
          if (it.attrs?.composition?.trim()) attrs.composition = it.attrs.composition.trim();
          if (it.attrs?.purpose?.trim()) attrs.purpose = it.attrs.purpose.trim();
          if (it.attrs?.manufacturerName?.trim()) {
            attrs.manufacturerName = it.attrs.manufacturerName.trim();
          }
          if (it.attrs?.originCountry?.trim().length === 2) {
            attrs.originCountry = it.attrs.originCountry.trim().toUpperCase();
          }
          if (it.attrs?.hsHint?.trim()) attrs.hsHint = it.attrs.hsHint.trim();
          const w = Number(it.attrs?.netWeightKg);
          if (Number.isFinite(w) && w >= 0 && it.attrs?.netWeightKg !== "") attrs.netWeightKg = w;
          return {
            name: it.name.trim(),
            description: f.description || it.name.trim(),
            qty: it.qty,
            unitPrice: it.unitPrice,
            mediaUrl: it.mediaUrl,
            manufacturerSkuId: it.manufacturerSkuId || undefined,
            ...(Object.keys(attrs).length ? { attrs } : {}),
          };
        });
      if (!payloadItems.length) throw new Error("Добавьте хотя бы одну позицию");
      if (override?.items) setItems(override.items);
      if (override?.form) setForm((prev) => ({ ...prev, ...override.form }));
      const invoice = parseShipmentInvoice(f.shipmentValue, f.shipmentCurrency);
      let calc = await api<Calc>("/api/v1/calculations", {
        method: "POST",
        body: JSON.stringify({
          title: f.title,
          description: f.description,
          country: f.country,
          shipmentValue: formatShipmentInvoice(invoice.amount, invoice.currency),
          shipmentCurrency: invoice.currency,
          tariffCode: f.tariffCode,
          preferredBrokerUserId: f.preferredBrokerUserId || undefined,
          items: payloadItems,
        }),
      });
      setSelected(calc);
      if (isAiDrainPending(calc)) {
        setCreatePhase("enriching");
        toast(`Создано ${calc.number}. Уточняем ТН ВЭД…`, { variant: "ok" });
        calc = await waitForAiEnrich(calc, (id) => api<Calc>(`/api/v1/calculations/${id}`));
        setSelected(calc);
      }
      setPreferredBrokerUserId(calc.preferredBrokerUserId || f.preferredBrokerUserId || "");
      if (isAiDrainPending(calc)) {
        toast(
          `${calc.number}: предварительный код готов, уточнение продолжается в фоне`,
          { variant: "ok" }
        );
      } else {
        toast(`Готово ${calc.number}`, { variant: "ok" });
      }
      const requestId = search.get("request");
      if (requestId && calc.id) {
        await api(`/api/v1/factory/requests/${requestId}/link-calc`, {
          method: "POST",
          body: JSON.stringify({ calculationId: calc.id }),
        }).catch(() => undefined);
      }
      await reload();
      deepOpenedRef.current = calc.id;
      await openCalc(calc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      toast(e instanceof Error ? e.message : "Ошибка создания", { variant: "error" });
    } finally {
      setBusy(false);
      setCreatePhase("idle");
    }
  };

  const quickCreate = async (payload: {
    title: string;
    description: string;
    country: string;
    shipmentValue: string;
    shipmentCurrency?: string;
    mediaUrl?: string;
    attrs?: {
      originCountry: string;
      manufacturerName: string;
      composition: string;
    };
  }) => {
    setBusy(true);
    setCreatePhase("creating");
    setError("");
    try {
      const invoice = parseShipmentInvoice(payload.shipmentValue, payload.shipmentCurrency);
      const stored = formatShipmentInvoice(invoice.amount, invoice.currency);
      let calc = await api<Calc>("/api/v1/calculations", {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          description: payload.description,
          country: payload.country,
          shipmentValue: stored,
          shipmentCurrency: invoice.currency,
          tariffCode: form.tariffCode || "STANDARD",
          preferredBrokerUserId: form.preferredBrokerUserId || preferredBrokerUserId || undefined,
          items: [
            {
              name: payload.title,
              description: payload.description,
              qty: 1,
              unitPrice: invoice.amount,
              mediaUrl: payload.mediaUrl,
              ...(payload.attrs ? { attrs: payload.attrs } : {}),
            },
          ],
        }),
      });
      setSelected(calc);
      if (isAiDrainPending(calc)) {
        setCreatePhase("enriching");
        toast(`Создано ${calc.number}. Уточняем ТН ВЭД…`, { variant: "ok" });
        calc = await waitForAiEnrich(calc, (id) => api<Calc>(`/api/v1/calculations/${id}`));
        setSelected(calc);
      }
      setForm((f) => ({
        ...f,
        title: payload.title,
        description: payload.description,
        country: payload.country,
        shipmentValue: String(invoice.amount),
        shipmentCurrency: invoice.currency,
      }));
      if (isAiDrainPending(calc)) {
        toast(
          `${calc.number}: предварительный код готов, уточнение продолжается в фоне`,
          { variant: "ok" }
        );
      } else {
        toast(`Готово ${calc.number}`, { variant: "ok" });
      }
      await reload();
      deepOpenedRef.current = calc.id;
      await openCalc(calc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      toast(e instanceof Error ? e.message : "Ошибка создания", { variant: "error" });
    } finally {
      setBusy(false);
      setCreatePhase("idle");
    }
  };

  useEffect(() => {
    if (!selected?.id || !isAiDrainPending(selected)) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const full = await api<Calc>(`/api/v1/calculations/${selected.id}`);
        if (!cancelled) {
          setSelected(full);
          setCalcs((prev) => prev.map((c) => (c.id === full.id ? { ...c, ...full } : c)));
        }
      } catch {
        /* keep last snapshot */
      }
    };
    const t = setInterval(() => void tick(), 2500);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [selected?.id, selected?.aiDrainPending, selected?.aiDraft?.llmEnrichPending]);

  const loadChat = async (calculationId: string) => {
    const thread = await api<{
      messages?: ChatMsg[];
      waitingOn?: "CLIENT" | "BROKER" | null;
    } | null>(`/api/v1/chat?calculationId=${calculationId}`);
    setChat(thread?.messages || []);
    setWaitingOn(thread?.waitingOn ?? null);
    try {
      const unread = await api<{ count: number }>("/api/v1/chat?scope=unread");
      setUnreadCount(unread.count ?? 0);
    } catch {
      /* optional */
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("topup") === "1" || q.get("intentId")) {
      setPendingTopupHint("Вернулись из оплаты. Обновите баланс, если webhook ещё не пришёл.");
      reload().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!selected?.id || !["IN_REVIEW", "DONE", "QUEUED", "SLA_RISK"].includes(selected.status)) {
      return;
    }
    const t = setInterval(() => {
      loadChat(selected.id).catch(() => undefined);
    }, 12000);
    return () => clearInterval(t);
  }, [selected?.id, selected?.status]);

  const openCalc = async (c: Calc, opts?: { syncUrl?: boolean }) => {
    setError("");
    try {
      const full = await api<Calc>(`/api/v1/calculations/${c.id}`);
      setSelected(full);
      setPreferredBrokerUserId(full.preferredBrokerUserId || form.preferredBrokerUserId || "");
      if (opts?.syncUrl !== false) {
        deepOpenedRef.current = full.id;
        router.replace(`${path("/orders")}?id=${encodeURIComponent(full.id)}`, { scroll: false });
      }
      if (["IN_REVIEW", "DONE", "QUEUED", "SLA_RISK"].includes(full.status)) {
        try {
          await loadChat(full.id);
        } catch (e) {
          setChat([]);
          setWaitingOn(null);
          setError(e instanceof Error ? e.message : "Не удалось загрузить чат");
        }
      } else {
        setChat([]);
        setWaitingOn(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Нет доступа к заявке");
    }
  };

  const closeCalc = () => {
    setSelected(null);
    setChat([]);
    setWaitingOn(null);
    deepOpenedRef.current = null;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("id")) {
      router.replace(path(pane === "dashboard" ? "" : "/orders"), { scroll: false });
    }
  };

  /** Deep-link: /cabinet/orders?id=<calcId> opens detail + chat. */
  useEffect(() => {
    if (!calcs.length) return;
    if (pane !== "orders" && pane !== "dashboard") return;
    if (typeof window === "undefined") return;
    const deepCalcId = new URLSearchParams(window.location.search).get("id");
    if (!deepCalcId) return;
    if (selected?.id === deepCalcId || deepOpenedRef.current === deepCalcId) return;
    const found = calcs.find((c) => c.id === deepCalcId);
    if (!found) return;
    deepOpenedRef.current = deepCalcId;
    void openCalc(found, { syncUrl: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcs, pane]);

  const pay = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const prev = calcs.find((c) => c.id === id);
      const price = prev?.tariff?.priceRub ?? 0;
      const calc = await api<Calc>(`/api/v1/calculations/${id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          preferredBrokerUserId: preferredBrokerUserId || form.preferredBrokerUserId || null,
        }),
      });
      // Hide Pay immediately — full list reload can be slow (large pdfHtml payloads).
      setSelected(calc);
      setCalcs((list) => list.map((c) => (c.id === calc.id ? { ...c, ...calc } : c)));
      if (price > 0) {
        setMe((m) =>
          m?.company
            ? {
                ...m,
                company: {
                  ...m.company,
                  balanceRub: Math.max(0, (m.company.balanceRub ?? 0) - price),
                },
              }
            : m
        );
      }
      toast("Тариф оплачен", { variant: "ok" });
      // Refresh in background; optimistic patch already removed the Pay CTA.
      void reload().catch(() => undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка оплаты";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const submitFeedback = async (
    id: string,
    reaction: ClientFeedbackReaction,
    comment?: string
  ) => {
    setBusy(true);
    setError("");
    try {
      const calc = await api<Calc>(`/api/v1/calculations/${id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ reaction, comment }),
      });
      setSelected(calc);
      setCalcs((list) => list.map((c) => (c.id === calc.id ? { ...c, ...calc } : c)));
      toast("Спасибо — ваш отклик учтён", { variant: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось отправить отклик";
      setError(msg);
      toast(msg, { variant: "error" });
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const topupThenPay = async (id: string, price: number) => {
    const balance = me?.company?.balanceRub ?? 0;
    const need = Math.max(0, price - balance);
    setBusy(true);
    try {
      if (need > 0) {
        await api("/api/v1/company/topup", {
          method: "POST",
          body: JSON.stringify({ amountRub: need, method: topupMethod }),
        });
        await reload();
      }
      await pay(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  };

  const sendChat = async (attachmentUrl?: string) => {
    if (!selected) return;
    const body = chatMsg.trim() || (attachmentUrl ? "Вложение" : "");
    if (!body && !attachmentUrl) return;
    await api("/api/v1/chat", {
      method: "POST",
      body: JSON.stringify({ calculationId: selected.id, body, attachmentUrl }),
    });
    setChatMsg("");
    await loadChat(selected.id);
  };

  const doTopup = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        pending?: boolean;
        confirmUrl?: string | null;
        provider?: string;
        intentId?: string | null;
      }>("/api/v1/company/topup", {
        method: "POST",
        body: JSON.stringify({ amountRub: topup, method: topupMethod }),
      });
      if (result.pending && result.confirmUrl) {
        window.open(result.confirmUrl, "_blank", "noopener,noreferrer");
        setPendingTopupHint(
          `Ожидаем оплату (${result.provider || "yookassa"}). После подтверждения нажмите «Обновить баланс».`
        );
        setError("");
        toast("Откройте окно оплаты", { variant: "info" });
      } else {
        setPendingTopupHint("");
        toast("Баланс пополнен", { variant: "ok" });
      }
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      await api("/api/v1/company", { method: "PATCH", body: JSON.stringify(profile) });
      await reload();
      toast("Профиль сохранён", { variant: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const loadSupport = async (box: "active" | "archive") => {
    const threads = await api<SupportThread[]>(`/api/v1/chat?scope=support&box=${box}`);
    setSupportThreads(threads);
  };

  const refreshUnread = async () => {
    try {
      const unread = await api<{ count: number }>("/api/v1/chat?scope=unread");
      setUnreadCount(unread.count ?? 0);
    } catch {
      /* optional */
    }
  };

  const openSupportThread = async (threadId: string, opts?: { syncUrl?: boolean }) => {
    try {
      const full = await api<SupportThread>(`/api/v1/chat?threadId=${encodeURIComponent(threadId)}`);
      const archived = full.ticketStatus === "RESOLVED" || full.ticketStatus === "ARCHIVED";
      setSupportBox(archived ? "archive" : "active");
      setSupportSelected(full);
      setSupportReply("");
      if (opts?.syncUrl !== false) {
        router.replace(`${path("/support")}?threadId=${encodeURIComponent(threadId)}`, { scroll: false });
      }
      await refreshUnread();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось открыть обращение", { variant: "error" });
    }
  };

  const submitSupportStatus = async (action: SupportTicketAction) => {
    if (!supportSelected) return;
    setBusy(true);
    try {
      await api("/api/v1/chat", {
        method: "POST",
        body: JSON.stringify({
          kind: "SUPPORT_STATUS",
          threadId: supportSelected.id,
          action,
        }),
      });
      toast(action === "resolve" ? "Обращение закрыто" : "Обращение открыто снова", { variant: "ok" });
      const nextBox = action === "reopen" ? "active" : "archive";
      setSupportBox(nextBox);
      await loadSupport(nextBox);
      await openSupportThread(supportSelected.id, { syncUrl: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const sendSupportReply = async () => {
    if (!supportSelected || !supportReply.trim()) return;
    setBusy(true);
    try {
      await api("/api/v1/chat", {
        method: "POST",
        body: JSON.stringify({
          kind: "SUPPORT_REPLY",
          threadId: supportSelected.id,
          body: supportReply.trim(),
        }),
      });
      setSupportReply("");
      toast("Сообщение отправлено", { variant: "ok" });
      await openSupportThread(supportSelected.id);
      await loadSupport(supportBox);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось отправить", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const submitSupport = async () => {
    setBusy(true);
    setSupportHint("");
    try {
      const created = await api<{ thread: { id: string } }>("/api/v1/chat", {
        method: "POST",
        body: JSON.stringify({
          kind: "SUPPORT",
          subject: supportSubject.trim(),
          body: supportBody.trim(),
        }),
      });
      setSupportSubject("");
      setSupportBody("");
      setSupportHint("Обращение отправлено. Мы ответим в этом разделе.");
      toast("Обращение отправлено", { variant: "ok" });
      setSupportBox("active");
      await loadSupport("active");
      if (created.thread?.id) {
        await openSupportThread(created.thread.id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!factoryOn || (pane !== "new" && pane !== "factory")) return;
    api<CatalogSku[]>("/api/v1/catalog/skus")
      .then(setCatalogSkus)
      .catch(() => setCatalogSkus([]));
  }, [pane, factoryOn]);

  useEffect(() => {
    if (!factoryOn || pane !== "new" || factoryPrefillRef.current || !catalogSkus.length) return;
    const skuId = search.get("sku");
    if (!skuId) return;
    const sku = catalogSkus.find((s) => s.id === skuId);
    if (!sku) return;
    const qty = Math.max(1, Number(search.get("qty")) || 1);
    factoryPrefillRef.current = true;
    setItems([formItemFromCatalogSku(sku, qty)]);
    setForm((f) => ({
      ...f,
      title: f.title.trim() || sku.name,
      description: f.description.trim() || `${sku.name} · qty ${qty}`,
    }));
  }, [pane, catalogSkus, search, factoryOn]);

  useEffect(() => {
    if (pane !== "support" || typeof window === "undefined") return;
    const threadId = new URLSearchParams(window.location.search).get("threadId");
    if (threadId && threadId !== supportSelected?.id) {
      void openSupportThread(threadId, { syncUrl: false });
    }
  }, [pane]);

  const createShip = async () => {
    setBusy(true);
    try {
      await api("/api/v1/shipping", {
        method: "POST",
        body: JSON.stringify({
          ...shipForm,
          calculationId: shipForm.calculationId,
          selectedQuoteId: selectedQuoteId || undefined,
        }),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const selectBroker = (userId: string) => {
    setForm((f) => ({ ...f, preferredBrokerUserId: userId }));
    setPreferredBrokerUserId(userId);
  };

  const meta = PAGE_META[pane] || PAGE_META.dashboard;
  const factoryBadge = factoryOn ? factoryNavBadge(factoryRequests || []) : 0;
  const navWithBadge = nav.map((item) => {
    if (item.label === "Поддержка" || item.label.startsWith("Заявки")) {
      return { ...item, badge: unreadCount || null };
    }
    if (factoryOn && item.label === "Производитель") {
      return { ...item, badge: factoryBadge || null };
    }
    return item;
  });

  return (
    <LbmCabinetsShell
      variant="client"
      brand="Кабинет"
      subtitle={`Клиент · ${me?.company?.name || "…"}`}
      nav={navWithBadge}
      title={meta.title}
      lead={meta.lead}
      avatarUrl="/cabinets/assets/avatar-user.jpg"
      userLabel={me?.name}
      userMeta={me?.company?.name}
      hideHeaderTitle={pane === "dashboard"}
      balanceRub={me?.company?.balanceRub ?? 0}
      balanceHref={path("/balance")}
      actions={
        <Link
          href={path("/new")}
          className="btn btn-primary btn-sm"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Новый просчёт
        </Link>
      }
    >
      {error && me && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-800"
            onClick={retryBoot}
          >
            Обновить
          </button>
        </div>
      )}

      {bootLoading ? (
        <VedEmptyState
          title="Загрузка кабинета…"
          hint="Подтягиваем заявки, баланс и тарифы."
        />
      ) : error && !me ? (
        <VedEmptyState
          title="Не удалось загрузить кабинет"
          hint={error}
          actionLabel="Обновить"
          onAction={retryBoot}
        />
      ) : (
        <>
      {(pane === "dashboard" || pane === "orders") && (
        <>
          {pane === "dashboard" ? (
            <ClientSuperappHome
              path={path}
              calcs={calcs}
              unreadCount={unreadCount}
              showShipping={shippingOn}
              showFactory={factoryOn}
              factoryHref={factoryOn ? path("/factory") : undefined}
            />
          ) : (
          <DashboardPane
            pane={pane}
            me={me}
            calcs={calcs}
            shipping={shipping}
            showShipping={shippingOn}
            busy={busy}
            unreadCount={unreadCount}
            factoryActiveCount={factoryOn ? factoryBadge : 0}
            factoryHref={factoryOn ? path("/factory") : undefined}
            selectedId={selected?.id}
            createHref={navBase.replace(/\/$/, "") ? `${navBase.replace(/\/$/, "")}/new` : "/new"}
            onOpen={openCalc}
            onQuickCreate={quickCreate}
            onUploadQuick={async (file) => {
              try {
                setCreatePhase("uploading");
                const { url } = await uploadFile(file);
                return url;
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Upload error";
                setError(msg);
                toast(msg, { variant: "error" });
                throw err;
              } finally {
                setCreatePhase("idle");
              }
            }}
            onPay={(c) => {
              const price = c.tariff?.priceRub ?? 0;
              const bal = me?.company?.balanceRub ?? 0;
              if (price > bal) {
                const msg = `Недостаточно баланса: нужно ${price.toLocaleString("ru-RU")} ₽`;
                setError(msg);
                toast(msg, { variant: "error" });
                return;
              }
              void pay(c.id);
            }}
            onTopupThenPay={(c) => {
              void topupThenPay(c.id, c.tariff?.priceRub ?? 0);
            }}
          />
          )}
          {selected && (pane === "orders" || pane === "dashboard") && (
            <OrderDetailDrawer
              open
              title={`${selected.number} · ${selected.title}`}
              onClose={closeCalc}
            >
              <OrderDetail
                selected={selected}
                brokers={brokers}
                me={me}
                preferredBrokerUserId={preferredBrokerUserId}
                busy={busy}
                embedded
                onPreferred={setPreferredBrokerUserId}
                onPay={() => pay(selected.id)}
                onTopupThenPay={() => topupThenPay(selected.id, selected.tariff?.priceRub ?? 0)}
                onFeedback={(reaction, comment) => submitFeedback(selected.id, reaction, comment)}
              >
                <OrderChat
                  selected={selected}
                  chat={chat}
                  waitingOn={waitingOn}
                  chatMsg={chatMsg}
                  busy={busy}
                  onChatMsg={setChatMsg}
                  onSend={sendChat}
                />
              </OrderDetail>
            </OrderDetailDrawer>
          )}
        </>
      )}

      {pane === "new" && (
        <NewCalcPane
          form={form}
          items={items}
          brokers={brokers}
          tariffs={tariffs}
          catalogSkus={factoryOn ? catalogSkus : []}
          busy={busy}
          createPhase={createPhase}
          selected={selected}
          ordersHref={path("/orders")}
          onForm={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onItems={setItems}
          onCreate={createCalc}
          onUpload={async (file, index) => {
            try {
              setCreatePhase("uploading");
              const { url } = await uploadFile(file);
              setItems((prev) => {
                const next = [...prev];
                next[index] = {
                  ...next[index],
                  mediaUrl: url,
                  name: next[index].name || file.name.replace(/\.[^.]+$/, ""),
                };
                return next;
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Upload error");
            } finally {
              setCreatePhase("idle");
            }
          }}
        />
      )}

      {factoryOn && pane === "factory" && (
        <FactoryPane
          catalogSkus={catalogSkus}
          segment={profile.clientSegment || "SINGLE"}
          requests={factoryRequests}
          newCalcHref={({ skuId, qty, requestId }) => {
            const q = new URLSearchParams({ sku: skuId, qty: String(qty) });
            if (requestId) q.set("request", requestId);
            return `${path("/new")}?${q.toString()}`;
          }}
          onChanged={() => reload()}
        />
      )}

      {pane === "brokers" && (
        <BrokersPane
          brokers={brokers}
          selectedId={form.preferredBrokerUserId || preferredBrokerUserId}
          onSelect={selectBroker}
        />
      )}

      {shippingOn && pane === "shipping" && (
        <ShippingPane
          calcs={calcs}
          shipping={shipping}
          quotes={quotes}
          shipForm={shipForm}
          selectedQuoteId={selectedQuoteId}
          busy={busy}
          onShipForm={(patch) => setShipForm((f) => ({ ...f, ...patch }))}
          onQuote={(id, mode) => {
            setSelectedQuoteId(id);
            setShipForm((f) => ({ ...f, mode }));
          }}
          onCreate={createShip}
        />
      )}

      {pane === "balance" && (
        <BalancePane
          me={me}
          topup={topup}
          topupMethod={topupMethod}
          busy={busy}
          pendingHint={pendingTopupHint}
          onTopupAmount={setTopup}
          onTopupMethod={setTopupMethod}
          onTopup={doTopup}
          onRefresh={() => {
            setPendingTopupHint("");
            reload().catch(() => undefined);
          }}
        />
      )}

      {(pane === "profile") && (
        <CompanySettingsPane
          profile={profile}
          busy={busy}
          onChange={setProfile}
          onSave={saveProfile}
        />
      )}

      {pane === "support" && (
        <SupportPane
          threads={supportThreads}
          calcsWithChat={calcs.filter((c) =>
            ["IN_REVIEW", "DONE", "SLA_RISK", "QUEUED"].includes(c.status)
          )}
          orderHrefFor={(id) => `${path("/orders")}?id=${encodeURIComponent(id)}`}
          box={supportBox}
          onBox={(next) => {
            setSupportBox(next);
            setSupportSelected(null);
            setSupportReply("");
            router.replace(path("/support"), { scroll: false });
            loadSupport(next).catch((e) =>
              toast(e instanceof Error ? e.message : "Не удалось загрузить обращения", { variant: "error" })
            );
          }}
          selected={supportSelected}
          subject={supportSubject}
          body={supportBody}
          reply={supportReply}
          busy={busy}
          sentHint={supportHint}
          onSubject={setSupportSubject}
          onBody={setSupportBody}
          onReply={setSupportReply}
          onSubmit={submitSupport}
          onSendReply={() => void sendSupportReply()}
          onOpenThread={(id) => void openSupportThread(id)}
          onBackToList={() => {
            setSupportSelected(null);
            setSupportReply("");
            router.replace(path("/support"), { scroll: false });
          }}
          onStatus={(action) => void submitSupportStatus(action)}
        />
      )}
        </>
      )}
    </LbmCabinetsShell>
  );
}
