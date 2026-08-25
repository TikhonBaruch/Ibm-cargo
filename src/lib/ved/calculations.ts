/**
 * VED calculation orchestration (branch triangle / D8–D15).
 * Create → AI draft → pay (ledger) → queue/claim → approve (mapping + PDF).
 * Preferred broker, multi-item positions, and notify stub live here.
 */
import { prisma } from "@/lib/prisma";
import { requestAiDraft } from "@/lib/ved/ai";
import {
  appendCalculationEvent,
  statusChangePayload,
} from "@/lib/ved/calculation-events";
import {
  assertTransition,
  buildPdfHtml,
  computePayments,
  isPreferredExclusiveActive,
  maxPositionsForTariff,
  needsBroker,
  nextCalculationNumber,
  normalizeBrokerExtraFee,
  sanitizeBrokerItemDescription,
  sumItemPayments,
} from "@/lib/ved/domain";
import { creditCompany } from "@/lib/ved/ledger";
import {
  enqueueOutbox,
  enqueueBackgroundJob,
  kickNotifyDelivery,
  classifyServiceError,
  recordServiceCall,
  completeServiceCall,
} from "@/lib/ved/orchestration";
import {
  brokerFilledAttrKeys,
  fillEmptyProductAttrs,
  hasRequiredCreateAttrs,
  missingRequiredCreateAttrs,
  requiredCreateAttrsError,
  sanitizeProductAttrs,
  type ProductAttrs,
} from "@/lib/ved/product-description";
import { hydrateItemsWithPublishedSkus } from "@/lib/ved/manufacturer-sku";
import {
  assembleLandedWithoutFreight,
  invoiceCustomsValue,
  landedForCalcDisplay,
  mergeLandedIntoDraft,
  pdfLandedFields,
  refreshLandedPayments,
  landedFromAiDraft,
  sumItemQty,
} from "@/lib/ved/landed-cost";
import { recordVerifiedFromApprove } from "@/lib/ved/verified-determinations";
import {
  assertBrokerAcceptingJobs,
  assertNotInMaintenance,
  assertPaymentsEnabled,
} from "@/lib/ved/platform-gates";
import { getPlatformSettings } from "@/lib/ved/settings";
import { shouldEnqueueAiDrain } from "@/lib/ved/ai-pipeline";
import { normalizeHsCode } from "@/lib/ved/tnved";
import type { CalculationStatus, Prisma, TariffCode } from "@prisma/client";
import { logAction } from "@/lib/audit";

const PAID_STATUSES: CalculationStatus[] = ["QUEUED", "IN_REVIEW", "DONE", "SLA_RISK"];
const CLAIMABLE_STATUSES: CalculationStatus[] = ["QUEUED", "SLA_RISK"];
const APPROVABLE_STATUSES: CalculationStatus[] = ["IN_REVIEW", "SLA_RISK"];

export type CalcItemInput = {
  name: string;
  description?: string;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  mediaUrl?: string;
  attrs?: ProductAttrs;
  manufacturerSkuId?: string;
};

async function allocNumber() {
  const count = await prisma.calculation.count();
  let n = nextCalculationNumber(count + 1);
  for (let i = 0; i < 20; i++) {
    const exists = await prisma.calculation.findUnique({ where: { number: n } });
    if (!exists) return n;
    n = nextCalculationNumber(count + 2 + i);
  }
  return `#${Date.now().toString().slice(-6)}`;
}

