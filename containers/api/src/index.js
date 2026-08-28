/**
 * Domain API extract (C1 cutover): claim/approve/create/pay/… + list/get/pdf/me/brokers/tariffs.
 * Auth: x-internal-key + x-user-id (+ optional x-user-role).
 * Web Next routes session-proxy when USE_DOMAIN_API=1.
 */
import http from "node:http";
import { PrismaClient } from "@prisma/client";
import { customsOperationsFeeRub } from "./customs-fees.js";
import {
  assembleLandedWithoutFreight,
  invoiceCustomsValue,
  landedFromAiDraft,
  mergeLandedIntoDraft,
  refreshLandedPayments,
  sumItemQty,
} from "./landed-cost.js";
import { findBestPrecedent, recordVerifiedFromApprove, listSimilarPrecedents } from "./verified-determinations.js";
import {
  isActiveSupportStatus,
  nextSupportTicketPatch,
  replySupportTicketPatch,
  supportStatusHttpCode,
  supportTicketStatusWhere,
  allowedSupportActions,
} from "./support-ticket.js";
import { handleManufacturerRoutes, ensureManufacturerCompany } from "./manufacturer-skus.js";
import { handleCatalogRoutes, hydrateItemsWithPublishedSkus } from "./catalog-skus.js";
import { handleFactoryOrderRoutes, handleManufacturerOrderRoutes } from "./sku-orders.js";
import { handleManufacturerDirectoryRoutes } from "./manufacturer-directory.js";
import { assembleTnvedCard, hsCodeAncestors } from "./tnved-card.js";
import { tnvedSearchWhere, tnvedSearchStems, scoreTnvedSearchHit } from "./tnved-helpers.js";
import { suggestProductAttrs } from "./attr-suggest.js";
import { shouldEnqueueAiDrain, runAiDrainPipeline } from "./ai-pipeline.js";
import { isAllowedMediaUrl } from "./media-url.js";
import { attachSigtermHandlers } from "./graceful-shutdown.js";

const port = Number(process.env.PORT || 4000);
const prisma = new PrismaClient();
const internalKey = process.env.INTERNAL_API_KEY || process.env.NEXTAUTH_SECRET || "";
const aiServiceUrl = (process.env.AI_SERVICE_URL || process.env.AI_URL || "http://ai:4100").replace(
  /\/$/,
  ""
);
const notifyUrl = (process.env.NOTIFY_SERVICE_URL || "").replace(/\/$/, "");
const logisticsUrl = (process.env.LOGISTICS_SERVICE_URL || "").replace(/\/$/, "");
const paymentsUrl = (process.env.PAYMENTS_SERVICE_URL || "").replace(/\/$/, "");
const ocrUrl = (process.env.OCR_SERVICE_URL || "").replace(/\/$/, "");
const llmUrl = (process.env.LLM_SERVICE_URL || "").replace(/\/$/, "");

/** Digits-only HS for TnvedCode lookup (D24). */
function normalizeHsCode(input) {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  return [2, 4, 6, 8, 10].includes(digits.length) ? digits : null;
}

const PRODUCT_ATTR_KEYS = [
  "material",
  "composition",
  "brand",
  "model",
  "purpose",
  "technicalSpecs",
  "netWeightKg",
  "grossWeightKg",
  "originCountry",
  "hsHint",
  "manufacturerName",
  "extra",
];

function hasRequiredCreateAttrs(attrs) {
  if (!attrs) return false;
  const origin = String(attrs.originCountry || "")
    .trim()
    .toUpperCase();
  return origin.length === 2 && !isEmptyAttrValue(attrs.composition);
}

function missingRequiredCreateAttrs(attrs) {
  const miss = [];
  const origin = String(attrs?.originCountry || "")
    .trim()
    .toUpperCase();
  if (origin.length !== 2) miss.push("originCountry");
  // C7 restore: if (isEmptyAttrValue(attrs?.manufacturerName)) miss.push("manufacturerName");
  if (isEmptyAttrValue(attrs?.composition)) miss.push("composition");
  return miss;
}

function requiredCreateAttrsError(miss) {
  return `Обязательны страна происхождения (ISO-2) и состав (не хватает: ${miss.join(", ")})`;
}

/** Structured product attrs on CalculationItem (D24). */
function sanitizeProductAttrs(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out = {};
  for (const key of PRODUCT_ATTR_KEYS) {
    if (raw[key] === undefined || raw[key] === null || raw[key] === "") continue;
    out[key] = raw[key];
  }
  if (out.originCountry != null && String(out.originCountry).trim().length !== 2) {
    delete out.originCountry;
  }
  if (out.extra && typeof out.extra === "object" && !Array.isArray(out.extra)) {
    const extra = {};
    for (const [k, v] of Object.entries(out.extra)) {
      if (v == null || v === "") continue;
      extra[k] = String(v).slice(0, 200);
    }
    if (Object.keys(extra).length) out.extra = extra;
    else delete out.extra;
  } else {
    delete out.extra;
  }
  return Object.keys(out).length ? out : undefined;
}

function isEmptyAttrValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/** Broker fills only empty attrs — existing client/factory values win (D15 slice). */
function fillEmptyProductAttrs(existing, patch) {
  const base = sanitizeProductAttrs(existing) || {};
  const incoming = sanitizeProductAttrs(patch);
  if (!incoming) return Object.keys(base).length ? base : undefined;
  const out = { ...base };
  for (const key of PRODUCT_ATTR_KEYS) {
    if (key === "extra") continue;
    if (!isEmptyAttrValue(out[key])) continue;
    if (!isEmptyAttrValue(incoming[key])) out[key] = incoming[key];
  }
  const baseExtra = base.extra && typeof base.extra === "object" ? { ...base.extra } : {};
  const patchExtra = incoming.extra && typeof incoming.extra === "object" ? incoming.extra : {};
  const mergedExtra = { ...baseExtra };
  for (const [k, v] of Object.entries(patchExtra)) {
    if (!isEmptyAttrValue(baseExtra[k])) continue;
    if (!isEmptyAttrValue(v)) mergedExtra[k] = v;
  }
  if (Object.keys(mergedExtra).length) out.extra = mergedExtra;
  else delete out.extra;
  return sanitizeProductAttrs(out);
}

function isBrokerQueueVisible(acceptingJobs) {
  return acceptingJobs !== false;
}

function toJsonPayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

/** Append-only CalculationEvent trail (D24). */
async function appendCalculationEvent(db, { calculationId, kind, actorUserId, payload }) {
  await db.calculationEvent.create({
    data: {
      calculationId,
      kind,
      actorUserId: actorUserId ?? null,
      payload: payload == null ? undefined : toJsonPayload(payload),
    },
  });
}

function classifyServiceError(err) {
  const name = err && typeof err === "object" ? String(err.name || "") : "";
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("timed out")
  ) {
    return "TIMEOUT";
  }
  return "FAILED";
}

async function recordServiceCallRow(opts) {
  return prisma.serviceCall.create({
    data: {
      service: opts.service,
      operation: opts.operation,
      status: opts.status || "PENDING",
      correlationId: opts.correlationId || null,
      requestMeta: opts.requestMeta || undefined,
      responseMeta: opts.responseMeta || undefined,
      durationMs: opts.durationMs,
      error: opts.error || null,
      calculationId: opts.calculationId || null,
      paymentIntentId: opts.paymentIntentId || null,
      shippingRequestId: opts.shippingRequestId || null,
      finishedAt: opts.finished === false ? null : new Date(),
    },
  });
}

async function completeServiceCallRow(id, opts) {
  return prisma.serviceCall.update({
    where: { id },
    data: {
      status: opts.status,
      responseMeta: opts.responseMeta || undefined,
      durationMs: opts.durationMs,
      error: opts.error || null,
      finishedAt: new Date(),
    },
  });
}

async function checkoutPayments(opts) {
  if (!paymentsUrl) return null;
  const call = await recordServiceCallRow({
    service: "payments",
    operation: "checkout",
    status: "PENDING",
    correlationId: opts.intentId || null,
    paymentIntentId: opts.intentId || null,
    requestMeta: {
      amountRub: opts.amountRub,
      method: opts.method || "stub",
      companyId: opts.companyId,
    },
    finished: false,
  });
  const t0 = Date.now();
  try {
    const res = await fetch(`${paymentsUrl}/v1/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountRub: opts.amountRub,
        companyId: opts.companyId,
        userId: opts.userId,
        method: opts.method || "stub",
        intentId: opts.intentId || undefined,
      }),
      signal: AbortSignal.timeout(Number(process.env.PAYMENTS_TIMEOUT_MS || 8000)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      await completeServiceCallRow(call.id, {
        status: "FAILED",
        durationMs: Date.now() - t0,
        error: `HTTP ${res.status} ${text.slice(0, 200)}`.trim(),
        responseMeta: { statusCode: res.status },
      });
      return null;
    }
    const data = await res.json();
    await completeServiceCallRow(call.id, {
      status: "OK",
      durationMs: Date.now() - t0,
      responseMeta: {
        provider: data.intent?.provider || null,
        pending: Boolean(data.pending || data.intent?.status === "pending"),
      },
    });
    return data;
  } catch (e) {
    await completeServiceCallRow(call.id, {
      status: classifyServiceError(e),
      durationMs: Date.now() - t0,
      error: e instanceof Error ? e.message : "payments checkout failed",
    }).catch(() => undefined);
    return null;
  }
}

async function getOrchestrationHealth(windowMinutes = 15) {
  const mins = Math.min(Math.max(Number(windowMinutes) || 15, 1), 180);
  const since = new Date(Date.now() - mins * 60_000);
  const calls = await prisma.serviceCall.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      service: true,
      operation: true,
      status: true,
      error: true,
      durationMs: true,
      createdAt: true,
    },
  });
  const outboxGroups = await prisma.serviceOutbox.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: { status: { in: ["PENDING", "SENDING", "FAILED", "DEAD"] } },
  });
  const byStatus = {};
  const byService = {};
  const durationAcc = {};
  for (const c of calls) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    if (!byService[c.service]) {
      byService[c.service] = { total: 0, ok: 0, failed: 0, timeout: 0, pending: 0, avgDurationMs: null };
      durationAcc[c.service] = { sum: 0, n: 0 };
    }
    const b = byService[c.service];
    b.total += 1;
    if (c.status === "OK") b.ok += 1;
    else if (c.status === "FAILED") b.failed += 1;
    else if (c.status === "TIMEOUT") b.timeout += 1;
    else if (c.status === "PENDING") b.pending += 1;
    if (typeof c.durationMs === "number") {
      durationAcc[c.service].sum += c.durationMs;
      durationAcc[c.service].n += 1;
    }
  }
  for (const [svc, b] of Object.entries(byService)) {
    const acc = durationAcc[svc];
    b.avgDurationMs = acc && acc.n > 0 ? Math.round(acc.sum / acc.n) : null;
  }
  const outbox = { pending: 0, sending: 0, failed: 0, dead: 0 };
  for (const g of outboxGroups) {
    const n = g._count._all;
    if (g.status === "PENDING") outbox.pending = n;
    else if (g.status === "SENDING") outbox.sending = n;
    else if (g.status === "FAILED") outbox.failed = n;
    else if (g.status === "DEAD") outbox.dead = n;
  }

  async function probe(service, base) {
    const url = String(base || "").replace(/\/$/, "");
    if (!url) return { service, configured: false, ok: null };
    const t0 = Date.now();
    try {
      const res = await fetch(`${url}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(Number(process.env.ORCH_HEALTH_PROBE_MS || 2500)),
      });
      return {
        service,
        configured: true,
        ok: res.ok,
        latencyMs: Date.now() - t0,
        statusCode: res.status,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (e) {
      return {
        service,
        configured: true,
        ok: false,
        latencyMs: Date.now() - t0,
        error: e instanceof Error ? e.message : "probe failed",
      };
    }
  }

  const deps = await Promise.all([
    probe("payments", paymentsUrl),
    probe("llm", process.env.LLM_SERVICE_URL),
    probe("ai", aiServiceUrl),
    probe("notify", notifyUrl),
    probe("logistics", logisticsUrl),
    probe("ocr", ocrUrl),
  ]);

  const failedCalls = (byStatus.FAILED || 0) + (byStatus.TIMEOUT || 0);
  const total = calls.length;
  const failureRateHigh = total >= 5 && failedCalls / total >= 0.35;
  const spikeFailures = failedCalls >= 5;
  const depDown = deps.some((d) => d.configured && d.ok === false);
  const outboxBacklog = outbox.dead > 0 || outbox.failed >= 10;

  return {
    ok: !depDown && !failureRateHigh && !spikeFailures && !outboxBacklog,
    windowMinutes: mins,
    since: since.toISOString(),
    calls: {
      total,
      byStatus,
      byService,
      recentFailures: calls
        .filter((c) => c.status === "FAILED" || c.status === "TIMEOUT")
        .slice(0, 10)
        .map((c) => ({
          id: c.id,
          service: c.service,
          operation: c.operation,
          status: c.status,
          error: c.error,
          durationMs: c.durationMs,
          createdAt: c.createdAt.toISOString(),
        })),
    },
    outbox,
    deps,
  };
}

