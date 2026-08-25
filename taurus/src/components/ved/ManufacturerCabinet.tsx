"use client";

/**
 * Manufacturer cabinet (D31): SKU master-data, demand aggregates, client preview.
 * Panes live in ./manufacturer/*. Isolated from client/broker D8 calc FSM.
 */
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { factoryUiEnabled } from "@/lib/ved/cabinet-features";
import { VedShell, api } from "./VedShell";
import { VedDetailDrawer } from "./VedDetailDrawer";
import { useVedToast } from "./feedback/VedToast";
import { CatalogPane } from "./manufacturer/CatalogPane";
import { DashboardPane } from "./manufacturer/DashboardPane";
import { DemandPane } from "./manufacturer/DemandPane";
import { PoolsPane } from "./manufacturer/PoolsPane";
import { PreviewPane } from "./manufacturer/PreviewPane";
import { ProfilePane } from "./manufacturer/ProfilePane";
import { SkuEditor } from "./manufacturer/SkuEditor";
import {
  emptySkuForm,
  getManufacturerNav,
  manufacturerPane,
  type ManufacturerCompany,
  type ManufacturerDash,
  type ManufacturerOrderRequest,
  type ManufacturerPool,
  type ManufacturerSku,
} from "./manufacturer/types";

const META: Record<string, { title: string; lead: string }> = {
  dashboard: {
    title: "Кабинет производителя",
    lead: "Эталон SKU · спрос хвоста без ПДн · не маркетплейс",
  },
  catalog: { title: "Каталог SKU", lead: "Нетто, брутто, габариты, упаковка, признаки ТН ВЭД" },
  demand: { title: "Спрос", lead: "Число просчётов и PDF по SKU" },
  pools: { title: "Сборные заказы", lead: "Подтверждение запросов импортёров в партию" },
  preview: { title: "Как видит клиент", lead: "Превью карточки в просчёте импортёра" },
  profile: { title: "Профиль производителя", lead: "Реквизиты компании-производителя" },
};

