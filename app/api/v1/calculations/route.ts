/**
 * Client/broker list+create for calculations (VED branch 1 + 3).
 * Supports multi-item payloads, preferredBrokerUserId, queue sort for brokers.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CLIENT_ROLES, ADMIN_ROLES } from "@/lib/require-role";
import { z } from "zod";
import { createAndDraftCalculation } from "@/lib/ved/calculations";
import { finishQueuedAiDrainForCalc, isAiDrainPending } from "@/lib/ved/ai-pipeline";
import { proxyDomainApi, forwardDomainResponse } from "@/lib/ved/domain-api";
import { isBrokerQueueVisible } from "@/lib/ved/platform-gates";
import { optionalAllowedMediaUrlSchema } from "@/lib/ved/media-url";
import {
  hasRequiredCreateAttrs,
  missingRequiredCreateAttrs,
  productAttrsSchema,
  requiredCreateAttrsError,
} from "@/lib/ved/product-description";
import type { CalculationStatus, TariffCode } from "@prisma/client";

/** Pro: after() AI_DRAIN — vision (≤90s) + classify (≤120s). */
export const maxDuration = 300;
const itemSchema = z.object({
  name: z.string().max(200).optional().default(""),
  description: z.string().max(2000).optional(),
  qty: z.number().positive().optional(),
  unit: z.string().max(40).optional(),
  unitPrice: z.number().nonnegative().optional(),
  mediaUrl: optionalAllowedMediaUrlSchema,
  attrs: productAttrsSchema.optional(),
  manufacturerSkuId: z.string().min(1).max(40).optional(),
});

const createSchema = z
  .object({
    title: z.string().min(2).max(200),
    description: z.string().min(5).max(5000),
    country: z.string().optional(),
    shipmentValue: z.string().optional(),
    shipmentCurrency: z.enum(["USD", "CNY", "EUR"]).optional(),
    tariffCode: z.enum(["EXPRESS", "STANDARD", "PRO"]).optional(),
    preferredBrokerUserId: z.string().optional(),
    items: z.array(itemSchema).min(1).max(10).optional(),
  })
  .superRefine((body, ctx) => {
    // Title-only create becomes a synthetic item — same required attrs.
    const items = body.items?.length
      ? body.items
      : [{ name: body.title, attrs: undefined, manufacturerSkuId: undefined }];
    items.forEach((it, i) => {
      if (!String(it.name || "").trim() && !it.manufacturerSkuId) return;
      // SKU hydrate fills attrs later in domain / containers/api.
      if (it.manufacturerSkuId) return;
      if (hasRequiredCreateAttrs(it.attrs)) return;
      const miss = missingRequiredCreateAttrs(it.attrs);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: body.items?.length ? ["items", i, "attrs"] : ["items"],
        message: requiredCreateAttrsError(miss),
      });
    });
  });

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole(["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;

  try {
    const role = (session!.user as { role?: string }).role!;
    const userId = (session!.user as { id?: string }).id!;
    const proxied = await proxyDomainApi("/v1/calculations", {
      method: "GET",
      userId,
      role,
      query: req.nextUrl.searchParams,
    });
    if (proxied) {
      return forwardDomainResponse(proxied);
    }

    const status = req.nextUrl.searchParams.get("status") as CalculationStatus | null;
    const scope = req.nextUrl.searchParams.get("scope");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    if (role === "CLIENT") {
      where.clientUserId = userId;
    } else if (role === "BROKER") {
      if (scope === "queue") {
        const profile = await prisma.brokerProfile.findUnique({
          where: { userId },
          select: { acceptingJobs: true },
        });
        if (!isBrokerQueueVisible(profile?.acceptingJobs)) {
          return NextResponse.json([]);
        }
        where.status = { in: ["QUEUED", "SLA_RISK"] };
        where.OR = [
          { preferredBrokerUserId: null, brokerUserId: null },
          { preferredBrokerUserId: userId },
          { brokerUserId: userId },
        ];
      } else if (scope === "mine") {
        where.brokerUserId = userId;
        where.status = { in: ["IN_REVIEW", "SLA_RISK", "DONE"] };
      } else {
        where.OR = [{ brokerUserId: userId }, { status: { in: ["QUEUED", "SLA_RISK"] } }];
      }
    } else if (!ADMIN_ROLES.includes(role as "ADMIN" | "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const q = req.nextUrl.searchParams.get("q");
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
      // List UI never needs PDF HTML — including it makes the payload huge and can stall reload after pay.
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

    // Preferred-for-me first within queue
    if (role === "BROKER" && scope === "queue") {
      items.sort((a, b) => {
        const ap = a.preferredBrokerUserId === userId ? 0 : a.preferredBrokerUserId ? 2 : 1;
        const bp = b.preferredBrokerUserId === userId ? 0 : b.preferredBrokerUserId ? 2 : 1;
        if (ap !== bp) return ap - bp;
        const aq = a.queuedAt?.getTime() ?? 0;
        const bq = b.queuedAt?.getTime() ?? 0;
        return aq - bq;
      });
    }

    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list calculations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;

  try {
    const userId = (session!.user as { id?: string }).id!;
    const role = (session!.user as { role?: string }).role!;
    const name = session!.user?.name || undefined;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.companyId && role === "CLIENT") {
      return NextResponse.json({ error: "Company required" }, { status: 400 });
    }

    let companyId = user?.companyId;
    if (!companyId && ADMIN_ROLES.includes(role as "ADMIN" | "SUPER_ADMIN")) {
      const company = await prisma.company.findFirst();
      companyId = company?.id;
    }
    if (!companyId) {
      return NextResponse.json({ error: "Company required" }, { status: 400 });
    }

    const body = createSchema.parse(await req.json());
    const proxied = await proxyDomainApi("/v1/calculations", {
      method: "POST",
      userId,
      role,
      body,
    });
    if (proxied) {
      return forwardDomainResponse(proxied);
    }
    const calc = await createAndDraftCalculation({
      clientUserId: userId,
      companyId,
      title: body.title,
      description: body.description,
      country: body.country,
      shipmentValue: body.shipmentValue,
      shipmentCurrency: body.shipmentCurrency,
      tariffCode: body.tariffCode as TariffCode | undefined,
      preferredBrokerUserId: body.preferredBrokerUserId,
      items: body.items,
      actorName: name,
      actorRole: role,
    });

    const pending = isAiDrainPending(calc);
    if (pending) {
      const calculationId = calc.id;
      after(async () => {
        try {
          await finishQueuedAiDrainForCalc(prisma, calculationId);
        } catch (e) {
          console.error("[AI_DRAIN after]", calculationId, e);
        }
      });
    }

    return NextResponse.json(
      { ...calc, aiDrainPending: pending },
      { status: 201 }
    );
  } catch (e) {
    // Zod parse/refine (missing origin/manufacturer/composition, bad shapes) → 400, not 500.
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message || "Некорректные данные заявки" },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : "Failed to create calculation";
    const status =
      /required|Too many|Обязательн|At least one|Company required/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
