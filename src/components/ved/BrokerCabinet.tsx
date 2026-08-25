"use client";

/**
 * Broker cabinet (product branch 2): queue/claim, mapping table + prices,
 * approve → PDF, chat on work card. Preferred-broker queue badges.
 * Panes live in ./broker/* (Phase 3). See docs/knowledge/branches.md and ADR D15–D16.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { StatusPill, VedEmptyState, api } from "./VedShell";
import { LbmCabinetsShell } from "./LbmCabinetsShell";
import { VedDetailDrawer } from "./VedDetailDrawer";
import { useVedToast } from "./feedback/VedToast";
import { QueuePane } from "./broker/QueuePane";
import { WorkMapping } from "./broker/WorkMapping";
import { WorkChat } from "./broker/WorkChat";
import { ChatThreadsPane, type ChatThreadRow } from "./broker/ChatThreadsPane";
import { PayoutsPane } from "./broker/PayoutsPane";
import { SlaStatsPane } from "./broker/SlaStatsPane";
import { analyzeBrokerDossier } from "@/lib/ved/broker-dossier";
import {
  brokerPane,
  formatBrokerSideFoot,
  getBrokerNav,
  hydrateMapRows,
  type BrokerProfileForm,
  type Calc,
  type ChatMsg,
  type MapRow,
  type PayoutRow,
} from "./broker/types";

const BROKER_META: Record<string, { title: string; lead: string }> = {
  dashboard: { title: "Дашборд брокера", lead: "Очередь оплаченных заявок · правка AI · отправка клиенту" },
  queue: { title: "Очередь", lead: "Оплаченные заявки, доступные к claim" },
  work: { title: "В работе", lead: "Маппинг HS / пошлины / НДС и approve" },
  chat: { title: "Чат", lead: "Переписка с клиентом по заявке" },
  sla: { title: "SLA / статистика", lead: "Риски и качество правок AI" },
  payouts: { title: "Выплаты", lead: "Начисления по доле тарифа" },
  profile: { title: "Профиль", lead: "Специализация и приём заявок" },
};

export function BrokerCabinet() {
  const pathname = usePathname() || "/broker";
  const router = useRouter();
  const pane = brokerPane(pathname);
  const navBase = process.env.NEXT_PUBLIC_BROKER_BASE ?? "/broker";
  const path = (suffix: string) => {
    const b = navBase.replace(/\/$/, "");
    return b ? `${b}${suffix}` : suffix || "/";
  };
  const { toast } = useVedToast();
  const deepOpenedRef = useRef<string | null>(null);
  const [queue, setQueue] = useState<Calc[]>([]);
  const [mine, setMine] = useState<Calc[]>([]);
  const [selected, setSelected] = useState<Calc | null>(null);
  const [hsEdit, setHsEdit] = useState("");
  const [feeEdit, setFeeEdit] = useState(0);
  const [extraFeeEdit, setExtraFeeEdit] = useState(0);
  const [extraFeeNote, setExtraFeeNote] = useState("");
  const [mapRows, setMapRows] = useState<MapRow[]>([]);
  const [comment, setComment] = useState("");
  const [reclassifyNote, setReclassifyNote] = useState("");
  const [chatThreads, setChatThreads] = useState<ChatThreadRow[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [waitingOn, setWaitingOn] = useState<"CLIENT" | "BROKER" | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [profile, setProfile] = useState<BrokerProfileForm>({
    specialization: "",
    languages: "",
    about: "",
    acceptingJobs: true,
  });
  const [preferredClaimHours, setPreferredClaimHours] = useState(4);
  const [llmReclassifyEnabled, setLlmReclassifyEnabled] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [meId, setMeId] = useState("");
  const [meName, setMeName] = useState("");
  const [chatUnread, setChatUnread] = useState(0);
  const [bootLoading, setBootLoading] = useState(true);

  const reload = async () => {
    const [q, m, p, me, settings, unread] = await Promise.all([
      api<Calc[]>("/api/v1/calculations?scope=queue"),
      api<Calc[]>("/api/v1/calculations?scope=mine"),
      api<PayoutRow[]>("/api/v1/payouts"),
      api<{
        id?: string;
        name?: string | null;
        brokerProfile?: BrokerProfileForm & {
          specialization?: string;
          languages?: string;
          about?: string;
          acceptingJobs?: boolean;
          rating?: number;
          closedPerWeek?: number;
        };
      }>("/api/v1/me"),
      api<{
        preferredClaimHours?: number;
        llmEnrichEnabled?: boolean;
        confidenceThreshold?: number;
      }>("/api/v1/platform/settings"),
      api<{ count?: number }>("/api/v1/chat?scope=unread").catch(() => ({ count: 0 })),
    ]);
    setQueue(q);
    setMine(m);
    setPayouts(p);
    setChatUnread(unread.count ?? 0);
    if (me.id) setMeId(me.id);
    if (me.name) setMeName(me.name);
    if (me.brokerProfile) {
      setProfile({
        specialization: me.brokerProfile.specialization || "",
        languages: me.brokerProfile.languages || "",
        about: me.brokerProfile.about || "",
        acceptingJobs: me.brokerProfile.acceptingJobs ?? true,
        rating: me.brokerProfile.rating,
        closedPerWeek: me.brokerProfile.closedPerWeek,
      });
    }
    if (settings.preferredClaimHours != null) {
      setPreferredClaimHours(settings.preferredClaimHours);
    }
    if (settings.llmEnrichEnabled != null) {
      setLlmReclassifyEnabled(settings.llmEnrichEnabled);
    }
    if (settings.confidenceThreshold != null) {
      setConfidenceThreshold(settings.confidenceThreshold);
    }
  };

  useEffect(() => {
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setBootLoading(false));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      reload().catch(() => undefined);
      if (pane === "chat") loadChatThreads().catch(() => undefined);
      if (selected?.id) loadChat(selected.id).catch(() => undefined);
    }, 45_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- soft poll; pane/selected read from closure
  }, [pane, selected?.id]);

  useEffect(() => {
    if (pane === "chat") {
      loadChatThreads().catch((e) => setError(e.message));
    }
  }, [pane, mine.length]);

  const hydrateMap = (calc: Calc) => {
    setHsEdit(calc.hsCodeFinal || calc.hsCode || "");
    setFeeEdit(calc.feeRub ?? 0);
    setExtraFeeEdit(calc.extraFeeRub ?? 0);
    setExtraFeeNote(calc.extraFeeNote ?? "");
    setMapRows(hydrateMapRows(calc));
  };

  const claim = async (id: string) => {
    setBusy(true);
    try {
      const calc = await api<Calc>(`/api/v1/calculations/${id}/claim`, { method: "POST" });
      const full = await api<Calc>(`/api/v1/calculations/${calc.id}`);
      setSelected(full);
      hydrateMap(full);
      setQueue((q) => q.filter((x) => x.id !== id));
      setMine((m) => [full, ...m.filter((x) => x.id !== id)]);
      deepOpenedRef.current = full.id;
      router.replace(`${path("/work")}?id=${encodeURIComponent(full.id)}`, { scroll: false });
      void reload().catch(() => undefined);
      void loadChat(full.id).catch(() => undefined);
      setError("");
      toast("Заявка взята в работу", { variant: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      if (/claim conflict|Cannot claim|preferred/i.test(msg)) {
        const friendly = /preferred/i.test(msg)
          ? "Заявка зарезервирована за другим брокером. Очередь обновлена."
          : "Заявку уже взял другой брокер. Очередь обновлена.";
        setError(friendly);
        toast(friendly, { variant: "error" });
        await reload().catch(() => undefined);
        setSelected(null);
      } else {
        setError(msg);
        toast(msg, { variant: "error" });
      }
    } finally {
      setBusy(false);
    }
  };

  const itemsPayload = () =>
    mapRows.map((r) => ({
      id: r.id,
      hsCodeFinal: r.hsCodeFinal,
      dutyRub: r.dutyRub,
      vatRub: r.vatRub,
      unitPrice: r.unitPrice,
      description: r.description,
      attrs: r.attrs || undefined,
    }));

  const saveDraft = async () => {
    if (!selected || mapRows.length === 0) return;
    if (extraFeeEdit > 0 && !extraFeeNote.trim()) {
      const msg = "Укажите, за что прочие сборы";
      setError(msg);
      toast(msg, { variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const calc = await api<Calc>(`/api/v1/calculations/${selected.id}/items`, {
        method: "PATCH",
        body: JSON.stringify({
          hsCodeFinal: hsEdit,
          feeRub: feeEdit,
          extraFeeRub: extraFeeEdit,
          extraFeeNote: extraFeeNote,
          items: itemsPayload(),
        }),
      });
      setSelected(calc);
      hydrateMap(calc);
      toast("Черновик сохранён", { variant: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!selected || mapRows.length === 0) return;
    const dossier = analyzeBrokerDossier({
      confidence: selected.confidence,
      hsCode: hsEdit || selected.hsCodeFinal || selected.hsCode,
      items: selected.items,
      confidenceThreshold,
    });
    if (dossier.needsComment && !comment.trim()) {
      const msg = "Данных мало — укажите комментарий перед PDF (оговорка для клиента)";
      setError(msg);
      toast(msg, { variant: "error" });
      return;
    }
    if (extraFeeEdit > 0 && !extraFeeNote.trim()) {
      const msg = "Укажите, за что прочие сборы";
      setError(msg);
      toast(msg, { variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const calc = await api<Calc>(`/api/v1/calculations/${selected.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          hsCodeFinal: hsEdit,
          comment,
          feeRub: feeEdit,
          extraFeeRub: extraFeeEdit,
          extraFeeNote: extraFeeNote,
          dutyRub: mapRows.reduce((s, r) => s + r.dutyRub, 0),
          vatRub: mapRows.reduce((s, r) => s + r.vatRub, 0),
          items: itemsPayload(),
        }),
      });
      const full = await api<Calc>(`/api/v1/calculations/${calc.id || selected.id}`);
      setSelected(full);
      hydrateMap(full);
      setMine((m) => m.map((x) => (x.id === full.id ? { ...x, ...full } : x)));
      void reload().catch(() => undefined);
      toast(
        dossier.thin
          ? "Заявка утверждена · PDF с оговоркой по неполным данным"
          : "Заявка утверждена · PDF готов",
        { variant: "ok" }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const escalate = async () => {
    if (!selected || selected.status !== "IN_REVIEW") return;
    setBusy(true);
    try {
      await api(`/api/v1/calculations/${selected.id}/escalate`, { method: "POST" });
      await reload();
      const full = await api<Calc>(`/api/v1/calculations/${selected.id}`);
      setSelected(full);
      hydrateMap(full);
      toast("Заявка эскалирована · SLA risk", { variant: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const reclassify = async () => {
    if (!selected || reclassifyNote.trim().length < 3) return;
    setBusy(true);
    try {
      const calc = await api<Calc>(`/api/v1/calculations/${selected.id}/reclassify`, {
        method: "POST",
        body: JSON.stringify({ brokerFeedback: reclassifyNote.trim() }),
      });
      setSelected(calc);
      hydrateMap(calc);
      setHsEdit(calc.hsCode || calc.items?.[0]?.hsCodeAi || hsEdit);
      setReclassifyNote("");
      toast(`Новый AI-код: ${calc.hsCode || "—"}`, { variant: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка переклассификации";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const loadChatThreads = async () => {
    const rows = await api<ChatThreadRow[]>("/api/v1/chat?scope=threads");
    setChatThreads(rows);
  };

  const loadChat = async (calculationId: string) => {
    const thread = await api<{ messages?: ChatMsg[]; waitingOn?: "CLIENT" | "BROKER" | null } | null>(
      `/api/v1/chat?calculationId=${calculationId}`
    );
    setChat(thread?.messages || []);
    setWaitingOn(thread?.waitingOn ?? null);
  };

  const sendChat = async (attachmentUrl?: string) => {
    if (!selected) return;
    const body = chatMsg.trim() || (attachmentUrl ? "Вложение" : "");
    if (!body && !attachmentUrl) return;
    await api("/api/v1/chat", {
      method: "POST",
      body: JSON.stringify({
        calculationId: selected.id,
        body,
        attachmentUrl,
      }),
    });
    setChatMsg("");
    await loadChat(selected.id);
    if (pane === "chat") await loadChatThreads().catch(() => undefined);
  };

  const requestDossier = async (message: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api("/api/v1/chat", {
        method: "POST",
        body: JSON.stringify({
          calculationId: selected.id,
          body: message,
        }),
      });
      setChatMsg("");
      await loadChat(selected.id);
      if (pane === "chat") await loadChatThreads().catch(() => undefined);
      toast("Запрос отправлен клиенту", { variant: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось отправить запрос";
      setError(msg);
      toast(msg, { variant: "error" });
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      await api("/api/v1/brokers/me", { method: "PATCH", body: JSON.stringify(profile) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const openJob = async (c: Calc, opts?: { syncUrl?: boolean; stayOnChat?: boolean }) => {
    try {
      const full = await api<Calc>(`/api/v1/calculations/${c.id}`);
      setSelected(full);
      hydrateMap(full);
      await loadChat(c.id);
      if (opts?.syncUrl !== false) {
        deepOpenedRef.current = full.id;
        if (opts?.stayOnChat || pane === "chat") {
          router.replace(`${path("/chat")}?id=${encodeURIComponent(full.id)}`, { scroll: false });
        } else {
          const dest =
            pane === "work" || ["IN_REVIEW", "DONE", "SLA_RISK"].includes(full.status)
              ? path("/work")
              : path("/queue");
          router.replace(`${dest}?id=${encodeURIComponent(full.id)}`, { scroll: false });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setChat([]);
      setWaitingOn(null);
    }
  };

  const closeJob = () => {
    setSelected(null);
    setChat([]);
    setWaitingOn(null);
    deepOpenedRef.current = null;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("id")) {
      const dest =
        pane === "work"
          ? path("/work")
          : pane === "queue"
            ? path("/queue")
            : pane === "chat"
              ? path("/chat")
              : path("");
      router.replace(dest, { scroll: false });
    }
  };

  /** Deep-link: /broker/queue|work|chat?id=<calcId> */
  useEffect(() => {
    if (pane !== "queue" && pane !== "work" && pane !== "chat") return;
    if (typeof window === "undefined") return;
    const deepCalcId = new URLSearchParams(window.location.search).get("id");
    if (!deepCalcId) return;
    if (selected?.id === deepCalcId || deepOpenedRef.current === deepCalcId) return;
    const found = [...queue, ...mine].find((c) => c.id === deepCalcId);
    if (!found) {
      if (pane === "chat") {
        deepOpenedRef.current = deepCalcId;
        void openJob({ id: deepCalcId } as Calc, { syncUrl: false });
      }
      return;
    }
    deepOpenedRef.current = deepCalcId;
    void openJob(found, { syncUrl: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, mine, pane]);

  const updateRow = (id: string, patch: Partial<MapRow>) => {
    setMapRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const meta = BROKER_META[pane] || BROKER_META.dashboard;
  const inWork = mine.filter((x) => x.status === "IN_REVIEW").length;
  const slaRisk = [...queue, ...mine].filter((x) => x.status === "SLA_RISK");
  const doneWithTiming = mine.filter(
    (x) => x.status === "DONE" && x.claimedAt && x.doneAt
  );
  const avgResponseLabel = (() => {
    if (doneWithTiming.length === 0) return "—";
    const hours = doneWithTiming.map(
      (x) => (new Date(x.doneAt!).getTime() - new Date(x.claimedAt!).getTime()) / 3600_000
    );
    const ok = hours.filter((h) => Number.isFinite(h) && h >= 0);
    if (ok.length === 0) return "—";
    return `${(ok.reduce((s, h) => s + h, 0) / ok.length).toFixed(1)} ч`;
  })();
  const attention = [...slaRisk, ...queue].filter(
    (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
  ).slice(0, 8);
  const navWithBadge = getBrokerNav(navBase).map((item) => {
    if (item.label === "Очередь") return { ...item, badge: queue.length || null };
    if (item.label === "В работе") return { ...item, badge: inWork || null };
    if (item.label === "Чат") return { ...item, badge: chatUnread || null };
    return item;
  });
  const queuePath = path("/queue");
  const profilePath = path("/profile");
  const sideFoot = formatBrokerSideFoot({
    preferredClaimHours,
    rating: profile.rating,
    closedPerWeek: profile.closedPerWeek,
  });
  const isOnline = profile.acceptingJobs;

  return (
    <LbmCabinetsShell
      variant="broker"
      brand="Кабинет"
      subtitle={`Брокер · ${meName || "…"}`}
      nav={navWithBadge}
      title={meta.title}
      lead={meta.lead}
      avatarUrl="/cabinets/assets/avatar-broker.jpg"
      footer={
        <>
          SLA: <strong>≤ {preferredClaimHours} ч</strong>
          <br />
          {sideFoot.ratingLine}
        </>
      }
      actions={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              reload().catch((e) => setError(e.message));
              if (pane === "chat") loadChatThreads().catch(() => undefined);
              if (selected?.id) loadChat(selected.id).catch(() => undefined);
            }}
            className="btn btn-ghost btn-sm"
          >
            Обновить
          </button>
          <span className={isOnline ? "pill ok hidden sm:inline-flex" : "pill muted hidden sm:inline-flex"}>
            {isOnline ? "Онлайн" : "Не принимает"}
          </span>
          <Link href={queuePath} className="btn btn-primary btn-sm">
            Открыть очередь
          </Link>
        </>
      }
    >
      {error && meId && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-800"
            onClick={() => {
              setError("");
              setBootLoading(true);
              reload()
                .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
                .finally(() => setBootLoading(false));
            }}
          >
            Обновить
          </button>
        </div>
      )}

      {bootLoading ? (
        <VedEmptyState title="Загрузка кабинета…" hint="Подтягиваем очередь и заявки в работе." />
      ) : error && !meId ? (
        <VedEmptyState
          title="Не удалось загрузить кабинет"
          hint={error}
          actionLabel="Обновить"
          onAction={() => {
            setError("");
            setBootLoading(true);
            reload()
              .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
              .finally(() => setBootLoading(false));
          }}
        />
      ) : (
        <>
      {pane === "dashboard" && (
        <section>
          <div className="stats">
            {[
              { v: queue.length, k: "В общей очереди" },
              { v: inWork, k: "У вас в работе" },
              { v: slaRisk.length, k: "Просрочен SLA" },
              { v: avgResponseLabel, k: "Среднее время ответа" },
            ].map((s) => (
              <div key={s.k} className="stat">
                <div className="v">{s.v}</div>
                <div className="k">{s.k}</div>
              </div>
            ))}
          </div>
          {slaRisk[0] && (
            <div className="alert-box warn-box">
              <strong>SLA risk · {slaRisk[0].number}</strong>
              {slaRisk[0].title} — возьмите в работу или эскалируйте через админа.
            </div>
          )}
          {chatUnread > 0 ? (
            <div className="alert-box">
              <strong>Ждут ответа в чате: {chatUnread}</strong>
              Клиент написал — откройте диалог без ухода в полный mapping.
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => router.push(path("/chat"))}
                >
                  Открыть чат
                </button>
              </div>
            </div>
          ) : null}
          <div className="card">
            <h3>Требуют внимания</h3>
            <div style={{ overflowX: "auto" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Клиент</th>
                  <th>Товар</th>
                  <th>AI</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {attention.map((c) => (
                  <tr key={c.id}>
                    <td>{c.number}</td>
                    <td>{c.clientUser?.name || "—"}</td>
                    <td>{c.title}</td>
                    <td>{c.confidence != null ? `${Math.round(c.confidence * 100)}%` : "—"}</td>
                    <td>
                      {c.status === "SLA_RISK" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={c.status} />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => claim(c.id)}
                            className="btn btn-primary btn-sm"
                          >
                            Взять
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => claim(c.id)}
                          className="btn btn-primary btn-sm"
                        >
                          Взять
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {attention.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <VedEmptyState
                        title={isOnline ? "Нет срочных заявок" : "Приём заявок выключен"}
                        hint={
                          isOnline
                            ? "Оплаченные просчёты — в очереди; свои claim — во «В работе»."
                            : "Включите приём в профиле, чтобы видеть очередь."
                        }
                        actionLabel={isOnline ? "Открыть очередь" : "Открыть профиль"}
                        actionHref={isOnline ? queuePath : profilePath}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </section>
      )}

      {(pane === "queue" || pane === "work") && (
        <section className="space-y-5">
          <QueuePane
            queue={pane === "work" ? mine.filter((x) => x.status !== "DONE") : queue}
            meId={meId}
            preferredClaimHours={preferredClaimHours}
            busy={busy}
            selectedId={selected?.id}
            onOpen={openJob}
            onClaim={claim}
            title={pane === "work" ? "Мои заявки" : "Очередь оплаченных заявок"}
            paused={pane === "queue" && !profile.acceptingJobs}
            loading={bootLoading}
            workMode={pane === "work"}
            queueHref={queuePath}
            profileHref={profilePath}
          />
          {selected && (
            <VedDetailDrawer
              open
              title={`${selected.number} · ${selected.title}`}
              subtitle={pane === "work" ? "В работе" : "Очередь"}
              onClose={closeJob}
            >
              <div className="space-y-4">
                <WorkMapping
                  selected={selected}
                  mapRows={mapRows}
                  hsEdit={hsEdit}
                  feeEdit={feeEdit}
                  extraFeeEdit={extraFeeEdit}
                  extraFeeNote={extraFeeNote}
                  comment={comment}
                  reclassifyNote={reclassifyNote}
                  busy={busy}
                  onHsEdit={setHsEdit}
                  onFeeEdit={setFeeEdit}
                  onExtraFeeEdit={setExtraFeeEdit}
                  onExtraFeeNote={setExtraFeeNote}
                  onComment={setComment}
                  onReclassifyNote={setReclassifyNote}
                  onUpdateRow={updateRow}
                  onSaveDraft={saveDraft}
                  onApprove={approve}
                  onClaim={() => selected && claim(selected.id)}
                  onEscalate={escalate}
                  onReclassify={reclassify}
                  llmReclassifyEnabled={llmReclassifyEnabled}
                  confidenceThreshold={confidenceThreshold}
                  dossierThin={
                    selected
                      ? analyzeBrokerDossier({
                          confidence: selected.confidence,
                          hsCode: hsEdit || selected.hsCodeFinal || selected.hsCode,
                          items: selected.items,
                          confidenceThreshold,
                        }).thin
                      : false
                  }
                  onRequestDossier={requestDossier}
                />
                <WorkChat
                  selected={selected}
                  chat={chat}
                  waitingOn={waitingOn}
                  chatMsg={chatMsg}
                  busy={busy}
                  onChatMsg={setChatMsg}
                  onSend={sendChat}
                  onUploadError={(msg) => toast(msg, { variant: "error" })}
                />
              </div>
            </VedDetailDrawer>
          )}
        </section>
      )}

      {pane === "chat" && (
        <section className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
            <ChatThreadsPane
              threads={chatThreads}
              selectedId={selected?.id}
              onSelect={(c) => void openJob(c, { stayOnChat: true })}
              queueHref={queuePath}
            />
            <div className="hidden min-h-[28rem] rounded-[28px] border border-black/[0.04] bg-white p-4 shadow-sm lg:block">
              {selected ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <p className="font-semibold text-[#0f172a]">
                        {selected.number} · {selected.title}
                      </p>
                      <p className="text-xs text-[var(--kb-muted)]">
                        Чат с клиентом · mapping — на «В работе»
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#2b72f4]"
                      onClick={() =>
                        router.push(`${path("/work")}?id=${encodeURIComponent(selected.id)}`)
                      }
                    >
                      Открыть mapping
                    </button>
                  </div>
                  <WorkChat
                    selected={selected}
                    chat={chat}
                    waitingOn={waitingOn}
                    chatMsg={chatMsg}
                    busy={busy}
                    tall
                    onChatMsg={setChatMsg}
                    onSend={sendChat}
                    onUploadError={(msg) => toast(msg, { variant: "error" })}
                  />
                </div>
              ) : (
                <p className="text-sm text-[var(--kb-muted)]">Выберите диалог слева</p>
              )}
            </div>
          </div>
          {selected && (
            <div className="lg:hidden">
              <VedDetailDrawer
                open
                title={`${selected.number} · ${selected.title}`}
                subtitle="Чат"
                onClose={closeJob}
              >
                <div className="mb-3">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#2b72f4]"
                    onClick={() =>
                      router.push(`${path("/work")}?id=${encodeURIComponent(selected.id)}`)
                    }
                  >
                    Открыть mapping
                  </button>
                </div>
                <WorkChat
                  selected={selected}
                  chat={chat}
                  waitingOn={waitingOn}
                  chatMsg={chatMsg}
                  busy={busy}
                  tall
                  onChatMsg={setChatMsg}
                  onSend={sendChat}
                  onUploadError={(msg) => toast(msg, { variant: "error" })}
                />
              </VedDetailDrawer>
            </div>
          )}
          {!selected && (
            <p className="text-sm text-[var(--kb-muted)] lg:hidden">Выберите диалог</p>
          )}
        </section>
      )}

      {pane === "sla" && <SlaStatsPane mine={mine} queue={queue} />}

      {pane === "payouts" && <PayoutsPane payouts={payouts} />}

      {pane === "profile" && (
        <section className="max-w-xl">
          <div className="space-y-3 rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-sm">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Специализация"
              value={profile.specialization}
              onChange={(e) => setProfile({ ...profile, specialization: e.target.value })}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Языки"
              value={profile.languages}
              onChange={(e) => setProfile({ ...profile, languages: e.target.value })}
            />
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              placeholder="О себе"
              value={profile.about}
              onChange={(e) => setProfile({ ...profile, about: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={profile.acceptingJobs}
                onChange={(e) => setProfile({ ...profile, acceptingJobs: e.target.checked })}
              />
              Принимаю новые заявки из очереди
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={saveProfile}
              className="rounded-full bg-[#2b72f4] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Сохранить
            </button>
          </div>
        </section>
      )}
        </>
      )}
    </LbmCabinetsShell>
  );
}