export function ManufacturerCabinet() {
  const pathname = usePathname() || "/manufacturer";
  const router = useRouter();
  const search = useSearchParams();
  const factoryOn = factoryUiEnabled();
  const paneRaw = manufacturerPane(pathname);
  const pane = !factoryOn && paneRaw === "pools" ? "dashboard" : paneRaw;
  const navBase = process.env.NEXT_PUBLIC_MANUFACTURER_BASE ?? "/manufacturer";
  const path = (suffix: string) => {
    const b = navBase.replace(/\/$/, "");
    return b ? `${b}${suffix}` : suffix || "/";
  };
  const { toast } = useVedToast();
  const [dash, setDash] = useState<ManufacturerDash | null>(null);
  const [skus, setSkus] = useState<ManufacturerSku[]>([]);
  const [company, setCompany] = useState<ManufacturerCompany | null>(null);
  const [orderRequests, setOrderRequests] = useState<ManufacturerOrderRequest[]>([]);
  const [pools, setPools] = useState<ManufacturerPool[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Partial<ManufacturerSku>>(emptySkuForm());
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [d, list, c, reqs, poolList] = await Promise.all([
      api<ManufacturerDash>("/api/v1/manufacturer/dashboard"),
      api<ManufacturerSku[]>("/api/v1/manufacturer/skus"),
      api<ManufacturerCompany>("/api/v1/manufacturer/company"),
      factoryOn
        ? api<ManufacturerOrderRequest[]>("/api/v1/manufacturer/order-requests")
        : Promise.resolve([]),
      factoryOn ? api<ManufacturerPool[]>("/api/v1/manufacturer/pools") : Promise.resolve([]),
    ]);
    setDash(d);
    setSkus(list);
    setCompany(c);
    setOrderRequests(reqs);
    setPools(poolList);
  }, [factoryOn]);

  useEffect(() => {
    reload().catch((e: Error) => setError(e.message || "Ошибка загрузки"));
  }, [reload]);

  useEffect(() => {
    if (!factoryOn && paneRaw === "pools") {
      router.replace(path(""));
    }
  }, [factoryOn, paneRaw, router]);

  const openNew = () => {
    setForm(emptySkuForm());
    setEditorOpen(true);
    router.replace(`${path("/catalog")}?new=1`);
  };

  const openSku = async (id: string) => {
    const row = await api<ManufacturerSku>(`/api/v1/manufacturer/skus/${id}`);
    setForm(row);
    setEditorOpen(true);
    router.replace(`${path("/catalog")}?id=${id}`);
  };

  useEffect(() => {
    const id = search.get("id");
    const isNew = search.get("new") === "1";
    if (pane === "catalog" && isNew) {
      setForm(emptySkuForm());
      setEditorOpen(true);
    } else if (pane === "catalog" && id && !editorOpen) {
      openSku(id).catch(() => toast("SKU не найден", { variant: "error" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link once per id
  }, [pane, search]);

  const closeEditor = () => {
    setEditorOpen(false);
    router.replace(path("/catalog"));
  };

  const saveSku = async () => {
    setBusy(true);
    setError("");
    try {
      const payload = { ...form };
      delete (payload as { id?: string }).id;
      delete (payload as { companyId?: string }).companyId;
      delete (payload as { clientPreview?: unknown }).clientPreview;
      delete (payload as { demandCalcCount?: number }).demandCalcCount;
      delete (payload as { demandDoneCount?: number }).demandDoneCount;
      delete (payload as { createdAt?: string }).createdAt;
      delete (payload as { updatedAt?: string }).updatedAt;
      delete (payload as { version?: number }).version;
      if (form.id) {
        await api(`/api/v1/manufacturer/skus/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast("SKU обновлён", { variant: "ok" });
      } else {
        await api("/api/v1/manufacturer/skus", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast("SKU создан", { variant: "ok" });
      }
      await reload();
      closeEditor();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toast(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const saveCompany = async () => {
    if (!company) return;
    setBusy(true);
    try {
      const next = await api<ManufacturerCompany>("/api/v1/manufacturer/company", {
        method: "PATCH",
        body: JSON.stringify(company),
      });
      setCompany(next);
      toast("Профиль сохранён", { variant: "ok" });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const runPool = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok, { variant: "ok" });
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const meta = META[pane];
  const submittedBadge =
    (factoryOn
      ? orderRequests.filter((r) => r.status === "SUBMITTED").length || dash?.requestSubmitted || 0
      : 0);
  const navWithBadge = getManufacturerNav(navBase).map((item) => {
    if (item.label === "Сборные заказы") return { ...item, badge: submittedBadge || null };
    return item;
  });

  return (
    <VedShell
      brand="Производитель"
      subtitle={dash?.company?.name || "Эталон SKU"}
      nav={navWithBadge}
      title={meta.title}
      lead={meta.lead}
      actions={
        pane === "catalog" ? (
          <button
            type="button"
            onClick={openNew}
            className="rounded-full bg-[#2b72f4] px-4 py-2 text-sm font-semibold text-white"
          >
            Новый SKU
          </button>
        ) : (
          <button
            type="button"
            onClick={() => reload().catch(() => toast("Не удалось обновить", { variant: "error" }))}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm"
          >
            Обновить
          </button>
        )
      }
    >
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      {pane === "dashboard" && (
        <DashboardPane
          dash={dash}
          catalogHref={path("/catalog")}
          demandHref={path("/demand")}
          poolsHref={factoryOn ? path("/pools") : undefined}
          showPools={factoryOn}
        />
      )}
      {pane === "catalog" && (
        <CatalogPane skus={skus} onNew={openNew} onOpen={(id) => openSku(id)} />
      )}
      {pane === "demand" && <DemandPane skus={skus} catalogHref={path("/catalog")} />}
      {factoryOn && pane === "pools" && (
        <PoolsPane
          requests={orderRequests}
          pools={pools}
          busy={busy}
          catalogHref={path("/catalog")}
          onAccept={(id) =>
            void runPool(
              () =>
                api(`/api/v1/manufacturer/order-requests/${id}/accept`, {
                  method: "POST",
                  body: "{}",
                }).then(() => undefined),
              "Принято в сборный заказ"
            )
          }
          onReject={(id, reason) =>
            void runPool(
              () =>
                api(`/api/v1/manufacturer/order-requests/${id}/reject`, {
                  method: "POST",
                  body: JSON.stringify({ reason }),
                }).then(() => undefined),
              "Запрос отклонён"
            )
          }
          onConfirm={(id) =>
            void runPool(
              () =>
                api(`/api/v1/manufacturer/pools/${id}/confirm`, {
                  method: "POST",
                  body: "{}",
                }).then(() => undefined),
              "Сборка подтверждена"
            )
          }
          onClose={(id) =>
            void runPool(
              () =>
                api(`/api/v1/manufacturer/pools/${id}/close`, {
                  method: "POST",
                  body: "{}",
                }).then(() => undefined),
              "Сборка закрыта"
            )
          }
        />
      )}
      {pane === "preview" && (
        <PreviewPane skus={skus} selectedId={previewId} onSelect={setPreviewId} />
      )}
      {pane === "profile" && (
        <ProfilePane
          company={company}
          busy={busy}
          onChange={(patch) => setCompany((c) => (c ? { ...c, ...patch } : c))}
          onSave={saveCompany}
        />
      )}

      <VedDetailDrawer
        open={editorOpen}
        title={form.id ? form.name || "SKU" : "Новый SKU"}
        subtitle="Эталон производителя"
        onClose={closeEditor}
      >
        <SkuEditor
          form={form}
          busy={busy}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onSave={saveSku}
          onCancel={closeEditor}
        />
      </VedDetailDrawer>
    </VedShell>
  );
}