async function fetchLogisticsQuotes(opts) {
  if (logisticsUrl) {
    try {
      const res = await fetch(`${logisticsUrl}/v1/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: opts.origin,
          destination: opts.destination,
          mode: opts.mode,
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.quotes) && data.quotes.length) return data.quotes;
      }
    } catch {
      /* fall through */
    }
  }
  const origin = opts.origin || "Шанхай";
  const destination = opts.destination || "Москва";
  const base = 45000 + (origin.length + destination.length) * 120;
  const quotes = [
    { id: "q_lcl", mode: "LCL", etaDays: 28, priceRub: Math.round(base * 0.85), carrierLabel: "SilkWay LCL" },
    { id: "q_fcl", mode: "FCL", etaDays: 22, priceRub: Math.round(base * 1.35), carrierLabel: "EastImport FCL 40'" },
    { id: "q_air", mode: "AIR", etaDays: 5, priceRub: Math.round(base * 2.1), carrierLabel: "AeroCargo Express" },
  ];
  const pref = (opts.mode || "LCL").toUpperCase();
  return quotes.map((q) => ({ ...q, selected: q.mode === pref }));
}

async function enqueueOutboxRow(msg) {
  return prisma.serviceOutbox.create({
    data: {
      channel: msg.channel || "email",
      template: msg.template || "generic",
      to: String(msg.to || "ops@lbm.local"),
      payload: msg.payload || {},
      status: "PENDING",
      calculationId: msg.payload?.calculationId || null,
      companyId: msg.payload?.companyId || null,
      paymentIntentId: msg.payload?.intentId || msg.payload?.paymentIntentId || null,
    },
  });
}

async function notifySend(msg) {
  let to = msg.to;
  if (to && !String(to).includes("@")) {
    const user = await prisma.user.findUnique({
      where: { id: String(to) },
      select: { email: true },
    });
    if (user?.email) to = user.email;
    else {
      const company = await prisma.company.findUnique({
        where: { id: String(to) },
        select: { contactEmail: true },
      });
      if (company?.contactEmail) to = company.contactEmail;
    }
  }
  const row = await enqueueOutboxRow({ ...msg, to: to || "ops@lbm.local" });
  if (!notifyUrl) return { ok: true, outboxId: row.id, mode: "outbox-only" };
  try {
    const res = await fetch(`${notifyUrl}/v1/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": internalKey,
      },
      body: JSON.stringify({ ...msg, to, payload: { ...(msg.payload || {}), outboxId: row.id } }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      await prisma.serviceOutbox.update({
        where: { id: row.id },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
      return await res.json().catch(() => ({ ok: true, outboxId: row.id }));
    }
    await prisma.serviceOutbox.update({
      where: { id: row.id },
      data: { status: "FAILED", lastError: `HTTP ${res.status}`, attempts: { increment: 1 } },
    });
    return null;
  } catch (e) {
    await prisma.serviceOutbox.update({
      where: { id: row.id },
      data: {
        status: "FAILED",
        lastError: e instanceof Error ? e.message : "notify failed",
        attempts: { increment: 1 },
      },
    });
    return null;
  }
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function authorize(req) {
  const key = req.headers["x-internal-key"] || "";
  if (!internalKey || key !== internalKey) return null;
  const userId = req.headers["x-user-id"];
  if (!userId || typeof userId !== "string") return null;
  const role = String(req.headers["x-user-role"] || "BROKER");
  return { userId, role };
}

function maxPositions(code) {
  if (code === "PRO") return 10;
  if (code === "STANDARD") return 3;
  return 1;
}

function sumPayments(items, feeRub, extraFeeRub = 0) {
  const dutyRub = items.reduce((s, i) => s + (i.dutyRub ?? 0), 0);
  const vatRub = items.reduce((s, i) => s + (i.vatRub ?? 0), 0);
  const extra = Math.max(0, Math.round(Number(extraFeeRub) || 0));
  return {
    dutyRub,
    vatRub,
    feeRub,
    extraFeeRub: extra,
    totalPaymentsRub: dutyRub + vatRub + feeRub + extra,
  };
}

function sanitizeBrokerItemDescription(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return t.slice(0, 5000);
}

function normalizeExtraFee(extraFeeRub, extraFeeNote) {
  const n = Math.max(0, Math.round(Number(extraFeeRub) || 0));
  const note = String(extraFeeNote || "").trim().slice(0, 500) || null;
  if (n > 0 && !note) throw new Error("Укажите, за что прочие сборы");
  return { extraFeeRub: n, extraFeeNote: n > 0 ? note : null };
}

function brokerItemData(row, now, existingAttrs) {
  const data = {
    hsCodeFinal: row.hsCodeFinal,
    tnvedCode: normalizeHsCode(row.hsCodeFinal),
    dutyRub: row.dutyRub,
    vatRub: row.vatRub,
    unitPrice: row.unitPrice,
    confirmedByBrokerAt: now,
  };
  if (row.description !== undefined) {
    data.description = sanitizeBrokerItemDescription(row.description);
  }
  if (row.attrs !== undefined) {
    const merged = fillEmptyProductAttrs(existingAttrs, row.attrs);
    data.attrs = merged || null;
  }
  return data;
}

function isPreferredExclusive(calc, preferredClaimHours, now = new Date()) {
  if (!calc.preferredBrokerUserId || !calc.queuedAt) return false;
  const deadline = new Date(calc.queuedAt.getTime() + preferredClaimHours * 3600_000);
  return now < deadline;
}

async function preferredClaimHours() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "ved.preferredClaimHours" } });
  const sla = await prisma.siteSetting.findUnique({ where: { key: "ved.defaultSlaHours" } });
  const n = (v, fb) => (typeof v?.value === "number" ? v.value : fb);
  return n(row, n(sla, 4));
}

/** Mirror src/lib/ved/ledger.creditCompany — FOR UPDATE + optional after (D23). */
async function creditCompany(opts) {
  if (!opts.amountRub) throw new Error("amount must be non-zero");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "companies" WHERE id = ${opts.companyId} FOR UPDATE`;
    const company = await tx.company.findUniqueOrThrow({ where: { id: opts.companyId } });
    const balanceAfter = company.balanceRub + opts.amountRub;
    if (balanceAfter < 0) throw new Error("Insufficient balance");
    await tx.company.update({
      where: { id: opts.companyId },
      data: { balanceRub: balanceAfter },
    });
    const entry = await tx.ledgerEntry.create({
      data: {
        companyId: opts.companyId,
        kind: opts.kind,
        amountRub: opts.amountRub,
        balanceAfter,
        description: opts.description,
        calculationId: opts.calculationId,
        createdById: opts.createdById,
      },
    });
    if (typeof opts.after === "function") {
      return opts.after(tx, entry);
    }
    return entry;
  });
}

const PAID_STATUSES = ["QUEUED", "IN_REVIEW", "DONE", "SLA_RISK"];
const CLAIMABLE_STATUSES = ["QUEUED", "SLA_RISK"];

function canTransition(from, to) {
  const allowed = {
    DRAFT: ["AI_PROCESSING", "CANCELLED"],
    AI_PROCESSING: ["AI_READY", "CANCELLED"],
    AI_READY: ["AWAITING_PAYMENT", "QUEUED", "DONE", "CANCELLED"],
    AWAITING_PAYMENT: ["QUEUED", "DONE", "CANCELLED"],
    QUEUED: ["IN_REVIEW", "SLA_RISK", "CANCELLED"],
    IN_REVIEW: ["DONE", "SLA_RISK", "QUEUED", "CANCELLED"],
    DONE: [],
    SLA_RISK: ["IN_REVIEW", "QUEUED", "DONE", "CANCELLED"],
    CANCELLED: [],
  };
  return (allowed[from] || []).includes(to);
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal status transition ${from} → ${to}`);
  }
}

const SETTING_KEYS = {
  confidenceThreshold: "ved.confidenceThreshold",
  defaultSlaHours: "ved.defaultSlaHours",
  preferredClaimHours: "ved.preferredClaimHours",
  usdRate: "ved.usdRate",
  cnyRate: "ved.cnyRate",
  eurRate: "ved.eurRate",
  fxBufferPct: "ved.fxBufferPct",
  marketplaceEnabled: "ved.marketplaceEnabled",
  autoAssignBrokers: "ved.autoAssignBrokers",
  maintenanceMode: "ved.maintenanceMode",
  paymentsEnabled: "ved.paymentsEnabled",
  llmEnrichEnabled: "ved.llmEnrichEnabled",
  notifyEnabled: "ved.notifyEnabled",
  mockTopupAllowed: "ved.mockTopupAllowed",
};

async function getPlatformSettings() {
  const keys = Object.values(SETTING_KEYS);
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const num = (key, fb) => (typeof map[key] === "number" ? map[key] : fb);
  const bool = (key, fb) => (typeof map[key] === "boolean" ? map[key] : fb);
  const defaultSlaHours = num(SETTING_KEYS.defaultSlaHours, 4);
  return {
    confidenceThreshold: num(SETTING_KEYS.confidenceThreshold, 0.75),
    defaultSlaHours,
    preferredClaimHours: num(SETTING_KEYS.preferredClaimHours, defaultSlaHours),
    usdRate: num(SETTING_KEYS.usdRate, 90),
    cnyRate: num(SETTING_KEYS.cnyRate, 12.5),
    eurRate: num(SETTING_KEYS.eurRate, 98),
    fxBufferPct: num(SETTING_KEYS.fxBufferPct, 2),
    marketplaceEnabled: bool(SETTING_KEYS.marketplaceEnabled, true),
    autoAssignBrokers: bool(SETTING_KEYS.autoAssignBrokers, true),
    maintenanceMode: bool(SETTING_KEYS.maintenanceMode, false),
    paymentsEnabled: bool(SETTING_KEYS.paymentsEnabled, true),
    llmEnrichEnabled: bool(SETTING_KEYS.llmEnrichEnabled, true),
    notifyEnabled: bool(SETTING_KEYS.notifyEnabled, true),
    mockTopupAllowed: bool(SETTING_KEYS.mockTopupAllowed, true),
  };
}

async function setPlatformSetting(key, value) {
  return prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

function expressPdfHtml(calc) {
  const landed = landedFromAiDraft(calc.aiDraft);
  const landedLines = landed
    ? `<p>Товар (инвойс) ${landed.goodsRub} ₽</p><p>Итого без доставки ${landed.landedRub} ₽</p>${
        landed.perUnitRub != null ? `<p>На единицу ${landed.perUnitRub} ₽</p>` : ""
      }`
    : "";
  return `<html><body><h1>LBM Брокер · ${calc.number}</h1><h2>Сопоставление позиций</h2><p>${calc.hsCode || ""}</p>${landedLines}</body></html>`;
}

async function claim(id, user) {
  const calc = await prisma.calculation.findUniqueOrThrow({ where: { id } });
  if (!CLAIMABLE_STATUSES.includes(calc.status)) {
    throw new Error(`Cannot claim from ${calc.status}`);
  }
  assertTransition(calc.status, "IN_REVIEW");
  if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    const profile = await prisma.brokerProfile.findUnique({
      where: { userId: user.userId },
      select: { acceptingJobs: true },
    });
    if (profile && profile.acceptingJobs === false) {
      throw new Error("Broker is not accepting jobs");
    }
  }
  const hours = await preferredClaimHours();
  const exclusive = isPreferredExclusive(calc, hours);
  if (
    exclusive &&
    calc.preferredBrokerUserId &&
    calc.preferredBrokerUserId !== user.userId &&
    !["ADMIN", "SUPER_ADMIN"].includes(user.role)
  ) {
    throw new Error("Reserved for preferred broker");
  }
  const clearPreferred =
    calc.preferredBrokerUserId && calc.preferredBrokerUserId !== user.userId && !exclusive;

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.calculation.updateMany({
      where: { id, status: { in: CLAIMABLE_STATUSES } },
      data: {
        status: "IN_REVIEW",
        brokerUserId: user.userId,
        claimedAt: new Date(),
        ...(clearPreferred ? { preferredBrokerUserId: null } : {}),
      },
    });
    if (claimed.count === 0) {
      throw new Error("Claim conflict");
    }
    const row = await tx.calculation.findUniqueOrThrow({
      where: { id },
      include: { items: true, tariff: true },
    });
    await tx.brokerAssignment.create({
      data: { calculationId: id, brokerUserId: user.userId, kind: "CLAIM" },
    });
    const thread = await tx.chatThread.findFirst({
      where: { calculationId: id, kind: "CALCULATION" },
    });
    if (!thread) {
      await tx.chatThread.create({
        data: {
          kind: "CALCULATION",
          calculationId: id,
          subject: `Чат · ${calc.number}`,
          waitingOn: "BROKER",
        },
      });
    }
    await appendCalculationEvent(tx, {
      calculationId: id,
      kind: "CLAIMED",
      actorUserId: user.userId,
      payload: { from: calc.status, to: "IN_REVIEW" },
    });
    return row;
  });
}

