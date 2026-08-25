"use client";

/**
 * Platform admin VED cabinet (C2 / D20). No legacy CMS panes here — those stay on web (D6).
 * Container surface: NEXT_PUBLIC_ADMIN_BASE="" → routes at /, /bookings, …
 * Root Next: default base "/admin".
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { VedEmptyState, api } from "./VedShell";
import { LbmCabinetsShell } from "./LbmCabinetsShell";
import { useVedToast } from "./feedback/VedToast";
import {
  SupportInboxPane,
  type AdminSupportBox,
  type AdminSupportDetail,
  type AdminSupportThread,
} from "./admin/SupportInboxPane";
import type { SupportTicketAction } from "@/lib/ved/support-ticket";
import {
  adminPath,
  adminPageMeta,
  getAdminNav,
  type AdminAuditRow,
  type AdminBrokerRow,
  type AdminCalc,
  type AdminClientRow,
  type AdminCompanyDetail,
  type AdminIntegrations,
  type AdminOrchState,
  type AdminPayoutRow,
  type AdminStaffUser,
  type AdminTariffRow,
  type PayoutStatusFilter,
  type PlatformSettings,
} from "./admin/types";
import type { TnvedImportItem } from "@/lib/ved/tnved";
import { DashboardPane } from "./admin/DashboardPane";
import { BookingsPane } from "./admin/BookingsPane";
import { AdminCalcDetailDrawer } from "./admin/AdminCalcDetailDrawer";
import { AdminCompanyDetailDrawer } from "./admin/AdminCompanyDetailDrawer";
import { AdminBrokerDetailDrawer } from "./admin/AdminBrokerDetailDrawer";
import { ClientsPane } from "./admin/ClientsPane";
import { BrokersPane } from "./admin/BrokersPane";
import {
  ManufacturersPane,
  type AdminManufacturerCompany,
  type AdminManufacturerProposal,
} from "./admin/ManufacturersPane";
import { TariffsPane } from "./admin/TariffsPane";
import { FinancePane } from "./admin/FinancePane";
import { PlatformSettingsPane } from "./admin/PlatformSettingsPane";
import { OrchPane } from "./admin/OrchPane";
import { TnvedImportPane } from "./admin/TnvedImportPane";
import { IntegrationsPane } from "./admin/IntegrationsPane";
import { UsersPane } from "./admin/UsersPane";
import { AuditPane } from "./admin/AuditPane";

export function AdminVedCabinet() {
  const pathname = usePathname() || "/admin";
  const router = useRouter();
  const navBase = process.env.NEXT_PUBLIC_ADMIN_BASE ?? "/admin";
  const nav = getAdminNav(navBase);
  const p = (suffix: string) => adminPath(navBase, suffix);
  const { toast } = useVedToast();
  const [calcs, setCalcs] = useState<AdminCalc[]>([]);
  const [clients, setClients] = useState<AdminClientRow[]>([]);
  const [brokers, setBrokers] = useState<AdminBrokerRow[]>([]);
  const [mfgProposals, setMfgProposals] = useState<AdminManufacturerProposal[]>([]);
  const [mfgCompanies, setMfgCompanies] = useState<AdminManufacturerCompany[]>([]);
  const [mfgStatus, setMfgStatus] = useState("PENDING");
  const [mfgQ, setMfgQ] = useState("");
  const [tariffs, setTariffs] = useState<AdminTariffRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>({
    confidenceThreshold: 0.75,
    defaultSlaHours: 4,
    preferredClaimHours: 4,
    usdRate: 90,
    cnyRate: 12.5,
    eurRate: 98,
    fxBufferPct: 2,
    marketplaceEnabled: true,
    autoAssignBrokers: true,
    maintenanceMode: false,
    paymentsEnabled: true,
    llmEnrichEnabled: true,
    notifyEnabled: true,
    mockTopupAllowed: true,
  });
  const [integrations, setIntegrations] = useState<AdminIntegrations | null>(null);
  const [staffUsers, setStaffUsers] = useState<AdminStaffUser[]>([]);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "EDITOR",
    password: "",
  });
  const [resetPasswordHint, setResetPasswordHint] = useState("");
  const [supportUnread, setSupportUnread] = useState(0);
  const [selectedCalcId, setSelectedCalcId] = useState("");
  const [calcDetail, setCalcDetail] = useState<AdminCalc | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companyDetail, setCompanyDetail] = useState<AdminCompanyDetail | null>(null);
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("1000");
  const [adjustReason, setAdjustReason] = useState("");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<PayoutStatusFilter>("ALL");
  const [tnvedResult, setTnvedResult] = useState("");
  const [supportBox, setSupportBox] = useState<AdminSupportBox>("open");
  const [supportThreads, setSupportThreads] = useState<AdminSupportThread[]>([]);
  const [supportSelectedId, setSupportSelectedId] = useState("");
  const [supportDetail, setSupportDetail] = useState<AdminSupportDetail | null>(null);
  const [supportReply, setSupportReply] = useState("");
  const [orch, setOrch] = useState<AdminOrchState | null>(null);
  const [audit, setAudit] = useState<AdminAuditRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [assignBrokerId, setAssignBrokerId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [booted, setBooted] = useState(false);

  const reload = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    const [c, cl, br, t, pay, s] = await Promise.all([
      api<AdminCalc[]>(`/api/v1/calculations?${params}`),
      api<AdminClientRow[]>("/api/v1/company/list"),
      api<AdminBrokerRow[]>("/api/v1/brokers?all=1"),
      api<AdminTariffRow[]>("/api/v1/tariffs"),
      api<AdminPayoutRow[]>("/api/v1/payouts"),
      api<PlatformSettings>("/api/v1/platform/settings"),
    ]);
    setCalcs(c);
    setClients(cl);
    setBrokers(br);
    setTariffs(t);
    setPayouts(pay);
    setSettings({
      confidenceThreshold: s.confidenceThreshold ?? 0.75,
      defaultSlaHours: s.defaultSlaHours ?? 4,
      preferredClaimHours: s.preferredClaimHours ?? s.defaultSlaHours ?? 4,
      usdRate: s.usdRate ?? 90,
      cnyRate: s.cnyRate ?? 12.5,
      eurRate: s.eurRate ?? 98,
      fxBufferPct: s.fxBufferPct ?? 2,
      marketplaceEnabled: s.marketplaceEnabled ?? true,
      autoAssignBrokers: s.autoAssignBrokers ?? true,
      maintenanceMode: s.maintenanceMode ?? false,
      paymentsEnabled: s.paymentsEnabled ?? true,
      llmEnrichEnabled: s.llmEnrichEnabled ?? true,
      notifyEnabled: s.notifyEnabled ?? true,
      mockTopupAllowed: s.mockTopupAllowed ?? true,
    });
    setAssignBrokerId((prev) => prev || br[0]?.user?.id || "");
    try {
      const a = await fetch("/api/admin/audit?limit=50", { credentials: "include" });
      if (a.ok) {
        const data = await a.json();
        setAudit(data.logs || []);
      }
    } catch {
      /* optional */
    }
  };

  const reloadSupport = async (box = supportBox) => {
    const threads = await api<AdminSupportThread[]>(`/api/v1/chat?scope=support&box=${box}`);
    setSupportThreads(threads);
  };

  const reloadOrch = async () => {
    const data = await api<AdminOrchState>("/api/v1/platform/orch");
    setOrch(data);
  };

  const reloadIntegrations = async () => {
    const data = await api<AdminIntegrations>("/api/v1/platform/integrations");
    setIntegrations(data);
    if (data.toggles) {
      setSettings((prev) => ({ ...prev, ...data.toggles }));
    }
  };

  const reloadUsers = async () => {
    const res = await fetch("/api/admin/users", { credentials: "include" });
    if (!res.ok) throw new Error(`users ${res.status}`);
    const data = await res.json();
    setStaffUsers(Array.isArray(data) ? data : data.users || []);
  };

  const reloadSupportUnread = async () => {
    try {
      const data = await api<{ count: number }>("/api/v1/chat?scope=unread");
      setSupportUnread(data.count || 0);
    } catch {
      /* optional */
    }
  };

  const openCalc = async (id: string, pushUrl = true) => {
    setSelectedCalcId(id);
    setBusy(true);
    try {
      const detail = await api<AdminCalc>(`/api/v1/calculations/${id}`);
      setCalcDetail(detail);
      if (pushUrl) {
        const base = pathname === p("/") ? p("/bookings") : pathname;
        router.replace(`${base}?id=${encodeURIComponent(id)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setCalcDetail(null);
    } finally {
      setBusy(false);
    }
  };

  const closeCalc = () => {
    setSelectedCalcId("");
    setCalcDetail(null);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("id")) {
      router.replace(pathname);
    }
  };

  const openCompany = async (id: string, pushUrl = true) => {
    setSelectedCompanyId(id);
    setBusy(true);
    try {
      const detail = await api<AdminCompanyDetail>(`/api/v1/company/${id}`);
      setCompanyDetail(detail);
      if (pushUrl && pathname === p("/clients")) {
        router.replace(`${p("/clients")}?company=${encodeURIComponent(id)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setCompanyDetail(null);
    } finally {
      setBusy(false);
    }
  };

  const closeCompany = () => {
    setSelectedCompanyId("");
    setCompanyDetail(null);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("company")) {
      router.replace(p("/clients"));
    }
  };

  const submitAdjust = async () => {
    if (!selectedCompanyId) return;
    setBusy(true);
    try {
      await api(`/api/v1/company/${selectedCompanyId}/adjust`, {
        method: "POST",
        body: JSON.stringify({
          amountRub: Number(adjustAmount),
          reason: adjustReason,
        }),
      });
      setAdjustReason("");
      toast("Баланс скорректирован", { variant: "ok" });
      await openCompany(selectedCompanyId, false);
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const saveCompanyProfile = async (patch: {
    name: string;
    inn: string;
    kpp: string;
    legalAddress: string;
    contactEmail: string;
    contactPhone: string;
    clientSegment: string;
  }) => {
    if (!selectedCompanyId) return;
    setBusy(true);
    try {
      const body: Record<string, string> = {
        name: patch.name,
        inn: patch.inn,
        kpp: patch.kpp,
        legalAddress: patch.legalAddress,
        contactEmail: patch.contactEmail,
        contactPhone: patch.contactPhone,
      };
      if (companyDetail?.kind !== "MANUFACTURER") {
        body.clientSegment = patch.clientSegment;
      }
      const next = await api<AdminCompanyDetail>(`/api/v1/company/${selectedCompanyId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setCompanyDetail(next);
      toast("Компания сохранена", { variant: "ok" });
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const createStaffUser = async () => {
    setBusy(true);
    setResetPasswordHint("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `create ${res.status}`);
      setNewUser({ name: "", email: "", role: "EDITOR", password: "" });
      toast("Пользователь создан", { variant: "ok" });
      await reloadUsers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const resetStaffPassword = async (userId: string) => {
    setBusy(true);
    setResetPasswordHint("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `reset ${res.status}`);
      setResetPasswordHint(data.newPassword || "");
      toast("Пароль сброшен — скопируйте сейчас", { variant: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const bootReload = async () => {
    try {
      await reload();
      setBooted(true);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBootLoading(false);
    }
  };

  useEffect(() => {
    void bootReload();
    reloadSupportUnread().catch(() => {});
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (pathname === p("/support")) {
        reloadSupport().catch(() => undefined);
        reloadSupportUnread().catch(() => undefined);
      } else if (pathname === p("/orch")) {
        reloadOrch().catch(() => undefined);
      }
    }, 45_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- soft poll orch/support
  }, [pathname]);

  useEffect(() => {
    if (pathname === p("/support")) {
      reloadSupport().catch((e) => setError(e.message));
      reloadSupportUnread().catch(() => {});
    }
    if (pathname === p("/orch")) {
      reloadOrch().catch((e) => setError(e.message));
    }
    if (pathname === p("/integrations")) {
      reloadIntegrations().catch((e) => setError(e.message));
    }
    if (pathname === p("/users")) {
      reloadUsers().catch((e) => setError(e.message));
    }
    if (pathname === p("/audit")) {
      reload().catch((e) => setError(e.message));
    }
    if (pathname === p("/manufacturers")) {
      reloadManufacturers().catch((e) => setError(e.message));
    }
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const calcId = qs.get("id");
    if (calcId && (pathname === p("/") || pathname === p("/bookings")) && calcId !== selectedCalcId) {
      openCalc(calcId, false).catch((e) => setError(e.message));
    }
    const companyId = qs.get("company");
    if (companyId && pathname === p("/clients") && companyId !== selectedCompanyId) {
      openCompany(companyId, false).catch((e) => setError(e.message));
    }
  }, [pathname]);

  const openSupport = async (id: string) => {
    setSupportSelectedId(id);
    setBusy(true);
    try {
      const detail = await api<AdminSupportDetail>(`/api/v1/chat?threadId=${id}`);
      setSupportDetail(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const sendSupportReply = async () => {
    if (!supportSelectedId || !supportReply.trim()) return;
    setBusy(true);
    try {
      await api("/api/v1/chat", {
        method: "POST",
        body: JSON.stringify({
          kind: "SUPPORT_REPLY",
          threadId: supportSelectedId,
          body: supportReply.trim(),
        }),
      });
      setSupportReply("");
      setSupportBox("waiting_client");
      await openSupport(supportSelectedId);
      await reloadSupport("waiting_client");
      await reloadSupportUnread();
      toast("Ответ отправлен", { variant: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const submitSupportStatus = async (action: SupportTicketAction) => {
    if (!supportSelectedId) return;
    setBusy(true);
    try {
      await api("/api/v1/chat", {
        method: "POST",
        body: JSON.stringify({
          kind: "SUPPORT_STATUS",
          threadId: supportSelectedId,
          action,
        }),
      });
      const labels = { resolve: "Обращение закрыто", archive: "Перенесено в архив", reopen: "Обращение открыто" };
      toast(labels[action], { variant: "ok" });
      const nextBox =
        action === "resolve" ? "resolved" : action === "archive" ? "archived" : "open";
      setSupportBox(nextBox);
      await reloadSupport(nextBox);
      await openSupport(supportSelectedId);
      await reloadSupportUnread();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const assign = async (calcId: string, brokerUserId: string) => {
    setBusy(true);
    try {
      await api(`/api/v1/calculations/${calcId}/assign`, {
        method: "POST",
        body: JSON.stringify({ brokerUserId }),
      });
      await reload();
      if (calcDetail?.id === calcId || selectedCalcId === calcId) {
        await openCalc(calcId, false);
      }
      toast("Брокер назначен", { variant: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const escalate = async (calcId: string) => {
    setBusy(true);
    try {
      await api(`/api/v1/calculations/${calcId}/escalate`, { method: "POST" });
      setCalcs((list) =>
        list.map((c) => (c.id === calcId ? { ...c, status: "SLA_RISK" } : c))
      );
      if (calcDetail?.id === calcId) {
        setCalcDetail((d) => (d ? { ...d, status: "SLA_RISK" } : d));
      }
      void reload().catch(() => undefined);
      if (calcDetail?.id === calcId || selectedCalcId === calcId) {
        void openCalc(calcId, false).catch(() => undefined);
      }
      toast("Эскалация SLA", { variant: "info" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const saveTariff = async (t: AdminTariffRow) => {
    setBusy(true);
    try {
      await api("/api/v1/tariffs/update", {
        method: "PATCH",
        body: JSON.stringify({
          id: t.id,
          priceRub: t.priceRub,
          brokerSharePct: t.brokerSharePct,
          slaHours: t.slaHours,
        }),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    setBusy(true);
    try {
      await api("/api/v1/platform/settings", { method: "PATCH", body: JSON.stringify(settings) });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const payPayout = async (id: string) => {
    setBusy(true);
    setError("");
    setPayouts((prev) => prev.map((pay) => (pay.id === id ? { ...pay, status: "PAID" } : pay)));
    try {
      await api("/api/v1/payouts", { method: "PATCH", body: JSON.stringify({ id, status: "PAID" }) });
      toast("Выплата отмечена", { variant: "ok" });
      void reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось отметить выплату";
      setError(msg);
      toast(msg, { variant: "error" });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const moderateBroker = async (brokerProfileId: string, moderationStatus: "APPROVED" | "REJECTED" | "PENDING") => {
    setBusy(true);
    try {
      await api("/api/v1/brokers", {
        method: "PATCH",
        body: JSON.stringify({ brokerProfileId, status: moderationStatus }),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const setBrokerAccepting = async (brokerProfileId: string, acceptingJobs: boolean) => {
    setBusy(true);
    try {
      await api("/api/v1/brokers", {
        method: "PATCH",
        body: JSON.stringify({ brokerProfileId, acceptingJobs }),
      });
      await reload();
      toast(acceptingJobs ? "Приём заявок включён" : "Приём заявок выключен", { variant: "ok" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const saveBrokerProfile = async (
    brokerProfileId: string,
    patch: { specialization: string; languages: string; about: string }
  ) => {
    setBusy(true);
    try {
      const updated = await api<AdminBrokerRow>("/api/v1/brokers", {
        method: "PATCH",
        body: JSON.stringify({ brokerProfileId, ...patch }),
      });
      setBrokers((prev) => prev.map((b) => (b.id === brokerProfileId ? { ...b, ...updated } : b)));
      toast("Профиль брокера сохранён", { variant: "ok" });
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const reloadManufacturers = async () => {
    const qs = new URLSearchParams();
    qs.set("status", mfgStatus);
    qs.set("approved", "1");
    if (mfgQ.trim()) qs.set("q", mfgQ.trim());
    const data = await api<{
      proposals: AdminManufacturerProposal[];
      companies?: AdminManufacturerCompany[];
    }>(`/api/v1/admin/manufacturer-proposals?${qs}`);
    setMfgProposals(data.proposals || []);
    setMfgCompanies(data.companies || []);
  };

  const approveManufacturer = async (id: string) => {
    setBusy(true);
    try {
      await api(`/api/v1/admin/manufacturer-proposals/${id}/approve`, {
        method: "POST",
        body: "{}",
      });
      toast("Утверждено · компания в каталоге. Логин — в Пользователях (роль MANUFACTURER)", {
        variant: "ok",
      });
      await reloadManufacturers();
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const rejectManufacturer = async (id: string) => {
    setBusy(true);
    try {
      await api(`/api/v1/admin/manufacturer-proposals/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast("Предложение отклонено", { variant: "ok" });
      await reloadManufacturers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const retryOrch = async (action: "retry_job" | "retry_outbox", id: string) => {
    setBusy(true);
    try {
      await api("/api/v1/platform/orch", {
        method: "POST",
        body: JSON.stringify({ action, id }),
      });
      toast("Повтор поставлен в очередь", { variant: "ok" });
      await reloadOrch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка retry");
    } finally {
      setBusy(false);
    }
  };

  const resetBookingFilters = async () => {
    setQ("");
    setStatus("all");
    setBusy(true);
    try {
      const c = await api<AdminCalc[]>("/api/v1/calculations");
      setCalcs(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const exportPayoutsCsv = () => {
    const rows = payouts.filter((pay) => payoutStatusFilter === "ALL" || pay.status === payoutStatusFilter);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      ["id", "period", "broker", "amountRub", "status"].join(","),
      ...rows.map((pay) =>
        [
          esc(pay.id),
          esc(pay.periodLabel),
          esc(pay.brokerProfile?.user?.name || ""),
          String(pay.amountRub),
          esc(pay.status),
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${payoutStatusFilter.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTnved = async (items: TnvedImportItem[]) => {
    setBusy(true);
    setTnvedResult("");
    try {
      if (!items?.length) throw new Error("Нет позиций для импорта");
      const res = await api<{ upserted?: number; rates?: number } | Record<string, unknown>>(
        "/api/v1/tnved/import",
        {
          method: "POST",
          body: JSON.stringify({ items }),
        }
      );
      setTnvedResult(JSON.stringify(res, null, 2));
      toast(`Импорт ТН ВЭД: ${typeof res.upserted === "number" ? res.upserted : items.length} поз.`, {
        variant: "ok",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка импорта";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (pathname !== p("/manufacturers")) return;
    reloadManufacturers().catch((e) => setError(e instanceof Error ? e.message : "Ошибка"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mfgStatus, mfgQ, pathname]);

  const approvedBrokers = brokers.filter((b) => b.moderationStatus === "APPROVED");
  const selectedBroker = brokers.find((b) => b.id === selectedBrokerId) || null;
  const filteredPayouts = payouts.filter(
    (pay) => payoutStatusFilter === "ALL" || pay.status === payoutStatusFilter
  );

  const onDash = pathname === p("/") || pathname === p("/bookings");
  const onAiOrSettings = pathname === p("/ai-quality") || pathname === p("/settings");
  const meta = adminPageMeta(pathname, p);
  const queuedOrRisk = calcs.filter((c) => ["QUEUED", "SLA_RISK"].includes(c.status)).length;
  const pendingBrokers = brokers.filter((b) => b.moderationStatus === "PENDING");
  const pendingMfg = mfgProposals.filter((x) => x.status === "PENDING").length;
  const payoutReady = payouts.filter((pay) => pay.status !== "PAID");
  const navWithBadge = nav.map((item) => {
    if (item.label === "Заявки") return { ...item, badge: queuedOrRisk || null };
    if (item.label === "Поддержка") return { ...item, badge: supportUnread || null };
    if (item.label === "Производители") return { ...item, badge: pendingMfg || null };
    return item;
  });

  return (
    <LbmCabinetsShell
      variant="admin"
      brand="LBM Брокер"
      subtitle="Админ · платформа"
      nav={navWithBadge}
      title={meta.title}
      lead={meta.lead}
      avatarUrl="/cabinets/assets/avatar-user.jpg"
      footer={
        <>
          SLA платформы: <strong>≤ {settings.defaultSlaHours} ч</strong>
          <br />
          Онлайн брокеров (approved): <strong>{approvedBrokers.length}</strong>
        </>
      }
      actions={
        <span className="pill blue">Прод · 152-ФЗ</span>
      }
    >
      {error && booted && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-800"
            onClick={() => {
              setError("");
              setBootLoading(true);
              void bootReload();
            }}
          >
            Обновить
          </button>
        </div>
      )}

      {bootLoading ? (
        <VedEmptyState title="Загрузка кабинета…" hint="Подтягиваем заявки, компании и настройки платформы." />
      ) : error && !booted ? (
        <VedEmptyState
          title="Не удалось загрузить кабинет"
          hint={error}
          actionLabel="Обновить"
          onAction={() => {
            setError("");
            setBootLoading(true);
            void bootReload();
          }}
        />
      ) : (
        <>
      {pathname === p("/") && (
        <DashboardPane
          calcs={calcs}
          clients={clients}
          brokers={brokers}
          payouts={payouts}
          settings={settings}
          pendingBrokers={pendingBrokers}
          payoutReady={payoutReady}
          bookingsHref={p("/bookings")}
          supportHref={p("/support")}
          onOpenCalc={(id) => void openCalc(id)}
        />
      )}

      {onDash && (
        <BookingsPane
          calcs={calcs}
          brokers={brokers}
          q={q}
          status={status}
          assignBrokerId={assignBrokerId}
          selectedCalcId={selectedCalcId}
          busy={busy}
          onQ={setQ}
          onStatus={setStatus}
          onAssignBrokerId={setAssignBrokerId}
          onReload={() => void reload().catch((e) => setError(e.message))}
          onResetFilters={() => void resetBookingFilters()}
          onOpenCalc={(id) => void openCalc(id)}
          onAssign={(calcId, brokerUserId) => void assign(calcId, brokerUserId)}
          onEscalate={(calcId) => void escalate(calcId)}
        />
      )}

      {onDash && calcDetail && (
        <AdminCalcDetailDrawer
          calc={calcDetail}
          assignBrokerId={assignBrokerId}
          busy={busy}
          onClose={closeCalc}
          onAssign={(calcId, brokerUserId) => void assign(calcId, brokerUserId)}
          onEscalate={(calcId) => void escalate(calcId)}
        />
      )}

      {pathname === p("/clients") && (
        <ClientsPane
          clients={clients}
          selectedCompanyId={selectedCompanyId}
          onOpenCompany={(id) => void openCompany(id)}
          usersHref={p("/users")}
        />
      )}

      {pathname === p("/clients") && companyDetail && (
        <AdminCompanyDetailDrawer
          company={companyDetail}
          adjustAmount={adjustAmount}
          adjustReason={adjustReason}
          busy={busy}
          onClose={closeCompany}
          onAdjustAmount={setAdjustAmount}
          onAdjustReason={setAdjustReason}
          onSubmitAdjust={() => void submitAdjust()}
          onSaveProfile={(patch) => void saveCompanyProfile(patch)}
          onOpenBooking={(calcId) => router.push(`${p("/bookings")}?id=${encodeURIComponent(calcId)}`)}
        />
      )}

      {pathname === p("/manufacturers") && (
        <ManufacturersPane
          proposals={mfgProposals}
          companies={mfgCompanies}
          statusFilter={mfgStatus}
          onStatusFilter={setMfgStatus}
          q={mfgQ}
          onQ={setMfgQ}
          busy={busy}
          usersHref={p("/users")}
          onApprove={(id) => void approveManufacturer(id)}
          onReject={(id) => void rejectManufacturer(id)}
          onOpenCompany={(id) => void openCompany(id)}
        />
      )}

      {pathname === p("/manufacturers") && companyDetail && (
        <AdminCompanyDetailDrawer
          company={companyDetail}
          adjustAmount={adjustAmount}
          adjustReason={adjustReason}
          busy={busy}
          onClose={closeCompany}
          onAdjustAmount={setAdjustAmount}
          onAdjustReason={setAdjustReason}
          onSubmitAdjust={() => void submitAdjust()}
          onSaveProfile={(patch) => void saveCompanyProfile(patch)}
          onOpenBooking={(calcId) => router.push(`${p("/bookings")}?id=${encodeURIComponent(calcId)}`)}
        />
      )}

      {pathname === p("/brokers") && (
        <BrokersPane
          brokers={brokers}
          selectedBrokerId={selectedBrokerId}
          busy={busy}
          onOpenBroker={setSelectedBrokerId}
          onModerate={(id, st) => void moderateBroker(id, st)}
          onSetAccepting={(id, accepting) => void setBrokerAccepting(id, accepting)}
        />
      )}

      {pathname === p("/brokers") && selectedBroker && (
        <AdminBrokerDetailDrawer
          broker={selectedBroker}
          busy={busy}
          onClose={() => setSelectedBrokerId("")}
          onModerate={(st) => void moderateBroker(selectedBroker.id, st)}
          onSetAccepting={(accepting) => void setBrokerAccepting(selectedBroker.id, accepting)}
          onSaveProfile={(patch) => void saveBrokerProfile(selectedBroker.id, patch)}
        />
      )}

      {pathname === p("/tariffs") && (
        <TariffsPane
          tariffs={tariffs}
          busy={busy}
          onChange={setTariffs}
          onSave={(t) => void saveTariff(t)}
        />
      )}

      {pathname === p("/finance") && (
        <FinancePane
          clients={clients}
          payoutsTotal={payouts.length}
          payoutReady={payoutReady}
          filteredPayouts={filteredPayouts}
          payoutStatusFilter={payoutStatusFilter}
          busy={busy}
          onFilter={setPayoutStatusFilter}
          onExportCsv={exportPayoutsCsv}
          onMarkPaid={(id) => void payPayout(id)}
        />
      )}

      {onAiOrSettings && (
        <PlatformSettingsPane
          settings={settings}
          busy={busy}
          onChange={setSettings}
          onSave={() => void saveSettings()}
        />
      )}

      {pathname === p("/support") && (
        <SupportInboxPane
          box={supportBox}
          onBox={(next) => {
            setSupportBox(next);
            setSupportSelectedId("");
            setSupportDetail(null);
            setSupportReply("");
            reloadSupport(next).catch((e) => setError(e.message));
          }}
          threads={supportThreads}
          selectedId={supportSelectedId}
          detail={supportDetail}
          reply={supportReply}
          busy={busy}
          onOpen={(id) => void openSupport(id)}
          onCloseDetail={() => {
            setSupportSelectedId("");
            setSupportDetail(null);
            setSupportReply("");
          }}
          onReplyChange={setSupportReply}
          onSend={() => void sendSupportReply()}
          onStatus={(action) => void submitSupportStatus(action)}
        />
      )}

      {pathname === p("/orch") && (
        <OrchPane
          orch={orch}
          busy={busy}
          onReload={() => void reloadOrch().catch((e) => setError(e.message))}
          onRetry={(action, id) => void retryOrch(action, id)}
        />
      )}

      {pathname === p("/tnved") && (
        <TnvedImportPane
          result={tnvedResult}
          busy={busy}
          onImport={(items) => void importTnved(items)}
        />
      )}

      {pathname === p("/integrations") && (
        <IntegrationsPane
          integrations={integrations}
          settings={settings}
          busy={busy}
          onReload={() => void reloadIntegrations().catch((e) => setError(e.message))}
          onSaveToggles={() => void saveSettings()}
          onToggle={(key, value) => setSettings({ ...settings, [key]: value })}
        />
      )}

      {pathname === p("/users") && (
        <UsersPane
          users={staffUsers}
          newUser={newUser}
          resetPasswordHint={resetPasswordHint}
          busy={busy}
          onNewUser={(patch) => setNewUser((prev) => ({ ...prev, ...patch }))}
          onCreate={() => void createStaffUser()}
          onResetPassword={(userId) => void resetStaffPassword(userId)}
        />
      )}

      {pathname === p("/audit") && <AuditPane rows={audit} />}
        </>
      )}
    </LbmCabinetsShell>
  );
}