export async function createAndDraftCalculation(opts: {
  clientUserId: string;
  companyId: string;
  title: string;
  description: string;
  country?: string;
  shipmentValue?: string;
  shipmentCurrency?: string;
  tariffCode?: TariffCode;
  preferredBrokerUserId?: string;
  items?: CalcItemInput[];
  actorName?: string;
  actorRole?: string;
}) {
  await assertNotInMaintenance(opts.actorRole);
  const tariff = opts.tariffCode
    ? await prisma.tariffPlan.findUnique({ where: { code: opts.tariffCode } })
    : await prisma.tariffPlan.findUnique({ where: { code: "STANDARD" } });

  const maxPos = maxPositionsForTariff(tariff?.code);
  if (opts.items && opts.items.length === 0) {
    throw new Error("At least one item required");
  }
  if (opts.items && opts.items.length > maxPos) {
    throw new Error(`Too many positions (max ${maxPos} for tariff)`);
  }
  const rawItems =
    opts.items && opts.items.length > 0
      ? opts.items
      : [{ name: opts.title, description: opts.description }];
  if (!rawItems.length) {
    throw new Error("At least one item required");
  }
  const itemsWithSku = await hydrateItemsWithPublishedSkus(prisma, rawItems);
  if (!itemsWithSku[0]?.name?.trim()) {
    throw new Error("At least one item required");
  }
  for (const it of itemsWithSku) {
    if (!String(it.name || "").trim() && !it.manufacturerSkuId) continue;
    if (hasRequiredCreateAttrs(it.attrs)) continue;
    const miss = missingRequiredCreateAttrs(it.attrs);
    throw new Error(requiredCreateAttrsError(miss));
  }

  // Optional OCR enrich on items with mediaUrl (fail-open; client attrs win).
  const ocrUrl = (process.env.OCR_SERVICE_URL || "").replace(/\/$/, "");
  const { extractWithOcr, mergeAttrs } = await import("./ocr");
  const itemsWithOcr = await Promise.all(
    itemsWithSku.map(async (it) => {
      if (!it.mediaUrl || !ocrUrl) return it;
      const ocrCall = await recordServiceCall(prisma, {
        service: "ocr",
        operation: "extract",
        status: "PENDING",
        requestMeta: { mediaUrl: it.mediaUrl },
        finished: false,
      });
      const tOcr = Date.now();
      try {
        const extracted = await extractWithOcr({
          mediaUrl: it.mediaUrl,
          hint: `${it.name} ${it.description || opts.description || ""}`,
        });
        await completeServiceCall(prisma, ocrCall.id, {
          status: "OK",
          durationMs: Date.now() - tOcr,
          responseMeta: extracted
            ? { engine: extracted.engine, confidence: extracted.confidence }
            : { skipped: true },
        });
        if (!extracted?.attrs) return it;
        return { ...it, attrs: mergeAttrs(it.attrs, extracted.attrs) };
      } catch (e) {
        await completeServiceCall(prisma, ocrCall.id, {
          status: classifyServiceError(e),
          durationMs: Date.now() - tOcr,
          error: e instanceof Error ? e.message : "ocr failed",
        });
        return it;
      }
    })
  );

  const number = await allocNumber();
  const invoice = invoiceCustomsValue(opts.shipmentValue, opts.shipmentCurrency);
  // Phase A — persist shell + items (AI_PROCESSING). Nested create is one statement; wrap for clarity (D23).
  const calc = await prisma.$transaction(async (tx) => {
    const created = await tx.calculation.create({
      data: {
        number,
        status: "AI_PROCESSING",
        title: opts.title,
        description: opts.description,
        country: opts.country,
        shipmentValue: invoice.storedShipmentValue,
        clientUserId: opts.clientUserId,
        companyId: opts.companyId,
        tariffId: tariff?.id,
        preferredBrokerUserId: opts.preferredBrokerUserId || null,
        items: {
          create: itemsWithOcr.map((it, idx) => {
            const attrs = sanitizeProductAttrs(it.attrs);
            return {
              name: it.name,
              description: it.description || opts.description,
              qty: it.qty,
              unit: it.unit,
              unitPrice: it.unitPrice,
              mediaUrl: it.mediaUrl,
              attrs: attrs ? (attrs as Prisma.InputJsonValue) : undefined,
              manufacturerSkuId: it.manufacturerSkuId || null,
              sortOrder: idx,
            };
          }),
        },
      },
      include: { items: true },
    });
    await appendCalculationEvent(tx, {
      calculationId: created.id,
      kind: "CREATED",
      actorUserId: opts.clientUserId,
      payload: { number, to: "AI_PROCESSING" },
    });
    return created;
  });

  const settings = await getPlatformSettings();
  const willAiDrain = shouldEnqueueAiDrain(settings);
  const aiCall = await recordServiceCall(prisma, {
    service: process.env.AI_SERVICE_URL || process.env.AI_URL ? "ai" : "api",
    operation: "draft",
    status: "PENDING",
    correlationId: calc.id,
    calculationId: calc.id,
    requestMeta: { country: opts.country },
    finished: false,
  });
  const t0 = Date.now();
  let draft;
  try {
    draft = await requestAiDraft({
      description: opts.description,
      country: opts.country,
      title: opts.title,
      name: itemsWithOcr[0]?.name,
      attrs: sanitizeProductAttrs(itemsWithOcr[0]?.attrs as ProductAttrs) || undefined,
      shipmentValue: invoice.storedShipmentValue,
      // Accurate HS comes from AI_DRAIN (after()+poll ≤2m); avoid double DeepSeek on create.
      skipLlmEnrich: willAiDrain,
    });
    await completeServiceCall(prisma, aiCall.id, {
      status: "OK",
      durationMs: Date.now() - t0,
      responseMeta: { hsCode: draft.hsCode, confidence: draft.confidence },
    });
  } catch (e) {
    await completeServiceCall(prisma, aiCall.id, {
      status: classifyServiceError(e),
      durationMs: Date.now() - t0,
      error: e instanceof Error ? e.message : "AI draft failed",
    });
    throw e;
  }

  const customs = invoiceCustomsValue(
    invoice.storedShipmentValue,
    invoice.invoice.currency,
    settings
  );
  const pays = computePayments({
    customsValueRub: customs.goodsRub,
    dutyPercent: draft.duties.customsDutyPercent,
    vatPercent: draft.duties.vatPercent,
    feeFromSchedule: true,
    usdRate: settings.usdRate,
  });
  const landed = assembleLandedWithoutFreight({
    invoiceAmount: customs.invoice.amount,
    currency: customs.invoice.currency,
    goodsRub: customs.goodsRub,
    bufferPct: customs.rates.bufferPct,
    dutyRub: pays.dutyRub,
    vatRub: pays.vatRub,
    feeRub: pays.feeRub,
    qty: sumItemQty(itemsWithOcr),
  });
  // Keep aiDraft duties in sync with charged fee / VAT base.
  const draftPayload = mergeLandedIntoDraft(
    {
      ...draft,
      duties: {
        ...draft.duties,
        feeRub: pays.feeRub,
        vatPercent: draft.duties.vatPercent,
      },
      ...(willAiDrain ? { llmEnrichPending: true } : {}),
    },
    landed
  );

  const n = Math.max(calc.items.length, 1);
  const dutyEach = Math.round(pays.dutyRub / n);
  const vatEach = Math.round(pays.vatRub / n);

  assertTransition("AI_PROCESSING", "AI_READY");

  // Phase B — item draft fields + AI_READY in one transaction (D23).
  const updated = await prisma.$transaction(async (tx) => {
    const tnved = normalizeHsCode(draft.hsCode);
    await Promise.all(
      calc.items.map((item, idx) =>
        tx.calculationItem.update({
          where: { id: item.id },
          data: {
            hsCodeAi: draft.hsCode,
            tnvedCode: tnved,
            dutyRub: idx === n - 1 ? pays.dutyRub - dutyEach * (n - 1) : dutyEach,
            vatRub: idx === n - 1 ? pays.vatRub - vatEach * (n - 1) : vatEach,
          },
        })
      )
    );
    const row = await tx.calculation.update({
      where: { id: calc.id },
      data: {
        status: "AI_READY",
        aiDraft: draftPayload as object,
        hsCode: draft.hsCode,
        confidence: draft.confidence,
        dutyRub: pays.dutyRub,
        vatRub: pays.vatRub,
        feeRub: pays.feeRub,
        totalPaymentsRub: pays.totalPaymentsRub,
      },
      include: { tariff: true, items: true },
    });
    await appendCalculationEvent(tx, {
      calculationId: calc.id,
      kind: "AI_DRAFT",
      actorUserId: opts.clientUserId,
      payload: {
        ...statusChangePayload("AI_PROCESSING", "AI_READY"),
        draft: { hsCode: draft.hsCode, confidence: draft.confidence },
      },
    });
    return row;
  });

  await logAction({
    action: "AI_DRAFT",
    entity: "calculation",
    entityId: calc.id,
    userId: opts.clientUserId,
    userName: opts.actorName,
    userRole: opts.actorRole,
    details: `${number} · ${draft.hsCode} · conf ${draft.confidence}`,
  });

  try {
    if (willAiDrain) {
      await enqueueBackgroundJob(prisma, {
        kind: "AI_DRAIN",
        calculationId: calc.id,
        maxAttempts: 6,
        payload: {
          calculationId: calc.id,
          hasMedia: itemsWithOcr.some((it) => Boolean(it.mediaUrl)),
        },
      });
      // Drain runs via route `after()` / worker / jobs-tick — create HTTP stays short.
    }
  } catch {
    /* fail-open: missing job must not block AI_READY */
  }

  return updated;
}