async function approve(id, user, body) {
  const calc = await prisma.calculation.findUniqueOrThrow({
    where: { id },
    include: { items: true, tariff: true },
  });
  if (
    calc.brokerUserId !== user.userId &&
    !["ADMIN", "SUPER_ADMIN"].includes(user.role)
  ) {
    throw new Error("Forbidden");
  }
  if (!["IN_REVIEW", "SLA_RISK"].includes(calc.status)) {
    throw new Error(`Cannot approve from ${calc.status}`);
  }
  assertTransition(calc.status, "DONE");
  if (!calc.items.length) throw new Error("Calculation has no items");
  const maxPos = maxPositions(calc.tariff?.code);
  if (calc.items.length > maxPos) throw new Error(`Too many positions (max ${maxPos})`);

  const feeRub = body.feeRub ?? calc.feeRub ?? 0;
  const extra = normalizeExtraFee(
    body.extraFeeRub ?? calc.extraFeeRub,
    body.extraFeeNote !== undefined ? body.extraFeeNote : calc.extraFeeNote
  );
  const owned = new Set(calc.items.map((i) => i.id));

  if (Array.isArray(body.items) && body.items.length) {
    for (const row of body.items) {
      if (!row.id || row.id === "synthetic" || !owned.has(row.id)) {
        throw new Error(`Invalid item id: ${row.id}`);
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    let dutyRub = body.dutyRub ?? calc.dutyRub ?? 0;
    let vatRub = body.vatRub ?? calc.vatRub ?? 0;

    if (Array.isArray(body.items) && body.items.length) {
      const now = new Date();
      const existingById = new Map(
        calc.items.map((i) => [i.id, sanitizeProductAttrs(i.attrs) || null])
      );
      for (const row of body.items) {
        await tx.calculationItem.update({
          where: { id: row.id },
          data: brokerItemData(row, now, existingById.get(row.id) || null),
        });
      }
      const refreshed = await tx.calculationItem.findMany({ where: { calculationId: id } });
      const summed = sumPayments(refreshed, feeRub, extra.extraFeeRub);
      dutyRub = summed.dutyRub;
      vatRub = summed.vatRub;
    }

    const items = await tx.calculationItem.findMany({
      where: { calculationId: id },
      orderBy: { sortOrder: "asc" },
    });
    const totalPaymentsRub = dutyRub + vatRub + feeRub + extra.extraFeeRub;
    const hs = body.hsCodeFinal || calc.hsCode || "";
    const itemRows = items
      .map((it) => {
        const desc = it.description ? `<div>${it.description}</div>` : "";
        return `<tr><td>${it.name}${desc}</td><td>${it.hsCodeAi || ""}</td><td>${it.hsCodeFinal || ""}</td><td>${it.dutyRub ?? 0}</td><td>${it.vatRub ?? 0}</td></tr>`;
      })
      .join("");
    const extraLine =
      extra.extraFeeRub > 0
        ? `<p>Прочие сборы ${extra.extraFeeRub} ₽ · ${extra.extraFeeNote || ""}</p>`
        : "";
    const landed = refreshLandedPayments(landedFromAiDraft(calc.aiDraft), {
      dutyRub,
      vatRub,
      feeRub,
      extraFeeRub: extra.extraFeeRub,
      qty: sumItemQty(items),
    });
    const landedLines = landed
      ? `<p>Товар (инвойс) ${landed.goodsRub} ₽</p><p>Итого без доставки ${landed.landedRub} ₽</p>${
          landed.perUnitRub != null ? `<p>На единицу ${landed.perUnitRub} ₽</p>` : ""
        }`
      : "";
    const pdfHtml = `<html><body><h1>LBM Брокер · ${calc.number}</h1><p>HS ${hs}</p>${landedLines}<h2>Сопоставление позиций</h2><table>${itemRows}</table><p>Сбор ${feeRub} ₽</p>${extraLine}<p>Итого ${totalPaymentsRub} ₽</p></body></html>`;
    const nextDraft = mergeLandedIntoDraft(calc.aiDraft, landed);

    const row = await tx.calculation.update({
      where: { id },
      data: {
        status: "DONE",
        hsCodeFinal: hs,
        brokerComment: body.comment,
        dutyRub,
        vatRub,
        feeRub,
        extraFeeRub: extra.extraFeeRub,
        extraFeeNote: extra.extraFeeNote,
        totalPaymentsRub,
        doneAt: new Date(),
        pdfHtml,
        aiDraft: nextDraft,
      },
      include: { items: true, tariff: true },
    });
    await appendCalculationEvent(tx, {
      calculationId: id,
      kind: "APPROVED",
      actorUserId: user.userId,
      payload: { from: calc.status, to: "DONE", note: hs },
    });
    return row;
  });

  if (calc.tariffId) {
    await prisma.$transaction(async (tx) => {
      const tariff = await tx.tariffPlan.findUnique({ where: { id: calc.tariffId } });
      const profile = await tx.brokerProfile.findUnique({ where: { userId: user.userId } });
      if (tariff && profile && tariff.brokerSharePct > 0) {
        const amount = Math.round((tariff.priceRub * tariff.brokerSharePct) / 100);
        const periodLabel = new Date().toLocaleString("ru-RU", { month: "long", year: "numeric" });
        const existing = await tx.brokerPayout.findFirst({
          where: { brokerProfileId: profile.id, periodLabel, status: "ACCRUED" },
        });
        if (existing) {
          await tx.brokerPayout.update({
            where: { id: existing.id },
            data: { amountRub: existing.amountRub + amount, jobsCount: existing.jobsCount + 1 },
          });
        } else {
          await tx.brokerPayout.create({
            data: {
              brokerProfileId: profile.id,
              periodLabel,
              amountRub: amount,
              jobsCount: 1,
              status: "ACCRUED",
            },
          });
        }
      }
    });
  }

  await notifySend({
    channel: "email",
    template: "calc.approved",
    to: calc.clientUserId,
    payload: { calculationId: id, number: calc.number, status: "DONE" },
  });

  try {
    await recordVerifiedFromApprove(prisma, {
      calculationId: id,
      approvedByUserId: user.userId,
      brokerComment: body.comment,
      title: calc.title,
      quality: calc.clientFeedbackReaction === "HELPFUL" ? "CLIENT_HELPFUL" : "BROKER",
      items: updated.items.map((i) => ({
        name: i.name,
        description: i.description,
        attrs: i.attrs,
        hsCodeFinal: i.hsCodeFinal || body.hsCodeFinal || calc.hsCode || "",
        dutyRub: i.dutyRub,
        vatRub: i.vatRub,
        feeRub: updated.feeRub,
        itemId: i.id,
      })),
    });
  } catch {
    /* fail-open */
  }

  return updated;
}

async function slaTick() {
  const now = new Date();
  const hours = await preferredClaimHours();
  const overdue = await prisma.calculation.findMany({
    where: { status: { in: ["QUEUED", "IN_REVIEW"] }, slaDeadline: { lt: now } },
    select: { id: true, number: true, brokerUserId: true, status: true },
  });
  for (const row of overdue) {
    assertTransition(row.status, "SLA_RISK");
    await prisma.calculation.update({ where: { id: row.id }, data: { status: "SLA_RISK" } });
    await notifySend({
      channel: "email",
      template: "calc.sla_risk",
      to: row.brokerUserId || "ops",
      payload: { calculationId: row.id, number: row.number },
    });
  }
  const preferred = await prisma.calculation.findMany({
    where: {
      status: { in: ["QUEUED", "SLA_RISK"] },
      preferredBrokerUserId: { not: null },
      queuedAt: { not: null },
    },
  });
  let releasedPreferred = 0;
  for (const row of preferred) {
    if (!isPreferredExclusive(row, hours, now)) {
      await prisma.calculation.update({
        where: { id: row.id },
        data: { preferredBrokerUserId: null },
      });
      releasedPreferred += 1;
    }
  }
  return { escalated: overdue.length, releasedPreferred, at: now.toISOString() };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  try {
    if (url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "api", domain: true });
    }

    if (req.method === "POST" && url.pathname === "/v1/internal/sla-tick") {
      const key = req.headers["x-internal-key"] || "";
      if (!internalKey || key !== internalKey) return json(res, 401, { error: "Unauthorized" });
      return json(res, 200, await slaTick());
    }

    if (req.method === "POST" && url.pathname === "/v1/internal/outbox/drain") {
      const key = req.headers["x-internal-key"] || "";
      if (!internalKey || key !== internalKey) return json(res, 401, { error: "Unauthorized" });
      const body = await readBody(req);
      const limit = Number(body.limit) || 20;
      const now = new Date();
      const candidates = await prisma.serviceOutbox.findMany({
        where: { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: now } },
        orderBy: { createdAt: "asc" },
        take: limit * 2,
      });
      let delivered = 0;
      let failed = 0;
      let claimed = 0;
      for (const row of candidates) {
        if (claimed >= limit) break;
        const lock = await prisma.serviceOutbox.updateMany({
          where: { id: row.id, status: { in: ["PENDING", "FAILED"] } },
          data: { status: "SENDING", attempts: { increment: 1 } },
        });
        if (lock.count !== 1) continue;
        claimed += 1;
        const msg = await prisma.serviceOutbox.findUnique({ where: { id: row.id } });
        if (!msg) continue;
        if (!notifyUrl) {
          const resendKey = process.env.RESEND_API_KEY || "";
          const from = process.env.SMTP_FROM || "noreply@lbm.local";
          if (!resendKey) {
            const attempts = msg.attempts;
            const dead = attempts >= 5;
            await prisma.serviceOutbox.update({
              where: { id: msg.id },
              data: {
                status: dead ? "DEAD" : "FAILED",
                lastError: "no NOTIFY_SERVICE_URL and no RESEND_API_KEY",
                nextAttemptAt: dead ? undefined : new Date(Date.now() + Math.min(attempts, 10) * 60_000),
              },
            });
            failed += 1;
            continue;
          }
          try {
            const subject = `Notify ${msg.template || ""}`.trim();
            const text =
              typeof msg.payload === "object" && msg.payload
                ? JSON.stringify(msg.payload, null, 2)
                : String(msg.payload || msg.template || "");
            const resSend = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ from, to: [msg.to], subject, text }),
              signal: AbortSignal.timeout(8000),
            });
            if (!resSend.ok) {
              const err = await resSend.text().catch(() => "");
              throw new Error(`resend ${resSend.status}: ${err.slice(0, 200)}`);
            }
            await prisma.serviceOutbox.update({
              where: { id: msg.id },
              data: { status: "DELIVERED", deliveredAt: new Date(), lastError: null },
            });
            delivered += 1;
          } catch (e) {
            const attempts = msg.attempts;
            const dead = attempts >= 5;
            await prisma.serviceOutbox.update({
              where: { id: msg.id },
              data: {
                status: dead ? "DEAD" : "FAILED",
                lastError: e instanceof Error ? e.message : "inline send failed",
                nextAttemptAt: dead ? undefined : new Date(Date.now() + Math.min(attempts, 10) * 60_000),
              },
            });
            failed += 1;
          }
          continue;
        }
        try {
          const resSend = await fetch(`${notifyUrl}/v1/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-key": internalKey },
            body: JSON.stringify({
              channel: msg.channel,
              template: msg.template,
              to: msg.to,
              payload: { ...(msg.payload || {}), outboxId: msg.id },
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (!resSend.ok) throw new Error(`HTTP ${resSend.status}`);
          const payload = await resSend.json().catch(() => ({}));
          if (
            payload?.delivery?.skipped ||
            payload?.status === "queued" ||
            payload?.deliveryStatus === "PENDING"
          ) {
            throw new Error(
              payload?.delivery?.skipped
                ? `notify skipped: ${JSON.stringify(payload.delivery).slice(0, 120)}`
                : "notify did not confirm delivery"
            );
          }
          await prisma.serviceOutbox.update({
            where: { id: msg.id },
            data: { status: "DELIVERED", deliveredAt: new Date(), lastError: null },
          });
          delivered += 1;
        } catch (e) {
          const attempts = msg.attempts;
          const dead = attempts >= 5;
          await prisma.serviceOutbox.update({
            where: { id: msg.id },
            data: {
              status: dead ? "DEAD" : "FAILED",
              lastError: e instanceof Error ? e.message : "send failed",
              nextAttemptAt: dead ? undefined : new Date(Date.now() + Math.min(attempts, 10) * 60_000),
            },
          });
          failed += 1;
        }
      }
      return json(res, 200, { claimed, delivered, failed });
    }

    if (req.method === "GET" && url.pathname === "/v1/internal/orch/health") {
      const key = req.headers["x-internal-key"] || "";
      if (!internalKey || key !== internalKey) return json(res, 401, { error: "Unauthorized" });
      const windowMinutes = Number(url.searchParams.get("windowMinutes")) || 15;
      const health = await getOrchestrationHealth(windowMinutes);
      return json(res, health.ok ? 200 : 503, health);
    }

    if (req.method === "GET" && url.pathname === "/v1/internal/jobs") {
      const key = req.headers["x-internal-key"] || "";
      if (!internalKey || key !== internalKey) return json(res, 401, { error: "Unauthorized" });
      const jobs = await prisma.backgroundJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
      return json(res, 200, { jobs });
    }

    if (req.method === "POST" && url.pathname === "/v1/internal/jobs") {
      const key = req.headers["x-internal-key"] || "";
      if (!internalKey || key !== internalKey) return json(res, 401, { error: "Unauthorized" });
      const body = await readBody(req);
      const action = body.action || "enqueue";
      if (action === "claim") {
        const limit = Number(body.limit) || 5;
        const lockedBy = body.lockedBy || "worker";
        const now = new Date();
        const candidates = await prisma.backgroundJob.findMany({
          where: {
            status: "QUEUED",
            runAfter: { lte: now },
            ...(Array.isArray(body.kinds) && body.kinds.length ? { kind: { in: body.kinds } } : {}),
          },
          orderBy: { createdAt: "asc" },
          take: limit * 3,
        });
        const jobs = [];
        for (const row of candidates) {
          if (jobs.length >= limit) break;
          const u = await prisma.backgroundJob.updateMany({
            where: { id: row.id, status: "QUEUED" },
            data: { status: "RUNNING", lockedAt: now, lockedBy, attempts: { increment: 1 } },
          });
          if (u.count === 1) {
            jobs.push(await prisma.backgroundJob.findUnique({ where: { id: row.id } }));
          }
        }
        return json(res, 200, { jobs });
      }
      if (action === "finish") {
        if (!body.id) return json(res, 400, { error: "id required" });
        const job = await prisma.backgroundJob.findUnique({ where: { id: body.id } });
        if (!job) return json(res, 404, { error: "not found" });
        if (body.ok) {
          const updated = await prisma.backgroundJob.update({
            where: { id: body.id },
            data: {
              status: "DONE",
              result: body.result || {},
              finishedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
            },
          });
          return json(res, 200, { job: updated });
        }
        const dead = job.attempts >= job.maxAttempts;
        const updated = await prisma.backgroundJob.update({
          where: { id: body.id },
          data: {
            status: dead ? "DEAD" : "QUEUED",
            lastError: body.error || "failed",
            runAfter: dead ? undefined : new Date(Date.now() + Math.min(job.attempts, 10) * 30_000),
            lockedAt: null,
            lockedBy: null,
            finishedAt: dead ? new Date() : undefined,
          },
        });
        return json(res, 200, { job: updated });
      }
      if (!body.kind) return json(res, 400, { error: "kind required" });
      const job = await prisma.backgroundJob.create({
        data: {
          kind: body.kind,
          payload: body.payload || {},
          status: "QUEUED",
          calculationId: body.calculationId || null,
          paymentIntentId: body.paymentIntentId || null,
        },
      });
      return json(res, 200, { job });
    }

    if (req.method === "POST" && url.pathname === "/v1/internal/ai-drain") {
      const key = req.headers["x-internal-key"] || "";
      if (!internalKey || key !== internalKey) return json(res, 401, { error: "Unauthorized" });
      const body = await readBody(req);
      const calculationId = body.calculationId;
      if (!calculationId) return json(res, 400, { error: "calculationId required" });
      const result = await runAiDrainPipeline(prisma, {
        calculationId,
        recordCall: recordServiceCallRow,
        completeCall: completeServiceCallRow,
      });
      return json(res, result.ok ? 200 : 502, result);
    }

    // C4: payments webhook → LedgerEntry TOPUP (idempotent on paymentIntentId)
    if (req.method === "POST" && url.pathname === "/v1/webhooks/payments") {
      const key = req.headers["x-internal-key"] || "";
      if (!internalKey || key !== internalKey) return json(res, 401, { error: "Unauthorized" });
      const body = await readBody(req);
      const companyId = body.companyId;
      const amount = Number(body.amountRub);
      if (!companyId || !amount || amount <= 0) {
        return json(res, 400, { error: "companyId and amountRub required" });
      }
      const intentId = body.intentId || body.id || null;
      if (intentId) {
        const byIntent = await prisma.ledgerEntry.findFirst({
          where: { paymentIntentId: intentId },
        });
        if (byIntent) {
          const company = await prisma.company.findUnique({ where: { id: companyId } });
          return json(res, 200, { ok: true, deduped: true, entry: byIntent, company });
        }
      }
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "companies" WHERE id = ${companyId} FOR UPDATE`;
        const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
        const balanceAfter = company.balanceRub + amount;
        await tx.company.update({
          where: { id: companyId },
          data: { balanceRub: balanceAfter },
        });
        if (intentId) {
          await tx.paymentIntent.updateMany({
            where: { id: intentId },
            data: {
              status: "SUCCEEDED",
              paidAt: new Date(),
              provider: body.provider || "stub",
            },
          });
        }
        const entry = await tx.ledgerEntry.create({
          data: {
            companyId,
            amountRub: amount,
            balanceAfter,
            kind: "TOPUP",
            description: `Эквайринг TOPUP${intentId ? ` · ${intentId}` : ""} (${body.provider || "stub"})`,
            createdById: body.userId || null,
            paymentIntentId: intentId,
          },
        });
        return { entry, company: { ...company, balanceRub: balanceAfter } };
      });
      await notifySend({
        channel: "email",
        template: "ledger.topup",
        to: companyId,
        payload: { amountRub: amount, intentId },
      });
      return json(res, 200, { ok: true, ...result });
    }

    const claimMatch = url.pathname.match(/^\/v1\/calculations\/([^/]+)\/claim$/);
    if (req.method === "POST" && claimMatch) {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      return json(res, 200, await claim(claimMatch[1], user));
    }

    const approveMatch = url.pathname.match(/^\/v1\/calculations\/([^/]+)\/approve$/);
    if (req.method === "POST" && approveMatch) {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const body = await readBody(req);
      return json(res, 200, await approve(approveMatch[1], user, body));
    }

    const reclassifyMatch = url.pathname.match(/^\/v1\/calculations\/([^/]+)\/reclassify$/);
    if (req.method === "POST" && reclassifyMatch) {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["BROKER", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const body = await readBody(req);
      const feedback = String(body.brokerFeedback || "").trim();
      if (feedback.length < 3) return json(res, 400, { error: "brokerFeedback required" });
      const calc = await prisma.calculation.findUnique({
        where: { id: reclassifyMatch[1] },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      if (!calc) return json(res, 404, { error: "Not found" });
      if (
        calc.brokerUserId !== user.userId &&
        !["ADMIN", "SUPER_ADMIN"].includes(user.role)
      ) {
        return json(res, 403, { error: "Forbidden" });
      }
      if (!["IN_REVIEW", "SLA_RISK"].includes(calc.status)) {
        return json(res, 400, { error: `Cannot reclassify from ${calc.status}` });
      }
      const settings = await getPlatformSettings();
      if (!settings.llmEnrichEnabled) return json(res, 400, { error: "LLM enrich disabled" });
      if (!llmUrl) return json(res, 400, { error: "LLM_SERVICE_URL not configured" });
      const targets = body.itemId
        ? calc.items.filter((i) => i.id === body.itemId)
        : calc.items;
      if (!targets.length) return json(res, 400, { error: "No items" });
      try {
        const updates = [];
        for (const item of targets) {
          const description = [
            item.description || calc.description || item.name,
            `Комментарий брокера (переклассификация): ${feedback}`,
          ].join("\n\n");
          const cRes = await fetch(`${llmUrl}/v1/classify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: item.name || calc.title,
              description,
              country: calc.country,
            }),
            signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 30000)),
          });
          if (!cRes.ok) throw new Error(`LLM ${cRes.status}`);
          const classified = await cRes.json();
          if (!classified.hsCode) throw new Error("empty hsCode");
          updates.push({
            id: item.id,
            hsCodeAi: classified.hsCode,
            confidence: classified.confidence,
            engine: classified.engine || "llm-openai-v1",
          });
        }
        const primary = updates[0];
        const draft = calc.aiDraft && typeof calc.aiDraft === "object" ? calc.aiDraft : {};
        const row = await prisma.$transaction(async (tx) => {
          for (const u of updates) {
            await tx.calculationItem.update({
              where: { id: u.id },
              data: { hsCodeAi: u.hsCodeAi },
            });
          }
          const updated = await tx.calculation.update({
            where: { id: calc.id },
            data: {
              hsCode: primary.hsCodeAi,
              confidence: primary.confidence ?? calc.confidence,
              aiDraft: {
                ...draft,
                hsCode: primary.hsCodeAi,
                confidence: primary.confidence,
                llmEnrich: primary.engine,
                reclassifyFeedback: feedback.slice(0, 500),
              },
            },
            include: { items: true, tariff: true },
          });
          await appendCalculationEvent(tx, {
            calculationId: calc.id,
            kind: "NOTE",
            actorUserId: user.userId,
            payload: {
              note: "reclassify",
              feedback: feedback.slice(0, 300),
              hsCodes: updates.map((u) => ({ id: u.id, hsCodeAi: u.hsCodeAi })),
            },
          });
          return updated;
        });
        return json(res, 200, row);
      } catch (e) {
        return json(res, 400, {
          error: e instanceof Error ? e.message : "Reclassify failed",
        });
      }
    }

    if (req.method === "GET" && url.pathname === "/v1/chat") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const calculationId = url.searchParams.get("calculationId");
      const threadId = url.searchParams.get("threadId");
      const scope = url.searchParams.get("scope");
      const box = url.searchParams.get("box");
      if (scope === "threads" && user.role === "BROKER") {
        const threads = await prisma.chatThread.findMany({
          where: {
            kind: "CALCULATION",
            calculation: {
              brokerUserId: user.userId,
              status: { in: ["IN_REVIEW", "DONE", "SLA_RISK"] },
            },
          },
          include: {
            calculation: {
              select: {
                id: true,
                number: true,
                title: true,
                status: true,
                clientUser: { select: { name: true } },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { author: { select: { id: true, name: true, role: true } } },
            },
          },
          orderBy: { updatedAt: "desc" },
        });
        return json(res, 200, threads);
      }
      if (scope === "support") {
        if (["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
          const threads = await prisma.chatThread.findMany({
            where: { kind: "SUPPORT", ...(box ? supportTicketStatusWhere(box) : {}) },
            include: {
              messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { author: { select: { id: true, name: true, role: true } } },
              },
              createdByUser: { select: { id: true, name: true, email: true } },
              company: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 100,
          });
          return json(res, 200, threads);
        }
        if (user.role !== "CLIENT") return json(res, 403, { error: "Forbidden" });
        const me = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { companyId: true },
        });
        const or = [
          { createdByUserId: user.userId },
          { messages: { some: { authorId: user.userId } } },
        ];
        if (me?.companyId) or.push({ companyId: me.companyId });
        const threads = await prisma.chatThread.findMany({
          where: { kind: "SUPPORT", OR: or, ...supportTicketStatusWhere(box || "active") },
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { author: { select: { id: true, name: true, role: true } } },
            },
          },
          orderBy: { updatedAt: "desc" },
        });
        return json(res, 200, threads);
      }
      if (scope === "unread" && user.role === "CLIENT") {
        const me = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { companyId: true },
        });
        const or = [
          { createdByUserId: user.userId },
          { messages: { some: { authorId: user.userId } } },
        ];
        if (me?.companyId) or.push({ companyId: me.companyId });
        const [calcUnread, supportUnread] = await Promise.all([
          prisma.chatThread.count({
            where: {
              kind: "CALCULATION",
              waitingOn: "CLIENT",
              calculation: { clientUserId: user.userId },
            },
          }),
          prisma.chatThread.count({
            where: {
              kind: "SUPPORT",
              waitingOn: "CLIENT",
              ticketStatus: { in: ["OPEN", "WAITING_CLIENT"] },
              OR: or,
            },
          }),
        ]);
        return json(res, 200, { count: calcUnread + supportUnread });
      }
      if (scope === "unread" && user.role === "BROKER") {
        const count = await prisma.chatThread.count({
          where: {
            kind: "CALCULATION",
            waitingOn: "BROKER",
            calculation: {
              brokerUserId: user.userId,
              status: { in: ["IN_REVIEW", "DONE", "SLA_RISK"] },
            },
          },
        });
        return json(res, 200, { count });
      }
      if (scope === "unread" && ["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        const count = await prisma.chatThread.count({
          where: { kind: "SUPPORT", waitingOn: "BROKER", ticketStatus: "OPEN" },
        });
        return json(res, 200, { count });
      }
      if (threadId) {
        const thread = await prisma.chatThread.findFirst({
          where: { id: threadId, kind: "SUPPORT" },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              include: { author: { select: { id: true, name: true, role: true } } },
            },
            createdByUser: { select: { id: true, name: true, email: true } },
            company: { select: { id: true, name: true } },
          },
        });
        if (!thread) return json(res, 404, { error: "Not found" });
        if (user.role === "CLIENT") {
          const me = await prisma.user.findUnique({
            where: { id: user.userId },
            select: { companyId: true },
          });
          const allowed =
            thread.createdByUserId === user.userId ||
            (me?.companyId && thread.companyId === me.companyId) ||
            thread.messages.some((m) => m.authorId === user.userId);
          if (!allowed) return json(res, 403, { error: "Forbidden" });
        } else if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
          return json(res, 403, { error: "Forbidden" });
        }
        return json(res, 200, thread);
      }
      if (!calculationId) return json(res, 400, { error: "calculationId required" });
      const thread = await prisma.chatThread.findFirst({
        where: { calculationId, kind: "CALCULATION" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: { author: { select: { id: true, name: true, role: true } } },
          },
        },
      });
      return json(res, 200, thread);
    }

    if (req.method === "POST" && url.pathname === "/v1/chat") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const body = await readBody(req);
      if (body.kind === "SUPPORT") {
        if (user.role !== "CLIENT" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
          return json(res, 403, { error: "Forbidden" });
        }
        const subject = String(body.subject || "").slice(0, 200);
        const text = String(body.body || "");
        if (!subject || !text) return json(res, 400, { error: "subject and body required" });
        const result = await prisma.$transaction(async (tx) => {
          const me = await tx.user.findUnique({
            where: { id: user.userId },
            select: { companyId: true },
          });
          const thread = await tx.chatThread.create({
            data: {
              kind: "SUPPORT",
              subject,
              waitingOn: "BROKER",
              ticketStatus: "OPEN",
              companyId: me?.companyId || null,
              createdByUserId: user.userId,
            },
          });
          const message = await tx.chatMessage.create({
            data: { threadId: thread.id, authorId: user.userId, body: text },
            include: { author: { select: { id: true, name: true, role: true } } },
          });
          return { thread, message, waitingOn: "BROKER", ticketStatus: "OPEN" };
        });
        return json(res, 201, result);
      }
      if (body.kind === "SUPPORT_REPLY") {
        if (!["ADMIN", "SUPER_ADMIN", "CLIENT"].includes(user.role)) {
          return json(res, 403, { error: "Forbidden" });
        }
        const text = String(body.body || "");
        const tid = String(body.threadId || "");
        if (!tid || !text) return json(res, 400, { error: "threadId and body required" });
        const existing = await prisma.chatThread.findFirst({
          where: { id: tid, kind: "SUPPORT" },
        });
        if (!existing) return json(res, 404, { error: "Support thread not found" });
        if (!isActiveSupportStatus(existing.ticketStatus)) {
          return json(res, 409, { error: "Ticket is closed" });
        }
        if (user.role === "CLIENT") {
          const me = await prisma.user.findUnique({
            where: { id: user.userId },
            select: { companyId: true },
          });
          const allowed =
            existing.createdByUserId === user.userId ||
            (me?.companyId && existing.companyId === me.companyId);
          if (!allowed) return json(res, 403, { error: "Forbidden" });
        }
        const waitingOn = user.role === "CLIENT" ? "BROKER" : "CLIENT";
        const patch = replySupportTicketPatch(waitingOn);
        const message = await prisma.chatMessage.create({
          data: { threadId: tid, authorId: user.userId, body: text },
          include: { author: { select: { id: true, name: true, role: true } } },
        });
        await prisma.chatThread.update({
          where: { id: tid },
          data: patch,
        });
        return json(res, 201, { ...message, waitingOn: patch.waitingOn, ticketStatus: patch.ticketStatus });
      }
      if (body.kind === "SUPPORT_STATUS") {
        if (!["ADMIN", "SUPER_ADMIN", "CLIENT"].includes(user.role)) {
          return json(res, 403, { error: "Forbidden" });
        }
        const tid = String(body.threadId || "");
        const action = String(body.action || "");
        if (!tid || !["resolve", "archive", "reopen"].includes(action)) {
          return json(res, 400, { error: "threadId and action required" });
        }
        const actorRole = ["ADMIN", "SUPER_ADMIN"].includes(user.role) ? "ADMIN" : "CLIENT";
        if (actorRole === "CLIENT" && action === "archive") {
          return json(res, 403, { error: "Forbidden" });
        }
        const existing = await prisma.chatThread.findFirst({
          where: { id: tid, kind: "SUPPORT" },
        });
        if (!existing) return json(res, 404, { error: "Support thread not found" });
        if (user.role === "CLIENT") {
          const me = await prisma.user.findUnique({
            where: { id: user.userId },
            select: { companyId: true },
          });
          const allowed =
            existing.createdByUserId === user.userId ||
            (me?.companyId && existing.companyId === me.companyId);
          if (!allowed) return json(res, 403, { error: "Forbidden" });
        }
        const allowed = allowedSupportActions(existing.ticketStatus, actorRole);
        if (!allowed.includes(action)) {
          return json(res, 409, { error: "Ticket action not allowed" });
        }
        try {
          const patch = nextSupportTicketPatch(existing.ticketStatus, action);
          const updated = await prisma.$transaction(async (tx) => {
            await tx.chatMessage.create({
              data: {
                threadId: tid,
                authorId: user.userId,
                body: patch.systemBody,
                isSystem: true,
              },
            });
            const { systemBody, ...data } = patch;
            return tx.chatThread.update({
              where: { id: tid },
              data,
            });
          });
          return json(res, 200, updated);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed";
          return json(res, supportStatusHttpCode(msg), { error: msg });
        }
      }
      let thread = await prisma.chatThread.findFirst({
        where: { calculationId: body.calculationId, kind: "CALCULATION" },
      });
      if (!thread) {
        const calc = await prisma.calculation.findUnique({ where: { id: body.calculationId } });
        if (!calc) return json(res, 404, { error: "Not found" });
        thread = await prisma.chatThread.create({
          data: {
            kind: "CALCULATION",
            calculationId: calc.id,
            subject: `Чат · ${calc.number}`,
          },
        });
      }
      const waitingOn = user.role === "CLIENT" ? "BROKER" : user.role === "BROKER" ? "CLIENT" : null;
      const message = await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          authorId: user.userId,
          body: body.body,
          attachmentUrl: body.attachmentUrl || null,
        },
        include: { author: { select: { id: true, name: true, role: true } } },
      });
      if (waitingOn) {
        await prisma.chatThread.update({ where: { id: thread.id }, data: { waitingOn } });
      }
      return json(res, 201, { ...message, waitingOn });
    }

    if (req.method === "GET" && url.pathname === "/v1/payouts") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const profile = await prisma.brokerProfile.findUnique({ where: { userId: user.userId } });
      if (!profile) return json(res, 200, []);
      const rows = await prisma.brokerPayout.findMany({
        where: { brokerProfileId: profile.id },
        orderBy: { createdAt: "desc" },
      });
      return json(res, 200, rows);
    }

    // --- Client branch extract (Phase 6 / D17) ---
    if (req.method === "POST" && url.pathname === "/v1/calculations/attr-suggest") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["CLIENT", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const body = await readBody(req);
      return json(res, 200, suggestProductAttrs(body));
    }

    if (req.method === "POST" && url.pathname === "/v1/calculations") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        const settings = await getPlatformSettings();
        if (settings.maintenanceMode) {
          return json(res, 503, { error: "Platform is in maintenance mode" });
        }
      }
      const body = await readBody(req);
      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!dbUser?.companyId) return json(res, 400, { error: "Company required" });
      const tariffCode = body.tariffCode || "STANDARD";
      const tariff = await prisma.tariffPlan.findUnique({ where: { code: tariffCode } });
      const maxPos = maxPositions(tariff?.code);
      if (Array.isArray(body.items) && body.items.length === 0) {
        return json(res, 400, { error: "At least one item required" });
      }
      if (Array.isArray(body.items) && body.items.length > maxPos) {
        return json(res, 400, { error: `Too many positions (max ${maxPos} for tariff)` });
      }
      const rawItems =
        Array.isArray(body.items) && body.items.length > 0
          ? body.items
          : [{ name: body.title, description: body.description }];
      if (!rawItems[0]?.name && !rawItems[0]?.manufacturerSkuId) {
        return json(res, 400, { error: "At least one item required" });
      }
      let itemsForCreate = await hydrateItemsWithPublishedSkus(prisma, rawItems);
      if (!itemsForCreate[0]?.name) return json(res, 400, { error: "At least one item required" });
      for (const it of itemsForCreate) {
        if (!String(it.name || "").trim() && !it.manufacturerSkuId) continue;
        if (hasRequiredCreateAttrs(it.attrs)) continue;
        const miss = missingRequiredCreateAttrs(it.attrs);
        return json(res, 400, {
          error: requiredCreateAttrsError(miss),
        });
      }
      for (const it of itemsForCreate) {
        if (it.mediaUrl && !isAllowedMediaUrl(it.mediaUrl)) {
          return json(res, 400, {
            error: "mediaUrl must be an upload path (/uploads/ved/…) or configured S3 URL",
          });
        }
      }
      if (ocrUrl) {
        itemsForCreate = await Promise.all(
          itemsForCreate.map(async (it) => {
            if (!it.mediaUrl || !isAllowedMediaUrl(it.mediaUrl)) return it;
            try {
              const ocrRes = await fetch(`${ocrUrl}/v1/extract`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  mediaUrl: it.mediaUrl,
                  hint: `${it.name || ""} ${it.description || body.description || ""}`,
                }),
                signal: AbortSignal.timeout(5000),
              });
              if (!ocrRes.ok) return it;
              const extracted = await ocrRes.json();
              const ocrAttrs = sanitizeProductAttrs(extracted.attrs);
              if (!ocrAttrs) return it;
              const merged = sanitizeProductAttrs({ ...ocrAttrs, ...(it.attrs || {}) });
              return { ...it, attrs: merged || it.attrs };
            } catch {
              return it;
            }
          })
        );
      }
      const count = await prisma.calculation.count();
      const number = `#${47800 + count + 1}`;
      const aiUrl = aiServiceUrl;
      let draft = {
        hsCode: "8471 30 000 0",
        duties: { customsDutyPercent: 7, vatPercent: 22, feeRub: 13541, note: "fallback" },
        documents: ["Инвойс", "Packing list", "Контракт"],
        confidence: 0.55,
        disclaimer: "Рекомендация AI. Финальное решение — брокер или клиент.",
        engine: "fallback",
      };
      const createSettings = await getPlatformSettings();
      let precedentApplied = false;
      if (createSettings.llmEnrichEnabled) {
        const prec = await findBestPrecedent(prisma, {
          title: body.title,
          description: body.description,
          name: itemsForCreate[0]?.name || body.title,
          attrs: itemsForCreate[0]?.attrs,
        });
        if (prec) {
          draft = {
            ...draft,
            hsCode: prec.hsCode,
            confidence: prec.confidence,
            disclaimer: prec.disclaimer,
            engine: "heuristic-v1",
            llmEnrich: prec.engine,
          };
          precedentApplied = true;
        }
      }
      if (!precedentApplied) {
      try {
        const aiRes = await fetch(`${aiUrl}/v1/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: body.title,
            description: body.description,
            country: body.country,
            shipmentValue: body.shipmentValue,
          }),
          signal: AbortSignal.timeout(
            Number(process.env.AI_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS || 35000)
          ),
        });
        if (aiRes.ok) draft = await aiRes.json();
      } catch {
        /* keep fallback */
      }
      if (llmUrl && !draft.llmEnrich) {
        const createSettings = await getPlatformSettings();
        if (createSettings.llmEnrichEnabled) {
        try {
          const [cRes, dRes] = await Promise.all([
            fetch(`${llmUrl}/v1/classify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: body.title,
                description: body.description,
                country: body.country,
              }),
              signal: AbortSignal.timeout(3000),
            }),
            fetch(`${llmUrl}/v1/duty`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hsCode: draft.hsCode, shipmentValue: body.shipmentValue }),
              signal: AbortSignal.timeout(3000),
            }),
          ]);
          if (cRes.ok) {
            const classified = await cRes.json();
            if (classified.hsCode) draft.hsCode = classified.hsCode;
            if (classified.confidence != null) draft.confidence = classified.confidence;
            draft.llmEnrich = classified.engine || "llm";
          }
          if (dRes.ok) {
            const d = await dRes.json();
            draft.duties = {
              ...draft.duties,
              customsDutyPercent: d.customsDutyPercent ?? draft.duties.customsDutyPercent,
              vatPercent: d.vatPercent ?? draft.duties.vatPercent,
              feeRub: d.feeRub ?? draft.duties.feeRub,
            };
          }
        } catch {
          /* fail-open */
        }
        }
      }
      }
      const settings = await getPlatformSettings();
      const customs = invoiceCustomsValue(body.shipmentValue, body.shipmentCurrency, settings);
      const goodsRub = customs.goodsRub;
      const dutyRub = Math.round((goodsRub * (draft.duties?.customsDutyPercent || 0)) / 100);
      const vatPct = draft.duties?.vatPercent ?? 22;
      const vatRub = Math.round(((goodsRub + dutyRub) * vatPct) / 100);
      const feeRub = customsOperationsFeeRub(goodsRub);
      const landed = assembleLandedWithoutFreight({
        invoiceAmount: customs.invoice.amount,
        currency: customs.invoice.currency,
        goodsRub,
        bufferPct: customs.rates.bufferPct,
        dutyRub,
        vatRub,
        feeRub,
        qty: sumItemQty(itemsForCreate),
      });
      if (draft.duties) draft.duties = { ...draft.duties, feeRub, vatPercent: vatPct };
      draft.landedWithoutFreight = landed;
      const hsCode = draft.hsCode || "8471 30 000 0";
      const confidence = draft.confidence ?? 0.55;
      const n = Math.max(itemsForCreate.length, 1);
      const tnved = normalizeHsCode(hsCode);
      const calc = await prisma.$transaction(async (tx) => {
        const created = await tx.calculation.create({
          data: {
            number,
            status: "AI_READY",
            title: body.title,
            description: body.description,
            country: body.country,
            shipmentValue: customs.storedShipmentValue,
            clientUserId: user.userId,
            companyId: dbUser.companyId,
            tariffId: tariff?.id,
            preferredBrokerUserId: body.preferredBrokerUserId || null,
            hsCode,
            confidence,
            dutyRub,
            vatRub,
            feeRub,
            totalPaymentsRub: dutyRub + vatRub + feeRub,
            aiDraft: draft,
            items: {
              create: itemsForCreate.map((it, idx) => {
                const attrs = sanitizeProductAttrs(it.attrs);
                return {
                  name: it.name,
                  description: it.description || body.description,
                  qty: it.qty,
                  unit: it.unit,
                  unitPrice: it.unitPrice,
                  mediaUrl: it.mediaUrl,
                  attrs: attrs || undefined,
                  manufacturerSkuId: it.manufacturerSkuId || null,
                  hsCodeAi: hsCode,
                  tnvedCode: tnved,
                  dutyRub: Math.round(dutyRub / n),
                  vatRub: Math.round(vatRub / n),
                  sortOrder: idx,
                };
              }),
            },
          },
          include: { items: true, tariff: true },
        });
        await appendCalculationEvent(tx, {
          calculationId: created.id,
          kind: "CREATED",
          actorUserId: user.userId,
          payload: { number, to: "AI_READY" },
        });
        await appendCalculationEvent(tx, {
          calculationId: created.id,
          kind: "AI_DRAFT",
          actorUserId: user.userId,
          payload: {
            to: "AI_READY",
            draft: { hsCode, confidence },
          },
        });
        return created;
      });
      try {
        if (shouldEnqueueAiDrain(createSettings)) {
          // Enqueue only — worker / jobs-tick runs drain (avoid long HTTP create).
          await prisma.backgroundJob.create({
            data: {
              kind: "AI_DRAIN",
              status: "QUEUED",
              calculationId: calc.id,
              payload: {
                calculationId: calc.id,
                hasMedia: itemsForCreate.some((it) => Boolean(it.mediaUrl)),
              },
            },
          });
          const draft =
            calc.aiDraft && typeof calc.aiDraft === "object" && !Array.isArray(calc.aiDraft)
              ? { ...calc.aiDraft, llmEnrichPending: true }
              : { llmEnrichPending: true };
          const pendingCalc = await prisma.calculation.update({
            where: { id: calc.id },
            data: { aiDraft: draft },
            include: { tariff: true, items: { orderBy: { sortOrder: "asc" } } },
          });
          return json(res, 201, { ...pendingCalc, aiDrainPending: true });
        }
      } catch {
        /* fail-open */
      }
      return json(res, 201, calc);
    }

    const payMatch = url.pathname.match(/^\/v1\/calculations\/([^/]+)\/pay$/);
    if (req.method === "POST" && payMatch) {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        const settings = await getPlatformSettings();
        if (settings.maintenanceMode) {
          return json(res, 503, { error: "Platform is in maintenance mode" });
        }
      }
      {
        const paySettings = await getPlatformSettings();
        if (!paySettings.paymentsEnabled) {
          return json(res, 403, { error: "Payments are temporarily disabled by platform admin" });
        }
      }
      const body = await readBody(req);
      const calc = await prisma.calculation.findUniqueOrThrow({
        where: { id: payMatch[1] },
        include: { tariff: true, company: true, items: true },
      });
      if (calc.clientUserId !== user.userId && !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      if (PAID_STATUSES.includes(calc.status) && calc.paidAt) {
        return json(res, 200, calc);
      }
      if (!["AI_READY", "AWAITING_PAYMENT"].includes(calc.status)) {
        return json(res, 400, { error: `Cannot pay from ${calc.status}` });
      }
      if (!calc.companyId || !calc.tariff) return json(res, 400, { error: "Company or tariff missing" });
      const settings = await getPlatformSettings();
      const conf = calc.confidence ?? 0;
      const brokerNeeded = calc.tariff.code !== "EXPRESS" || conf < settings.confidenceThreshold;
      const preferred =
        body.preferredBrokerUserId !== undefined
          ? body.preferredBrokerUserId || null
          : calc.preferredBrokerUserId;
      const slaHours = calc.tariff.slaHours || settings.defaultSlaHours;
      const nextStatus = brokerNeeded ? "QUEUED" : "DONE";
      try {
        assertTransition(calc.status, nextStatus);
      } catch (e) {
        return json(res, 400, { error: e instanceof Error ? e.message : "Pay failed" });
      }
      const paidAt = new Date();
      const price = calc.tariff.priceRub;
      try {
        const updated = await creditCompany({
          companyId: calc.companyId,
          amountRub: -price,
          kind: "TARIFF_CHARGE",
          description: `Оплата тарифа ${calc.tariff.name} · ${calc.number}`,
          calculationId: calc.id,
          createdById: user.userId,
          after: async (tx) => {
            const row = await tx.calculation.update({
              where: { id: calc.id },
              data: brokerNeeded
                ? {
                    status: "QUEUED",
                    preferredBrokerUserId: preferred,
                    paidAt,
                    queuedAt: paidAt,
                    slaDeadline: new Date(Date.now() + slaHours * 3600_000),
                  }
                : {
                    status: "DONE",
                    preferredBrokerUserId: preferred,
                    paidAt,
                    doneAt: paidAt,
                    hsCodeFinal: calc.hsCode,
                    pdfHtml: expressPdfHtml(calc),
                  },
              include: { items: true, tariff: true },
            });
            await appendCalculationEvent(tx, {
              calculationId: calc.id,
              kind: "PAID",
              actorUserId: user.userId,
              payload: { from: calc.status, to: nextStatus },
            });
            return row;
          },
        });
        if (brokerNeeded && settings.autoAssignBrokers) {
          try {
            let brokerUserId = preferred;
            if (brokerUserId) {
              const preferredProfile = await prisma.brokerProfile.findUnique({
                where: { userId: brokerUserId },
                select: { acceptingJobs: true, moderationStatus: true, userId: true },
              });
              if (
                !preferredProfile ||
                preferredProfile.moderationStatus !== "APPROVED" ||
                preferredProfile.acceptingJobs === false
              ) {
                brokerUserId = null;
              }
            }
            if (!brokerUserId) {
              const best = await prisma.brokerProfile.findFirst({
                where: { moderationStatus: "APPROVED", acceptingJobs: true },
                orderBy: { rating: "desc" },
                select: { userId: true },
              });
              brokerUserId = best?.userId || null;
            }
            if (brokerUserId) {
              const claimed = await claim(updated.id, {
                userId: brokerUserId,
                role: "ADMIN",
              });
              return json(res, 200, claimed);
            }
          } catch {
            /* leave QUEUED */
          }
        }
        return json(res, 200, updated);
      } catch (e) {
        return json(res, 400, { error: e instanceof Error ? e.message : "Pay failed" });
      }
    }

    const feedbackMatch = url.pathname.match(/^\/v1\/calculations\/([^/]+)\/feedback$/);
    if (req.method === "POST" && feedbackMatch) {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (user.role !== "CLIENT" && !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const body = await readBody(req);
      const reaction = String(body.reaction || "").trim();
      if (!["HELPFUL", "NEEDS_WORK"].includes(reaction)) {
        return json(res, 400, { error: "Invalid reaction" });
      }
      const comment = body.comment != null ? String(body.comment).slice(0, 2000).trim() : "";
      const calcId = feedbackMatch[1];
      try {
        const calc = await prisma.$transaction(async (tx) => {
          const row = await tx.calculation.findUnique({
            where: { id: calcId },
            select: {
              id: true,
              clientUserId: true,
              status: true,
              clientFeedbackAt: true,
            },
          });
          if (!row) throw new Error("Not found");
          if (row.clientUserId !== user.userId && !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
            throw new Error("Forbidden");
          }
          if (!["AI_READY", "AWAITING_PAYMENT", "QUEUED", "IN_REVIEW", "SLA_RISK", "DONE"].includes(row.status)) {
            throw new Error("Feedback only after TN VED draft is ready");
          }
          if (row.clientFeedbackAt) throw new Error("Feedback already submitted");
          const noteBase =
            reaction === "HELPFUL" ? "Клиент: результат полезен" : "Клиент: нужна доработка";
          const note = comment ? `${noteBase} — ${comment.slice(0, 500)}` : noteBase;
          const updated = await tx.calculation.update({
            where: { id: calcId },
            data: {
              clientFeedbackReaction: reaction,
              clientFeedbackComment: comment || null,
              clientFeedbackAt: new Date(),
            },
            omit: { pdfHtml: true },
            include: { tariff: true, items: true },
          });
          await appendCalculationEvent(tx, {
            calculationId: calcId,
            kind: "NOTE",
            actorUserId: user.userId,
            payload: { note },
          });
          return updated;
        });
        return json(res, 200, calc);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Feedback failed";
        const code =
          msg === "Not found" ? 404 : msg === "Forbidden" ? 403 : msg.includes("already") ? 409 : 400;
        return json(res, code, { error: msg });
      }
    }

    if (req.method === "POST" && url.pathname === "/v1/company/topup") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const body = await readBody(req);
      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!dbUser?.companyId) return json(res, 404, { error: "No company" });
      const amount = Number(body.amountRub);
      if (!amount || amount <= 0) return json(res, 400, { error: "Invalid amount" });

      const topupSettings = await getPlatformSettings();
      if (!topupSettings.paymentsEnabled) {
        return json(res, 403, { error: "Payments are temporarily disabled by platform admin" });
      }

      const intentRow = await prisma.paymentIntent.create({
        data: {
          companyId: dbUser.companyId,
          userId: user.userId,
          amountRub: amount,
          method: body.method || "stub",
          provider: "stub",
          status: "PENDING",
        },
      });

      const checkout = await checkoutPayments({
        amountRub: amount,
        companyId: dbUser.companyId,
        userId: user.userId,
        method: body.method || "stub",
        intentId: intentRow.id,
      });
      if (checkout?.pending || checkout?.intent?.status === "pending") {
        await prisma.paymentIntent.update({
          where: { id: intentRow.id },
          data: {
            provider: checkout.intent?.provider || "yookassa",
            confirmUrl: checkout.confirmUrl || checkout.intent?.confirmUrl || null,
            providerPaymentId: checkout.intent?.providerPaymentId || null,
          },
        });
        const company = await prisma.company.findUnique({ where: { id: dbUser.companyId } });
        return json(res, 200, {
          entry: null,
          company,
          provider: "yookassa",
          intentId: intentRow.id,
          pending: true,
          confirmUrl: checkout.confirmUrl || checkout.intent?.confirmUrl || null,
        });
      }
      if (checkout?.intent?.webhook?.ok && checkout.intent.webhook.body?.entry) {
        return json(res, 200, {
          entry: checkout.intent.webhook.body.entry,
          company: checkout.intent.webhook.body.company,
          provider: "payments-stub",
          intentId: intentRow.id,
        });
      }
      if (checkout?.webhook?.ok && checkout.webhook.body?.entry) {
        return json(res, 200, {
          entry: checkout.webhook.body.entry,
          company: checkout.webhook.body.company,
          provider: "payments-stub",
          intentId: intentRow.id,
        });
      }
      if (checkout?.intent?.id) {
        const company = await prisma.company.findUnique({ where: { id: dbUser.companyId } });
        const entry = await prisma.ledgerEntry.findFirst({
          where: { companyId: dbUser.companyId, kind: "TOPUP", paymentIntentId: intentRow.id },
        });
        return json(res, 200, {
          entry:
            entry ||
            (await prisma.ledgerEntry.findFirst({
              where: { companyId: dbUser.companyId, kind: "TOPUP" },
              orderBy: { createdAt: "desc" },
            })),
          company,
          provider: "payments-stub",
          intentId: intentRow.id,
        });
      }

      await prisma.paymentIntent.update({
        where: { id: intentRow.id },
        data: { status: "FAILED" },
      });

      const allowMock =
        topupSettings.mockTopupAllowed &&
        (["1", "true", "yes"].includes(String(process.env.ALLOW_MOCK_TOPUP || "").toLowerCase()) ||
          process.env.DEMO_MODE === "1" ||
          (process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production"));
      if (!allowMock) {
        return json(res, 403, {
          error: "Mock topup disabled. Enable mockTopupAllowed + ALLOW_MOCK_TOPUP or configure payments.",
        });
      }

      const entry = await creditCompany({
        companyId: dbUser.companyId,
        amountRub: amount,
        kind: "TOPUP",
        description: `Пополнение (${body.method || "mock"})`,
        createdById: user.userId,
      });
      const company = await prisma.company.findUniqueOrThrow({ where: { id: dbUser.companyId } });
      return json(res, 200, { entry, company, provider: "mock" });
    }

    if (req.method === "POST" && url.pathname === "/v1/shipping") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const body = await readBody(req);
      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!dbUser?.companyId) return json(res, 400, { error: "No company" });
      if (!body.calculationId) return json(res, 400, { error: "calculationId required" });
      const calc = await prisma.calculation.findFirst({
        where: { id: body.calculationId, clientUserId: user.userId },
      });
      if (!calc) return json(res, 404, { error: "Calculation not found" });
      if (calc.status !== "DONE") return json(res, 400, { error: "Shipping only after DONE" });
      const quotes = await fetchLogisticsQuotes({
        origin: body.origin,
        destination: body.destination,
        mode: body.mode,
      });
      const selected =
        quotes.find((q) => q.id === body.selectedQuoteId) ||
        quotes.find((q) => q.mode === String(body.mode || "LCL").toUpperCase()) ||
        quotes[0];
      const withSelected = quotes.map((q) => ({ ...q, selected: q.id === selected.id }));
      const created = await prisma.shippingRequest.create({
        data: {
          companyId: dbUser.companyId,
          calculationId: body.calculationId,
          origin: body.origin,
          destination: body.destination,
          mode: selected.mode,
          comment: body.comment,
          trackingCode: `LC-${Math.floor(1000 + Math.random() * 9000)}`,
          status: "QUOTED",
          quotes: withSelected,
          selectedQuote: selected,
          eta: new Date(Date.now() + selected.etaDays * 86400_000),
        },
      });
      return json(res, 201, created);
    }

    if (req.method === "GET" && url.pathname === "/v1/shipping") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!dbUser?.companyId) return json(res, 200, []);
      if (url.searchParams.get("quotes") === "1") {
        const origin = url.searchParams.get("origin") || "Шанхай";
        const destination = url.searchParams.get("destination") || "Москва";
        const mode = url.searchParams.get("mode") || undefined;
        const quotes = await fetchLogisticsQuotes({ origin, destination, mode });
        return json(res, 200, quotes);
      }
      const items = await prisma.shippingRequest.findMany({
        where: { companyId: dbUser.companyId },
        orderBy: { createdAt: "desc" },
      });
      return json(res, 200, items);
    }

    // --- C1 Domain API cutover: reads ---
    if (req.method === "GET" && url.pathname === "/v1/me") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const row = await prisma.user.findUnique({
        where: { id: user.userId },
        include: {
          company: { include: { ledger: { orderBy: { createdAt: "desc" }, take: 50 } } },
          brokerProfile: true,
        },
      });
      if (!row) return json(res, 404, { error: "Not found" });
      return json(res, 200, {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        phone: row.phone,
        company: row.company,
        brokerProfile: row.brokerProfile,
      });
    }

    if (req.method === "GET" && url.pathname === "/v1/tariffs") {
      const key = req.headers["x-internal-key"] || "";
      if (!internalKey || key !== internalKey) return json(res, 401, { error: "Unauthorized" });
      const tariffs = await prisma.tariffPlan.findMany({
        where: { isActive: true },
        orderBy: { priceRub: "asc" },
      });
      return json(res, 200, tariffs);
    }

    if (req.method === "GET" && url.pathname === "/v1/brokers") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const all =
        url.searchParams.get("all") === "1" || ["ADMIN", "SUPER_ADMIN"].includes(user.role);
      let where;
      if (!all) {
        const settings = await getPlatformSettings();
        if (!settings.marketplaceEnabled && user.role === "CLIENT") {
          return json(res, 200, []);
        }
        where = { moderationStatus: "APPROVED", acceptingJobs: true };
      }
      const brokers = await prisma.brokerProfile.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { rating: "desc" },
      });
      return json(res, 200, brokers);
    }

    if (req.method === "GET" && url.pathname === "/v1/calculations") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const status = url.searchParams.get("status");
      const scope = url.searchParams.get("scope");
      const q = url.searchParams.get("q");
      const where = {};
      if (status) where.status = status;
      if (user.role === "CLIENT") {
        where.clientUserId = user.userId;
      } else if (user.role === "BROKER") {
        if (scope === "queue") {
          const profile = await prisma.brokerProfile.findUnique({
            where: { userId: user.userId },
            select: { acceptingJobs: true },
          });
          if (!isBrokerQueueVisible(profile?.acceptingJobs)) {
            return json(res, 200, []);
          }
          where.status = { in: ["QUEUED", "SLA_RISK"] };
          where.OR = [
            { preferredBrokerUserId: null, brokerUserId: null },
            { preferredBrokerUserId: user.userId },
            { brokerUserId: user.userId },
          ];
        } else if (scope === "mine") {
          where.brokerUserId = user.userId;
          where.status = { in: ["IN_REVIEW", "SLA_RISK", "DONE"] };
        } else {
          where.OR = [{ brokerUserId: user.userId }, { status: { in: ["QUEUED", "SLA_RISK"] } }];
        }
      } else if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      if (q) {
        where.AND = [
          {
            OR: [
              { number: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          },
        ];
      }
      const items = await prisma.calculation.findMany({
        where,
        // List never needs PDF HTML (keeps payload small for client reload after pay).
        omit: { pdfHtml: true },
        include: {
          tariff: true,
          items: { orderBy: { sortOrder: "asc" } },
          clientUser: { select: { id: true, name: true, email: true } },
          brokerUser: { select: { id: true, name: true, email: true } },
          preferredBrokerUser: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      if (user.role === "BROKER" && scope === "queue") {
        items.sort((a, b) => {
          const ap = a.preferredBrokerUserId === user.userId ? 0 : a.preferredBrokerUserId ? 2 : 1;
          const bp = b.preferredBrokerUserId === user.userId ? 0 : b.preferredBrokerUserId ? 2 : 1;
          if (ap !== bp) return ap - bp;
          return (a.queuedAt?.getTime() ?? 0) - (b.queuedAt?.getTime() ?? 0);
        });
      }
      return json(res, 200, items);
    }

    const eventsMatch = url.pathname.match(/^\/v1\/calculations\/([^/]+)\/events$/);
    if (req.method === "GET" && eventsMatch) {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const calc = await prisma.calculation.findUnique({
        where: { id: eventsMatch[1] },
        select: { id: true, clientUserId: true, brokerUserId: true },
      });
      if (!calc) return json(res, 404, { error: "Not found" });
      if (user.role === "CLIENT" && calc.clientUserId !== user.userId) {
        return json(res, 403, { error: "Forbidden" });
      }
      if (user.role === "BROKER" && calc.brokerUserId && calc.brokerUserId !== user.userId) {
        return json(res, 403, { error: "Forbidden" });
      }
      const events = await prisma.calculationEvent.findMany({
        where: { calculationId: calc.id },
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { actor: { select: { id: true, name: true, role: true } } },
      });
      return json(res, 200, { events });
    }

    const getCalcMatch = url.pathname.match(/^\/v1\/calculations\/([^/]+)$/);
    if (req.method === "GET" && getCalcMatch) {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const calc = await prisma.calculation.findUnique({
        where: { id: getCalcMatch[1] },
        omit: { pdfHtml: true },
        include: {
          tariff: true,
          items: true,
          clientUser: { select: { id: true, name: true, email: true } },
          brokerUser: { select: { id: true, name: true, email: true } },
          company: true,
          chatThreads: { include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } } },
        },
      });
      if (!calc) return json(res, 404, { error: "Not found" });
      if (user.role === "CLIENT" && calc.clientUserId !== user.userId) {
        return json(res, 403, { error: "Forbidden" });
      }
      const pdfMeta = await prisma.calculation.findUnique({
        where: { id: getCalcMatch[1] },
        select: { pdfHtml: true },
      });
      let similarPrecedents = [];
      if (["BROKER", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        const item = calc.items?.[0];
        similarPrecedents = await listSimilarPrecedents(prisma, {
          name: item?.name,
          title: calc.title,
          description: calc.description || item?.description,
          attrs: item?.attrs,
        });
      }
      return json(res, 200, { ...calc, hasPdf: Boolean(pdfMeta?.pdfHtml), similarPrecedents });
    }

    const pdfMatch = url.pathname.match(/^\/v1\/calculations\/([^/]+)\/pdf$/);
    if (req.method === "GET" && pdfMatch) {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const calc = await prisma.calculation.findUnique({ where: { id: pdfMatch[1] } });
      if (!calc?.pdfHtml) return json(res, 404, { error: "PDF not ready" });
      if (user.role === "CLIENT" && calc.clientUserId !== user.userId) {
        return json(res, 403, { error: "Forbidden" });
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="report-${calc.number.replace("#", "")}.html"`
      );
      return res.end(calc.pdfHtml);
    }

    const itemsMatch = url.pathname.match(/^\/v1\/calculations\/([^/]+)\/items$/);
    if (req.method === "PATCH" && itemsMatch) {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["BROKER", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const body = await readBody(req);
      const calc = await prisma.calculation.findUniqueOrThrow({
        where: { id: itemsMatch[1] },
        include: { items: true, tariff: true },
      });
      if (
        calc.brokerUserId !== user.userId &&
        !["ADMIN", "SUPER_ADMIN"].includes(user.role)
      ) {
        return json(res, 403, { error: "Forbidden" });
      }
      if (!["IN_REVIEW", "SLA_RISK"].includes(calc.status)) {
        return json(res, 400, { error: `Cannot save items from ${calc.status}` });
      }
      const rows = Array.isArray(body.items) ? body.items : [];
      if (!rows.length) return json(res, 400, { error: "At least one item required" });
      const maxPos = maxPositions(calc.tariff?.code);
      if (rows.length > maxPos) {
        return json(res, 400, { error: `Too many positions (max ${maxPos} for tariff)` });
      }
      const owned = new Set(calc.items.map((i) => i.id));
      for (const row of rows) {
        if (!row.id || row.id === "synthetic" || !owned.has(row.id)) {
          return json(res, 400, { error: `Unknown item id: ${row.id}` });
        }
      }
      const now = new Date();
      let extra;
      try {
        extra = normalizeExtraFee(
          body.extraFeeRub ?? calc.extraFeeRub,
          body.extraFeeNote !== undefined ? body.extraFeeNote : calc.extraFeeNote
        );
      } catch (e) {
        return json(res, 400, { error: e instanceof Error ? e.message : "Failed" });
      }
      const feeRub = body.feeRub ?? calc.feeRub ?? 0;
      const existingById = new Map(
        calc.items.map((i) => [i.id, sanitizeProductAttrs(i.attrs) || null])
      );
      const updated = await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          await tx.calculationItem.update({
            where: { id: row.id },
            data: brokerItemData(row, now, existingById.get(row.id) || null),
          });
        }
        const refreshed = await tx.calculationItem.findMany({
          where: { calculationId: calc.id },
          orderBy: { sortOrder: "asc" },
        });
        const summed = sumPayments(refreshed, feeRub, extra.extraFeeRub);
        const saved = await tx.calculation.update({
          where: { id: calc.id },
          data: {
            hsCodeFinal: body.hsCodeFinal ?? refreshed[0]?.hsCodeFinal ?? calc.hsCodeFinal,
            feeRub,
            extraFeeRub: extra.extraFeeRub,
            extraFeeNote: extra.extraFeeNote,
            dutyRub: summed.dutyRub,
            vatRub: summed.vatRub,
            totalPaymentsRub: summed.totalPaymentsRub,
          },
          include: { tariff: true, items: true },
        });
        await appendCalculationEvent(tx, {
          calculationId: calc.id,
          kind: "ITEM_MAPPED",
          actorUserId: user.userId,
          payload: {
            items: rows.map((i) => ({
              id: i.id,
              hsCodeFinal: i.hsCodeFinal,
              ...(i.dutyRub != null ? { dutyRub: i.dutyRub } : {}),
              ...(i.vatRub != null ? { vatRub: i.vatRub } : {}),
              ...(i.description !== undefined
                ? { description: sanitizeBrokerItemDescription(i.description) }
                : {}),
            })),
            ...(extra.extraFeeRub > 0
              ? { note: `Прочие сборы ${extra.extraFeeRub} ₽ · ${extra.extraFeeNote}` }
              : {}),
          },
        });
        return saved;
      });
      return json(res, 200, updated);
    }

    const assignMatch = url.pathname.match(/^\/v1\/calculations\/([^/]+)\/assign$/);
    if (req.method === "POST" && assignMatch) {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const body = await readBody(req);
      if (!body.brokerUserId) return json(res, 400, { error: "brokerUserId required" });
      const calc = await prisma.calculation.findUniqueOrThrow({ where: { id: assignMatch[1] } });
      const nextStatus = ["QUEUED", "SLA_RISK"].includes(calc.status) ? "IN_REVIEW" : calc.status;
      if (nextStatus !== calc.status) {
        try {
          assertTransition(calc.status, nextStatus);
        } catch (e) {
          return json(res, 400, { error: e instanceof Error ? e.message : "Assign failed" });
        }
      }
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.calculation.update({
          where: { id: calc.id },
          data: {
            brokerUserId: body.brokerUserId,
            preferredBrokerUserId: body.brokerUserId,
            status: nextStatus,
            claimedAt: new Date(),
            queuedAt: calc.queuedAt ?? new Date(),
          },
        });
        await tx.brokerAssignment.create({
          data: {
            calculationId: calc.id,
            brokerUserId: body.brokerUserId,
            kind: "ASSIGN",
          },
        });
        return row;
      });
      return json(res, 200, updated);
    }

    const escalateMatch = url.pathname.match(/^\/v1\/calculations\/([^/]+)\/escalate$/);
    if (req.method === "POST" && escalateMatch) {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["ADMIN", "SUPER_ADMIN", "BROKER"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const calc = await prisma.calculation.findUnique({ where: { id: escalateMatch[1] } });
      if (!calc) return json(res, 404, { error: "Not found" });
      if (!["QUEUED", "IN_REVIEW"].includes(calc.status)) {
        return json(res, 400, { error: `Cannot escalate from ${calc.status}` });
      }
      if (user.role === "BROKER") {
        if (calc.brokerUserId !== user.userId || calc.status !== "IN_REVIEW") {
          return json(res, 403, { error: "Forbidden" });
        }
      }
      const updated = await prisma.calculation.update({
        where: { id: escalateMatch[1] },
        data: { status: "SLA_RISK" },
      });
      return json(res, 200, updated);
    }

    if (url.pathname === "/v1/platform/integrations") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      if (req.method === "GET") {
        const settings = await getPlatformSettings();
        const mask = (raw) => {
          try {
            if (!raw) return null;
            const u = new URL(raw);
            return `${u.protocol}//${u.host}`;
          } catch {
            return raw ? "(configured)" : null;
          }
        };
        const recent = await prisma.serviceCall.findMany({
          where: { service: { in: ["payments", "llm", "notify"] } },
          orderBy: { createdAt: "desc" },
          take: 36,
        });
        const mapCall = (r) => ({
          id: r.id,
          service: r.service,
          operation: r.operation,
          status: r.status,
          durationMs: r.durationMs,
          error: r.error,
          createdAt: r.createdAt.toISOString(),
        });
        return json(res, 200, {
          toggles: {
            paymentsEnabled: settings.paymentsEnabled,
            llmEnrichEnabled: settings.llmEnrichEnabled,
            notifyEnabled: settings.notifyEnabled,
            mockTopupAllowed: settings.mockTopupAllowed,
            marketplaceEnabled: settings.marketplaceEnabled,
            autoAssignBrokers: settings.autoAssignBrokers,
            maintenanceMode: settings.maintenanceMode,
          },
          payments: {
            host: mask(process.env.PAYMENTS_SERVICE_URL),
            configured: Boolean(paymentsUrl),
            health: null,
            recent: recent.filter((r) => r.service === "payments").map(mapCall),
          },
          llm: {
            host: mask(process.env.LLM_SERVICE_URL),
            configured: Boolean(llmUrl),
            health: null,
            recent: recent.filter((r) => r.service === "llm").map(mapCall),
          },
          notify: {
            host: mask(process.env.NOTIFY_SERVICE_URL),
            configured: Boolean(notifyUrl),
            health: null,
            recent: recent.filter((r) => r.service === "notify").map(mapCall),
          },
        });
      }
    }

    if (url.pathname === "/v1/platform/settings") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (req.method === "GET") {
        if (!["ADMIN", "SUPER_ADMIN", "BROKER", "CLIENT"].includes(user.role)) {
          return json(res, 403, { error: "Forbidden" });
        }
        return json(res, 200, await getPlatformSettings());
      }
      if (req.method === "PATCH") {
        if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
          return json(res, 403, { error: "Forbidden" });
        }
        const body = await readBody(req);
        const map = {
          confidenceThreshold: SETTING_KEYS.confidenceThreshold,
          defaultSlaHours: SETTING_KEYS.defaultSlaHours,
          preferredClaimHours: SETTING_KEYS.preferredClaimHours,
          usdRate: SETTING_KEYS.usdRate,
          cnyRate: SETTING_KEYS.cnyRate,
          eurRate: SETTING_KEYS.eurRate,
          fxBufferPct: SETTING_KEYS.fxBufferPct,
          marketplaceEnabled: SETTING_KEYS.marketplaceEnabled,
          autoAssignBrokers: SETTING_KEYS.autoAssignBrokers,
          maintenanceMode: SETTING_KEYS.maintenanceMode,
          paymentsEnabled: SETTING_KEYS.paymentsEnabled,
          llmEnrichEnabled: SETTING_KEYS.llmEnrichEnabled,
          notifyEnabled: SETTING_KEYS.notifyEnabled,
          mockTopupAllowed: SETTING_KEYS.mockTopupAllowed,
        };
        for (const [field, key] of Object.entries(map)) {
          if (body[field] !== undefined) await setPlatformSetting(key, body[field]);
        }
        return json(res, 200, await getPlatformSettings());
      }
    }

    if (req.method === "PATCH" && url.pathname === "/v1/tariffs/update") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const body = await readBody(req);
      if (!body.id) return json(res, 400, { error: "id required" });
      const { id, ...data } = body;
      const allowed = {};
      for (const k of ["priceRub", "brokerSharePct", "maxPositions", "slaHours", "description", "isActive"]) {
        if (data[k] !== undefined) allowed[k] = data[k];
      }
      const updated = await prisma.tariffPlan.update({ where: { id }, data: allowed });
      return json(res, 200, updated);
    }

    if (url.pathname === "/v1/company") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        include: { company: { include: { ledger: { orderBy: { createdAt: "desc" }, take: 50 } } } },
      });
      if (req.method === "GET") {
        if (!dbUser?.company) return json(res, 404, { error: "No company" });
        return json(res, 200, dbUser.company);
      }
      if (req.method === "PATCH") {
        if (!dbUser?.companyId) return json(res, 404, { error: "No company" });
        const body = await readBody(req);
        const SEGMENTS = new Set(["SINGLE", "RETAIL_SMALL", "WHOLESALE"]);
        if (body.clientSegment && !SEGMENTS.has(body.clientSegment)) {
          return json(res, 400, { error: "Invalid clientSegment" });
        }
        const company = await prisma.company.update({
          where: { id: dbUser.companyId },
          data: {
            name: body.name,
            inn: body.inn,
            kpp: body.kpp,
            legalAddress: body.legalAddress,
            contactEmail: body.contactEmail || undefined,
            contactPhone: body.contactPhone,
            ...(body.clientSegment ? { clientSegment: body.clientSegment } : {}),
          },
        });
        return json(res, 200, company);
      }
    }

    if (req.method === "GET" && url.pathname === "/v1/company/list") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const companies = await prisma.company.findMany({
        include: {
          users: { select: { id: true, name: true, email: true, role: true } },
          _count: { select: { calculations: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return json(res, 200, companies);
    }

    {
      const companyDetailMatch = url.pathname.match(/^\/v1\/company\/([^/]+)$/);
      const companyId = companyDetailMatch?.[1];
      if (
        companyId &&
        companyId !== "list" &&
        companyId !== "topup" &&
        (req.method === "GET" || req.method === "PATCH")
      ) {
        const user = authorize(req);
        if (!user) return json(res, 401, { error: "Unauthorized" });
        if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
          return json(res, 403, { error: "Forbidden" });
        }

        async function loadAdminCompany(id) {
          const company = await prisma.company.findUnique({
            where: { id },
            include: {
              users: {
                select: { id: true, name: true, email: true, role: true, createdAt: true },
                orderBy: { createdAt: "asc" },
              },
              ledger: {
                orderBy: { createdAt: "desc" },
                take: 50,
                select: {
                  id: true,
                  kind: true,
                  amountRub: true,
                  balanceAfter: true,
                  description: true,
                  calculationId: true,
                  createdAt: true,
                },
              },
              calculations: {
                orderBy: { createdAt: "desc" },
                take: 20,
                select: {
                  id: true,
                  number: true,
                  title: true,
                  status: true,
                  confidence: true,
                  createdAt: true,
                },
              },
              _count: { select: { calculations: true } },
            },
          });
          if (!company) return null;
          const { ledger, ...rest } = company;
          let manufacturerStats = null;
          if (company.kind === "MANUFACTURER") {
            const [skuTotal, skuPublished, skuDraft, requestsSubmitted, poolsOpen] = await Promise.all([
              prisma.manufacturerSku.count({ where: { companyId: id } }),
              prisma.manufacturerSku.count({ where: { companyId: id, status: "PUBLISHED" } }),
              prisma.manufacturerSku.count({ where: { companyId: id, status: "DRAFT" } }),
              prisma.skuOrderRequest.count({
                where: { manufacturerSku: { companyId: id }, status: "SUBMITTED" },
              }),
              prisma.skuOrderPool.count({
                where: { manufacturerCompanyId: id, status: "OPEN" },
              }),
            ]);
            manufacturerStats = { skuTotal, skuPublished, skuDraft, requestsSubmitted, poolsOpen };
          }
          return { ...rest, ledgerEntries: ledger, manufacturerStats };
        }

        if (req.method === "PATCH") {
          const body = await readBody(req);
          const SEGMENTS = new Set(["SINGLE", "RETAIL_SMALL", "WHOLESALE"]);
          const existing = await prisma.company.findUnique({ where: { id: companyId } });
          if (!existing) return json(res, 404, { error: "Not found" });
          if (body.clientSegment !== undefined) {
            if (existing.kind === "MANUFACTURER") {
              return json(res, 400, { error: "clientSegment only for CLIENT companies" });
            }
            if (!SEGMENTS.has(body.clientSegment)) {
              return json(res, 400, { error: "Invalid clientSegment" });
            }
          }
          const data = {};
          for (const k of ["name", "inn", "kpp", "legalAddress", "contactEmail", "contactPhone", "clientSegment"]) {
            if (body[k] !== undefined) data[k] = body[k] === "" ? null : body[k];
          }
          if (!Object.keys(data).length) {
            return json(res, 400, { error: "No fields to update" });
          }
          await prisma.company.update({ where: { id: companyId }, data });
        }

        const view = await loadAdminCompany(companyId);
        if (!view) return json(res, 404, { error: "Not found" });
        return json(res, 200, view);
      }
    }

    {
      const adjustMatch = url.pathname.match(/^\/v1\/company\/([^/]+)\/adjust$/);
      if (req.method === "POST" && adjustMatch) {
        const user = authorize(req);
        if (!user) return json(res, 401, { error: "Unauthorized" });
        if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
          return json(res, 403, { error: "Forbidden" });
        }
        const companyId = adjustMatch[1];
        const body = await readBody(req);
        const amount = Math.trunc(Number(body.amountRub));
        const reason = String(body.reason || "").trim();
        if (!Number.isFinite(amount) || amount === 0) {
          return json(res, 400, { error: "amountRub must be a non-zero integer" });
        }
        if (reason.length < 3) {
          return json(res, 400, { error: "reason required (min 3 chars)" });
        }
        try {
          const entry = await creditCompany({
            companyId,
            amountRub: amount,
            kind: "ADJUSTMENT",
            description: `Admin adjust: ${reason}`,
            createdById: user.userId,
          });
          return json(res, 200, { ok: true, entry });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Adjust failed";
          const status = /Insufficient|amount|reason/i.test(msg) ? 400 : 500;
          return json(res, status, { error: msg });
        }
      }
    }

    if (req.method === "PATCH" && url.pathname === "/v1/brokers") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const body = await readBody(req);
      const brokerProfileId = String(body.brokerProfileId || "").trim();
      if (!brokerProfileId) return json(res, 400, { error: "brokerProfileId required" });
      const data = {};
      if (body.status !== undefined) data.moderationStatus = body.status;
      if (body.acceptingJobs !== undefined) data.acceptingJobs = Boolean(body.acceptingJobs);
      if (body.specialization !== undefined) data.specialization = body.specialization || null;
      if (body.languages !== undefined) data.languages = body.languages || null;
      if (body.about !== undefined) data.about = body.about || null;
      if (!Object.keys(data).length) {
        return json(res, 400, { error: "status, acceptingJobs, or profile fields required" });
      }
      const updated = await prisma.brokerProfile.update({
        where: { id: brokerProfileId },
        data,
        include: { user: { select: { id: true, name: true, email: true, image: true, phone: true } } },
      });
      return json(res, 200, updated);
    }

    if (req.method === "PATCH" && url.pathname === "/v1/brokers/me") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (user.role !== "BROKER" && !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const body = await readBody(req);
      const data = {};
      for (const k of ["specialization", "languages", "about", "acceptingJobs"]) {
        if (body[k] !== undefined) data[k] = body[k];
      }
      const updated = await prisma.brokerProfile.update({
        where: { userId: user.userId },
        data,
      });
      return json(res, 200, updated);
    }

    if (req.method === "GET" && url.pathname === "/v1/tnved/search") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const q = String(url.searchParams.get("q") || "").trim();
      const headingOnly = url.searchParams.get("heading") === "1";
      const cap = headingOnly ? 200 : 50;
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), cap);
      const leafOnly = url.searchParams.get("leafOnly") === "1";
      const [total, leaves, variations] = await Promise.all([
        prisma.tnvedCode.count({ where: { isActive: true } }),
        prisma.tnvedCode.count({ where: { isActive: true, isLeaf: true } }),
        prisma.tnvedCode.count({ where: { isActive: true, notes: { not: null } } }),
      ]);
      if (!q) return json(res, 200, { items: [], total, leaves, variations });
      const digits = q.replace(/\D/g, "");
      const codeOnly = digits.length >= 2 && /^[\d\s./-]+$/.test(q);
      const headingPool = headingOnly ? limit : codeOnly ? Math.min(50, Math.max(limit * 4, 24)) : 500;
      const found = await prisma.tnvedCode.findMany({
        where: tnvedSearchWhere(q, { leafOnly, headingOnly }),
        take: headingPool,
        orderBy: headingOnly ? { code: "asc" } : [{ level: "desc" }, { code: "asc" }],
      });
      const stems = codeOnly ? [digits] : tnvedSearchStems(q);
      const items = headingOnly
        ? found
        : [...found]
            .sort((a, b) => {
              const d =
                scoreTnvedSearchHit(b, { stems: stems.length ? stems : [q], digits, phrase: q }) -
                scoreTnvedSearchHit(a, { stems: stems.length ? stems : [q], digits, phrase: q });
              return d || String(a.code).localeCompare(String(b.code));
            })
            .slice(0, limit);
      return json(res, 200, { items, total, leaves, variations });
    }

    const tnvedCodeMatch = url.pathname.match(/^\/v1\/tnved\/([^/]+)$/);
    if (req.method === "GET" && tnvedCodeMatch && tnvedCodeMatch[1] !== "search" && tnvedCodeMatch[1] !== "import") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      const raw = decodeURIComponent(tnvedCodeMatch[1]);
      const code = normalizeHsCode(raw);
      if (!code) return json(res, 404, { error: "Not found" });
      const row = await prisma.tnvedCode.findUnique({
        where: { code },
        include: { rates: { orderBy: { validFrom: "desc" }, take: 5 } },
      });
      if (!row) return json(res, 404, { error: "Not found" });
      const ancestorCodes = hsCodeAncestors(row.code).filter((c) => c !== row.code);
      const [found, childRows] = await Promise.all([
        ancestorCodes.length
          ? prisma.tnvedCode.findMany({ where: { code: { in: ancestorCodes } } })
          : Promise.resolve([]),
        prisma.tnvedCode.findMany({
          where: { parentCode: row.code, isActive: true },
          orderBy: { code: "asc" },
          take: 16,
        }),
      ]);
      const byCode = new Map(found.map((a) => [a.code, a]));
      const ancestors = ancestorCodes
        .map((c) => byCode.get(c))
        .filter(Boolean)
        .map((a) => ({
          code: a.code,
          codeDisplay: a.codeDisplay,
          titleRu: a.titleRu,
          level: a.level,
        }));
      const children = childRows.map((c) => ({
        code: c.code,
        codeDisplay: c.codeDisplay,
        titleRu: c.titleRu,
        level: c.level,
        isLeaf: Boolean(c.isLeaf),
      }));
      return json(res, 200, assembleTnvedCard(row, ancestors, { children }));
    }

    if (req.method === "POST" && url.pathname === "/v1/tnved/import") {
      const user = authorize(req);
      if (!user) return json(res, 401, { error: "Unauthorized" });
      if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const body = await readBody(req);
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length || items.length > 500) {
        return json(res, 400, { error: "items required (1..500)" });
      }
      let upserted = 0;
      for (const it of items) {
        const code = normalizeHsCode(it.code);
        if (!code) continue;
        const level = Number(it.level) || code.length;
        await prisma.tnvedCode.upsert({
          where: { code },
          create: {
            code,
            codeDisplay: it.codeDisplay || code,
            level,
            parentCode: it.parentCode || null,
            titleRu: String(it.titleRu || code),
            titleEn: it.titleEn || null,
            isLeaf: Boolean(it.isLeaf),
            isActive: it.isActive !== false,
            notes: it.notes || null,
          },
          update: {
            codeDisplay: it.codeDisplay || code,
            level,
            parentCode: it.parentCode || null,
            titleRu: String(it.titleRu || code),
            titleEn: it.titleEn || null,
            isLeaf: Boolean(it.isLeaf),
            isActive: it.isActive !== false,
            notes: it.notes || null,
          },
        });
        if (it.rate) {
          await prisma.tnvedDutyRate.create({
            data: {
              code,
              dutyKind: it.rate.dutyKind || "AD_VALOREM",
              dutyPct: it.rate.dutyPct ?? null,
              dutyRubPerUnit: it.rate.dutyRubPerUnit ?? null,
              vatPct: it.rate.vatPct ?? 22,
              feeHintRub: it.rate.feeHintRub ?? null,
              unit: it.rate.unit || null,
              source: it.rate.source || "import",
            },
          });
        }
        upserted += 1;
      }
      return json(res, 201, { upserted });
    }

    if (await handleCatalogRoutes({ req, res, url, prisma, authorize, json })) {
      return; // GET /v1/catalog/skus — published SKUs for CLIENT
    }

    if (
      await handleManufacturerDirectoryRoutes({
        req,
        res,
        url,
        prisma,
        authorize,
        json,
        readBody,
      })
    ) {
      return; // manufacturer directory + proposals + admin approve
    }

    if (
      await handleManufacturerOrderRoutes({
        req,
        res,
        url,
        prisma,
        authorize,
        json,
        readBody,
        ensureManufacturerCompany,
      })
    ) {
      return; // D34 pools / order-requests
    }

    if (await handleFactoryOrderRoutes({ req, res, url, prisma, authorize, json, readBody })) {
      return; // D34 CLIENT factory requests
    }

    if (await handleManufacturerRoutes({ req, res, url, prisma, authorize, json, readBody })) {
      return; // D31 /v1/manufacturer/skus + dashboard + company
    }

    if (url.pathname.startsWith("/v1/")) {
      return json(res, 501, {
        error: "Not implemented on domain API",
        hint: "C1: +items/assign/escalate/settings/tariffs.update/company/brokers.me; uploads stay on web",
      });
    }

    return json(res, 404, { error: "Not found" });
  } catch (e) {
    return json(res, 400, { error: e instanceof Error ? e.message : "Error" });
  }
});

server.listen(port, () => console.log(`[api] domain extract on :${port}`));

attachSigtermHandlers({ server, prisma });