export async function payCalculation(opts: {
  calculationId: string;
  clientUserId: string;
  preferredBrokerUserId?: string;
  actorName?: string;
  actorRole?: string;
}) {
  await assertNotInMaintenance(opts.actorRole);
  await assertPaymentsEnabled();
  const calc = await prisma.calculation.findUniqueOrThrow({
    where: { id: opts.calculationId },
    include: { tariff: true, company: true, items: true },
  });

  if (calc.clientUserId !== opts.clientUserId) {
    throw new Error("Forbidden");
  }

  // Idempotent retry: already paid — no second charge (D23).
  if (PAID_STATUSES.includes(calc.status) && calc.paidAt) {
    return calc;
  }

  if (!["AI_READY", "AWAITING_PAYMENT"].includes(calc.status)) {
    throw new Error(`Cannot pay from status ${calc.status}`);
  }
  if (!calc.companyId || !calc.tariff) {
    throw new Error("Company or tariff missing");
  }

  const preferredBrokerUserId =
    opts.preferredBrokerUserId !== undefined
      ? opts.preferredBrokerUserId || null
      : calc.preferredBrokerUserId;

  const settings = await getPlatformSettings();
  const conf = calc.confidence ?? 0;
  const brokerNeeded = needsBroker(calc.tariff.code, conf, settings.confidenceThreshold);

  let status: CalculationStatus;
  let slaDeadline: Date | null = null;
  let pdfHtml: string | null = null;
  let doneAt: Date | null = null;

  if (brokerNeeded) {
    status = "QUEUED";
    slaDeadline = new Date(Date.now() + (calc.tariff.slaHours || settings.defaultSlaHours) * 3600_000);
  } else {
    status = "DONE";
    doneAt = new Date();
    const draft = calc.aiDraft as { disclaimer?: string } | null;
    const landed = landedForCalcDisplay(calc);
    pdfHtml = buildPdfHtml({
      number: calc.number,
      title: calc.title,
      hsCode: calc.hsCode,
      hsCodeFinal: calc.hsCode,
      dutyRub: calc.dutyRub,
      vatRub: calc.vatRub,
      feeRub: calc.feeRub,
      extraFeeRub: calc.extraFeeRub,
      extraFeeNote: calc.extraFeeNote,
      totalPaymentsRub: calc.totalPaymentsRub,
      confidence: calc.confidence,
      disclaimer: [draft?.disclaimer, landed?.note].filter(Boolean).join(" "),
      items: calc.items,
      ...pdfLandedFields(landed),
    });
  }

  assertTransition(calc.status, status);

  const price = calc.tariff.priceRub;
  const paidAt = new Date();

  // Ledger charge + status in one transaction (D23).
  const updated = await creditCompany({
    companyId: calc.companyId,
    amountRub: -price,
    kind: "TARIFF_CHARGE",
    description: `Оплата тарифа ${calc.tariff.name} · ${calc.number}`,
    calculationId: calc.id,
    createdById: opts.clientUserId,
    after: async (tx) => {
      const row = await tx.calculation.update({
        where: { id: calc.id },
        data: {
          status,
          preferredBrokerUserId,
          paidAt,
          queuedAt: brokerNeeded ? paidAt : null,
          slaDeadline,
          doneAt,
          pdfHtml,
          hsCodeFinal: brokerNeeded ? null : calc.hsCode,
        },
        include: { tariff: true, items: true },
      });
      await appendCalculationEvent(tx, {
        calculationId: calc.id,
        kind: "PAID",
        actorUserId: opts.clientUserId,
        payload: statusChangePayload(calc.status, status),
      });
      return row;
    },
  });

  await logAction({
    action: "PAY",
    entity: "calculation",
    entityId: calc.id,
    userId: opts.clientUserId,
    userName: opts.actorName,
    userRole: opts.actorRole,
    details: `${calc.number} · ${price} ₽ · → ${status}${preferredBrokerUserId ? ` · preferred ${preferredBrokerUserId}` : ""}`,
  });

  if (status === "QUEUED" && settings.autoAssignBrokers) {
    try {
      const brokerId = await resolveAutoAssignBrokerUserId(preferredBrokerUserId);
      if (brokerId) {
        return await claimCalculation({
          calculationId: calc.id,
          brokerUserId: brokerId,
          actorName: "auto-assign",
          actorRole: "ADMIN",
        });
      }
    } catch {
      /* leave QUEUED for marketplace */
    }
  }

  return updated;
}

/** Pick preferred or highest-rated accepting APPROVED broker. */
async function resolveAutoAssignBrokerUserId(preferredBrokerUserId?: string | null) {
  if (preferredBrokerUserId) {
    const preferred = await prisma.brokerProfile.findUnique({
      where: { userId: preferredBrokerUserId },
      select: { acceptingJobs: true, moderationStatus: true, userId: true },
    });
    if (
      preferred &&
      preferred.moderationStatus === "APPROVED" &&
      preferred.acceptingJobs !== false
    ) {
      return preferred.userId;
    }
  }
  const best = await prisma.brokerProfile.findFirst({
    where: { moderationStatus: "APPROVED", acceptingJobs: true },
    orderBy: { rating: "desc" },
    select: { userId: true },
  });
  return best?.userId ?? null;
}

export async function claimCalculation(opts: {
  calculationId: string;
  brokerUserId: string;
  actorName?: string;
  actorRole?: string;
}) {
  const calc = await prisma.calculation.findUniqueOrThrow({ where: { id: opts.calculationId } });
  if (!CLAIMABLE_STATUSES.includes(calc.status)) {
    throw new Error(`Cannot claim from ${calc.status}`);
  }

  assertTransition(calc.status, "IN_REVIEW");
  await assertBrokerAcceptingJobs(opts.brokerUserId, opts.actorRole);

  const settings = await getPlatformSettings();
  const exclusive = isPreferredExclusiveActive({
    preferredBrokerUserId: calc.preferredBrokerUserId,
    queuedAt: calc.queuedAt,
    preferredClaimHours: settings.preferredClaimHours,
  });

  if (
    exclusive &&
    calc.preferredBrokerUserId &&
    calc.preferredBrokerUserId !== opts.brokerUserId &&
    opts.actorRole !== "ADMIN" &&
    opts.actorRole !== "SUPER_ADMIN"
  ) {
    throw new Error("Reserved for preferred broker");
  }

  const clearPreferred = Boolean(
    calc.preferredBrokerUserId &&
      calc.preferredBrokerUserId !== opts.brokerUserId &&
      !exclusive
  );

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.calculation.updateMany({
      where: { id: calc.id, status: { in: CLAIMABLE_STATUSES } },
      data: {
        status: "IN_REVIEW",
        brokerUserId: opts.brokerUserId,
        claimedAt: new Date(),
        ...(clearPreferred ? { preferredBrokerUserId: null } : {}),
      },
    });
    if (claimed.count === 0) {
      throw new Error("Claim conflict");
    }
    const row = await tx.calculation.findUniqueOrThrow({
      where: { id: calc.id },
      include: { tariff: true, items: true },
    });
    await tx.brokerAssignment.create({
      data: {
        calculationId: calc.id,
        brokerUserId: opts.brokerUserId,
        kind: "CLAIM",
      },
    });
    const existingThread = await tx.chatThread.findFirst({
      where: { calculationId: calc.id, kind: "CALCULATION" },
    });
    if (!existingThread) {
      await tx.chatThread.create({
        data: {
          kind: "CALCULATION",
          calculationId: calc.id,
          subject: `Чат · ${calc.number}`,
          waitingOn: "BROKER",
        },
      });
    }
    await appendCalculationEvent(tx, {
      calculationId: calc.id,
      kind: "CLAIMED",
      actorUserId: opts.brokerUserId,
      payload: statusChangePayload(calc.status, "IN_REVIEW"),
    });
    return row;
  });

  await logAction({
    action: "CLAIM",
    entity: "calculation",
    entityId: calc.id,
    userId: opts.brokerUserId,
    userName: opts.actorName,
    userRole: opts.actorRole,
    details: calc.number,
  });

  return updated;
}

export type ApproveItemInput = {
  id: string;
  hsCodeFinal: string;
  dutyRub?: number;
  vatRub?: number;
  unitPrice?: number;
  /** Broker commercial description for PDF — does not overwrite Calculation.description. */
  description?: string | null;
  /** Only empty keys are applied server-side (fillEmptyProductAttrs). */
  attrs?: ProductAttrs | null;
};

function brokerItemUpdateData(
  row: ApproveItemInput,
  now: Date,
  existingAttrs?: ProductAttrs | null
) {
  const data: {
    hsCodeFinal: string;
    tnvedCode: string;
    dutyRub?: number;
    vatRub?: number;
    unitPrice?: number;
    confirmedByBrokerAt: Date;
    description?: string | null;
    attrs?: Prisma.InputJsonValue;
  } = {
    hsCodeFinal: row.hsCodeFinal,
    tnvedCode: normalizeHsCode(row.hsCodeFinal) || "",
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
    if (merged) {
      data.attrs = merged as Prisma.InputJsonValue;
    } else if (existingAttrs && Object.keys(existingAttrs).length) {
      // Keep prior attrs if merge somehow empty but existing had data
      data.attrs = existingAttrs as Prisma.InputJsonValue;
    }
    // If both empty — omit attrs from update (leave DB null/empty)
  }
  return data;
}

/** Persist mapping edits without closing the job (Phase 3 two-step). */
export async function saveCalculationItems(opts: {
  calculationId: string;
  brokerUserId: string;
  hsCodeFinal?: string;
  feeRub?: number;
  extraFeeRub?: number;
  extraFeeNote?: string | null;
  items: ApproveItemInput[];
  actorName?: string;
  actorRole?: string;
}) {
  const calc = await prisma.calculation.findUniqueOrThrow({
    where: { id: opts.calculationId },
    include: { items: true, tariff: true },
  });
  if (calc.brokerUserId !== opts.brokerUserId && opts.actorRole !== "ADMIN" && opts.actorRole !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
  if (!["IN_REVIEW", "SLA_RISK"].includes(calc.status)) {
    throw new Error(`Cannot save items from ${calc.status}`);
  }
  if (!opts.items.length) {
    throw new Error("At least one item required");
  }

  const maxPos = maxPositionsForTariff(calc.tariff?.code);
  if (opts.items.length > maxPos) {
    throw new Error(`Too many positions (max ${maxPos} for tariff)`);
  }

  const owned = new Set(calc.items.map((i) => i.id));
  for (const row of opts.items) {
    if (!row.id || row.id === "synthetic") {
      throw new Error("Invalid item id");
    }
    if (!owned.has(row.id)) {
      throw new Error(`Unknown item id: ${row.id}`);
    }
  }

  const now = new Date();
  const feeRub = opts.feeRub ?? calc.feeRub ?? 0;
  const extra = normalizeBrokerExtraFee({
    extraFeeRub: opts.extraFeeRub ?? calc.extraFeeRub,
    extraFeeNote: opts.extraFeeNote !== undefined ? opts.extraFeeNote : calc.extraFeeNote,
  });
  const existingById = new Map(
    calc.items.map((i) => [i.id, sanitizeProductAttrs(i.attrs as ProductAttrs) || null])
  );
  return prisma.$transaction(async (tx) => {
    const filledNotes: string[] = [];
    for (const row of opts.items) {
      const before = existingById.get(row.id) || null;
      const data = brokerItemUpdateData(row, now, before);
      await tx.calculationItem.update({
        where: { id: row.id },
        data,
      });
      if (row.attrs !== undefined) {
        const after = fillEmptyProductAttrs(before, row.attrs);
        const filled = brokerFilledAttrKeys(before, after);
        if (filled.length) filledNotes.push(`${row.id}: ${filled.join(",")}`);
      }
    }

    const refreshed = await tx.calculationItem.findMany({
      where: { calculationId: calc.id },
      orderBy: { sortOrder: "asc" },
    });
    const summed = sumItemPayments(refreshed, feeRub, extra.extraFeeRub);

    const updated = await tx.calculation.update({
      where: { id: calc.id },
      data: {
        hsCodeFinal: opts.hsCodeFinal ?? refreshed[0]?.hsCodeFinal ?? calc.hsCodeFinal,
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
      actorUserId: opts.brokerUserId,
      payload: {
        items: opts.items.map((i) => ({
          id: i.id,
          hsCodeFinal: i.hsCodeFinal,
          ...(i.dutyRub != null ? { dutyRub: i.dutyRub } : {}),
          ...(i.vatRub != null ? { vatRub: i.vatRub } : {}),
          ...(i.description !== undefined
            ? { description: sanitizeBrokerItemDescription(i.description) }
            : {}),
          ...(i.attrs !== undefined
            ? {
                attrsFilled: brokerFilledAttrKeys(
                  existingById.get(i.id),
                  fillEmptyProductAttrs(existingById.get(i.id), i.attrs)
                ),
              }
            : {}),
        })),
        ...(extra.extraFeeRub > 0
          ? { note: `Прочие сборы ${extra.extraFeeRub} ₽ · ${extra.extraFeeNote}` }
          : filledNotes.length
            ? { note: `Attrs filled: ${filledNotes.join("; ")}`.slice(0, 2000) }
            : {}),
      },
    });
    return updated;
  });
}

export async function approveCalculation(opts: {
  calculationId: string;
  brokerUserId: string;
  hsCodeFinal: string;
  comment?: string;
  dutyRub?: number;
  vatRub?: number;
  feeRub?: number;
  extraFeeRub?: number;
  extraFeeNote?: string | null;
  items?: ApproveItemInput[];
  actorName?: string;
  actorRole?: string;
}) {
  const calc = await prisma.calculation.findUniqueOrThrow({
    where: { id: opts.calculationId },
    include: { items: true, tariff: true },
  });
  if (calc.brokerUserId !== opts.brokerUserId && opts.actorRole !== "ADMIN" && opts.actorRole !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
  if (!APPROVABLE_STATUSES.includes(calc.status)) {
    throw new Error(`Cannot approve from ${calc.status}`);
  }

  assertTransition(calc.status, "DONE");

  if (calc.items.length === 0) {
    throw new Error("Calculation has no items — create items before approve");
  }

  const maxPos = maxPositionsForTariff(calc.tariff?.code);
  if (calc.items.length > maxPos) {
    throw new Error(`Too many positions (max ${maxPos} for tariff)`);
  }

  if (opts.items && opts.items.length > 0) {
    if (opts.items.length > maxPos) {
      throw new Error(`Too many positions (max ${maxPos} for tariff)`);
    }
    const owned = new Set(calc.items.map((i) => i.id));
    for (const row of opts.items) {
      if (!row.id || row.id === "synthetic") {
        throw new Error("Invalid item id");
      }
      if (!owned.has(row.id)) {
        throw new Error(`Unknown item id: ${row.id}`);
      }
    }
  }

  const feeRub = opts.feeRub ?? calc.feeRub ?? 0;
  const extra = normalizeBrokerExtraFee({
    extraFeeRub: opts.extraFeeRub ?? calc.extraFeeRub,
    extraFeeNote: opts.extraFeeNote !== undefined ? opts.extraFeeNote : calc.extraFeeNote,
  });
  const draft = calc.aiDraft as { disclaimer?: string } | null;

  const client = await prisma.user.findUnique({
    where: { id: calc.clientUserId },
    select: { email: true },
  });
  const notifyTo = client?.email || calc.clientUserId;

  const updated = await prisma.$transaction(async (tx) => {
    let dutyRub = opts.dutyRub ?? calc.dutyRub ?? 0;
    let vatRub = opts.vatRub ?? calc.vatRub ?? 0;

    if (opts.items && opts.items.length > 0) {
      const now = new Date();
      const existingById = new Map(
        calc.items.map((i) => [i.id, sanitizeProductAttrs(i.attrs as ProductAttrs) || null])
      );
      for (const row of opts.items) {
        await tx.calculationItem.update({
          where: { id: row.id },
          data: brokerItemUpdateData(row, now, existingById.get(row.id) || null),
        });
      }
      const refreshed = await tx.calculationItem.findMany({ where: { calculationId: calc.id } });
      const summed = sumItemPayments(refreshed, feeRub, extra.extraFeeRub);
      dutyRub = summed.dutyRub;
      vatRub = summed.vatRub;
    }

    const totalPaymentsRub = dutyRub + vatRub + feeRub + extra.extraFeeRub;
    const items = await tx.calculationItem.findMany({
      where: { calculationId: calc.id },
      orderBy: { sortOrder: "asc" },
    });

    const landed = refreshLandedPayments(landedFromAiDraft(calc.aiDraft), {
      dutyRub,
      vatRub,
      feeRub,
      extraFeeRub: extra.extraFeeRub,
      qty: sumItemQty(items),
    });
    const nextDraft = mergeLandedIntoDraft(calc.aiDraft, landed);
    const pdfHtml = buildPdfHtml({
      number: calc.number,
      title: calc.title,
      hsCode: calc.hsCode,
      hsCodeFinal: opts.hsCodeFinal,
      dutyRub,
      vatRub,
      feeRub,
      extraFeeRub: extra.extraFeeRub,
      extraFeeNote: extra.extraFeeNote,
      totalPaymentsRub,
      confidence: calc.confidence,
      brokerComment: opts.comment,
      disclaimer: [draft?.disclaimer, landed?.note].filter(Boolean).join(" "),
      items,
      ...pdfLandedFields(landed),
    });

    const row = await tx.calculation.update({
      where: { id: calc.id },
      data: {
        status: "DONE",
        hsCodeFinal: opts.hsCodeFinal,
        brokerComment: opts.comment,
        dutyRub,
        vatRub,
        feeRub,
        extraFeeRub: extra.extraFeeRub,
        extraFeeNote: extra.extraFeeNote,
        totalPaymentsRub,
        doneAt: new Date(),
        pdfHtml,
        aiDraft: nextDraft as object,
      },
      include: { tariff: true, items: true },
    });
    await appendCalculationEvent(tx, {
      calculationId: calc.id,
      kind: "APPROVED",
      actorUserId: opts.brokerUserId,
      payload: {
        ...statusChangePayload(calc.status, "DONE"),
        note: opts.hsCodeFinal,
      },
    });
    const outbox = await enqueueOutbox(tx, {
      template: "calc.approved",
      to: notifyTo,
      payload: { calculationId: calc.id, number: calc.number },
      calculationId: calc.id,
      companyId: calc.companyId,
    });
    return { row, outboxId: outbox.id };
  });

  // Payout — separate short transaction after DONE (D23); not in the same saga as notify.
  if (calc.tariffId) {
    await prisma.$transaction(async (tx) => {
      const tariff = await tx.tariffPlan.findUnique({ where: { id: calc.tariffId! } });
      const profile = await tx.brokerProfile.findUnique({ where: { userId: opts.brokerUserId } });
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

  await kickNotifyDelivery({
    template: "calc.approved",
    to: notifyTo,
    payload: { calculationId: calc.id, number: calc.number },
    outboxId: updated.outboxId,
  });

  await logAction({
    action: "APPROVE",
    entity: "calculation",
    entityId: calc.id,
    userId: opts.brokerUserId,
    userName: opts.actorName,
    userRole: opts.actorRole,
    details: `${calc.number} · ${opts.hsCodeFinal}`,
  });

  try {
    await recordVerifiedFromApprove(prisma, {
      calculationId: calc.id,
      approvedByUserId: opts.brokerUserId,
      brokerComment: opts.comment,
      title: calc.title,
      quality: calc.clientFeedbackReaction === "HELPFUL" ? "CLIENT_HELPFUL" : "BROKER",
      items: updated.row.items.map((i) => ({
        name: i.name,
        description: i.description,
        attrs: sanitizeProductAttrs(i.attrs as ProductAttrs) || undefined,
        hsCodeFinal: i.hsCodeFinal || opts.hsCodeFinal,
        dutyRub: i.dutyRub,
        vatRub: i.vatRub,
        feeRub: updated.row.feeRub,
        itemId: i.id,
      })),
    });
  } catch {
    /* fail-open: precedent write-back must not block approve */
  }

  return updated.row;
}

/**
 * Broker reclassify: LLM classify with broker feedback (skip precedent).
 * Updates hsCodeAi / calc hsCode; stays IN_REVIEW. Fail-open → throw only on auth/status.
 */
export async function reclassifyCalculation(opts: {
  calculationId: string;
  brokerUserId: string;
  brokerFeedback: string;
  itemId?: string;
  actorRole?: string;
  actorName?: string;
}) {
  const feedback = opts.brokerFeedback.trim();
  if (feedback.length < 3) throw new Error("brokerFeedback required (min 3 chars)");

  const calc = await prisma.calculation.findUniqueOrThrow({
    where: { id: opts.calculationId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (
    calc.brokerUserId !== opts.brokerUserId &&
    opts.actorRole !== "ADMIN" &&
    opts.actorRole !== "SUPER_ADMIN"
  ) {
    throw new Error("Forbidden");
  }
  if (!["IN_REVIEW", "SLA_RISK"].includes(calc.status)) {
    throw new Error(`Cannot reclassify from ${calc.status}`);
  }

  const settings = await getPlatformSettings();
  if (settings.llmEnrichEnabled === false) {
    throw new Error("LLM enrich disabled");
  }
  const llmUrl = (process.env.LLM_SERVICE_URL || "").replace(/\/$/, "");
  if (!llmUrl) throw new Error("LLM_SERVICE_URL not configured");

  const targetItems = opts.itemId
    ? calc.items.filter((i) => i.id === opts.itemId)
    : calc.items;
  if (!targetItems.length) throw new Error("No items to reclassify");

  const llmCall = await recordServiceCall(prisma, {
    service: "llm",
    operation: "reclassify",
    status: "PENDING",
    correlationId: calc.id,
    calculationId: calc.id,
    requestMeta: { feedback: feedback.slice(0, 200), itemCount: targetItems.length },
    finished: false,
  });
  const t0 = Date.now();

  try {
    const updates: Array<{
      id: string;
      hsCodeAi: string;
      confidence?: number;
      engine?: string;
    }> = [];

    for (const item of targetItems) {
      const description = [
        item.description || calc.description || item.name,
        `Комментарий брокера (переклассификация): ${feedback}`,
      ].join("\n\n");
      const res = await fetch(`${llmUrl}/v1/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.name || calc.title,
          description,
          country: calc.country,
        }),
        signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 30000)),
      });
      if (!res.ok) throw new Error(`LLM classify ${res.status}`);
      const classified = (await res.json()) as {
        hsCode?: string;
        confidence?: number;
        engine?: string;
        disclaimer?: string;
      };
      if (!classified.hsCode) throw new Error("LLM returned empty hsCode");
      updates.push({
        id: item.id,
        hsCodeAi: classified.hsCode,
        confidence: classified.confidence,
        engine: classified.engine || "llm-openai-v1",
      });
    }

    await completeServiceCall(prisma, llmCall.id, {
      status: "OK",
      durationMs: Date.now() - t0,
      responseMeta: { hs: updates.map((u) => u.hsCodeAi) },
    });

    const primary = updates[0];
    const draft = (calc.aiDraft as Record<string, unknown> | null) || {};

    return prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.calculationItem.update({
          where: { id: u.id },
          data: { hsCodeAi: u.hsCodeAi },
        });
      }
      const row = await tx.calculation.update({
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
          } as object,
        },
        include: { items: true, tariff: true },
      });
      await appendCalculationEvent(tx, {
        calculationId: calc.id,
        kind: "NOTE",
        actorUserId: opts.brokerUserId,
        payload: {
          note: `reclassify: ${feedback.slice(0, 280)}`,
          items: updates.map((u) => ({ id: u.id, hsCodeAi: u.hsCodeAi })),
        },
      });
      return row;
    });
  } catch (e) {
    await completeServiceCall(prisma, llmCall.id, {
      status: classifyServiceError(e),
      durationMs: Date.now() - t0,
      error: e instanceof Error ? e.message : "reclassify failed",
    });
    throw e;
  }
}

/**
 * Worker / internal: escalate overdue SLA → SLA_RISK; release preferred exclusive after timeout.
 */
export async function runSlaTick(opts?: { actorUserId?: string }) {
  const settings = await getPlatformSettings();
  const now = new Date();

  const overdue = await prisma.calculation.findMany({
    where: {
      status: { in: ["QUEUED", "IN_REVIEW"] },
      slaDeadline: { lt: now },
    },
    select: { id: true, number: true, status: true },
  });

  let escalated = 0;
  for (const row of overdue) {
    assertTransition(row.status, "SLA_RISK");
    const opsTo = process.env.NOTIFY_OPS_EMAIL || "ops@lbm.local";
    const outbox = await prisma.$transaction(async (tx) => {
      await tx.calculation.update({
        where: { id: row.id },
        data: { status: "SLA_RISK" },
      });
      return enqueueOutbox(tx, {
        template: "calc.sla_risk",
        to: opsTo,
        payload: { calculationId: row.id, number: row.number },
        calculationId: row.id,
      });
    });
    escalated += 1;
    await kickNotifyDelivery({
      template: "calc.sla_risk",
      to: opsTo,
      payload: { calculationId: row.id, number: row.number },
      outboxId: outbox.id,
    });
  }

  const preferredQueued = await prisma.calculation.findMany({
    where: {
      status: { in: ["QUEUED", "SLA_RISK"] },
      preferredBrokerUserId: { not: null },
      queuedAt: { not: null },
    },
    select: {
      id: true,
      number: true,
      preferredBrokerUserId: true,
      queuedAt: true,
    },
  });

  let releasedPreferred = 0;
  for (const row of preferredQueued) {
    const stillExclusive = isPreferredExclusiveActive({
      preferredBrokerUserId: row.preferredBrokerUserId,
      queuedAt: row.queuedAt,
      preferredClaimHours: settings.preferredClaimHours,
      now,
    });
    if (!stillExclusive) {
      const opsTo = process.env.NOTIFY_OPS_EMAIL || "ops@lbm.local";
      const releasedPayload = {
        subject: "Preferred broker released",
        body: `Preferred window expired for ${row.number}`,
        calculationId: row.id,
        number: row.number,
      };
      const outbox = await prisma.$transaction(async (tx) => {
        await tx.calculation.update({
          where: { id: row.id },
          data: { preferredBrokerUserId: null },
        });
        return enqueueOutbox(tx, {
          template: "generic",
          to: opsTo,
          payload: releasedPayload,
          calculationId: row.id,
        });
      });
      releasedPreferred += 1;
      await kickNotifyDelivery({
        template: "generic",
        to: opsTo,
        payload: releasedPayload,
        outboxId: outbox.id,
      });
    }
  }

  if (opts?.actorUserId && (escalated > 0 || releasedPreferred > 0)) {
    await logAction({
      action: "SLA_TICK",
      entity: "system",
      entityId: "sla",
      userId: opts.actorUserId,
      details: `escalated=${escalated} releasedPreferred=${releasedPreferred}`,
    });
  }

  return { escalated, releasedPreferred, at: now.toISOString() };
}

export async function assignBroker(opts: {
  calculationId: string;
  brokerUserId: string;
  adminUserId: string;
  actorName?: string;
  actorRole?: string;
}) {
  const calc = await prisma.calculation.findUniqueOrThrow({ where: { id: opts.calculationId } });
  const nextStatus =
    calc.status === "QUEUED" || calc.status === "SLA_RISK" ? ("IN_REVIEW" as const) : calc.status;
  if (nextStatus !== calc.status) {
    assertTransition(calc.status, nextStatus);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.calculation.update({
      where: { id: calc.id },
      data: {
        brokerUserId: opts.brokerUserId,
        preferredBrokerUserId: opts.brokerUserId,
        status: nextStatus,
        claimedAt: new Date(),
        queuedAt: calc.queuedAt ?? new Date(),
      },
    });
    await tx.brokerAssignment.create({
      data: {
        calculationId: calc.id,
        brokerUserId: opts.brokerUserId,
        kind: "ASSIGN",
      },
    });
    return row;
  });

  await logAction({
    action: "ASSIGN",
    entity: "calculation",
    entityId: calc.id,
    userId: opts.adminUserId,
    userName: opts.actorName,
    userRole: opts.actorRole,
    details: `${calc.number} → broker ${opts.brokerUserId}`,
  });

  return updated;
}

export async function escalateSla(opts: {
  calculationId: string;
  adminUserId: string;
  actorName?: string;
  actorRole?: string;
}) {
  const calc = await prisma.calculation.findUniqueOrThrow({
    where: { id: opts.calculationId },
    select: { id: true, number: true, status: true, brokerUserId: true },
  });
  assertTransition(calc.status, "SLA_RISK");

  const isStaff = opts.actorRole === "ADMIN" || opts.actorRole === "SUPER_ADMIN";
  if (!isStaff) {
    if (opts.actorRole !== "BROKER") {
      throw new Error("Forbidden");
    }
    if (calc.brokerUserId !== opts.adminUserId) {
      throw new Error("Forbidden");
    }
    if (calc.status !== "IN_REVIEW") {
      throw new Error("Broker can only escalate own IN_REVIEW jobs");
    }
  }

  const updated = await prisma.calculation.update({
    where: { id: opts.calculationId },
    data: { status: "SLA_RISK" },
  });
  await logAction({
    action: "ESCALATE",
    entity: "calculation",
    entityId: opts.calculationId,
    userId: opts.adminUserId,
    userName: opts.actorName,
    userRole: opts.actorRole,
    details: updated.number,
  });
  return updated;
}
