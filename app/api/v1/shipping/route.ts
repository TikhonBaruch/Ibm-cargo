import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CLIENT_ROLES } from "@/lib/require-role";
import { fetchShippingQuotes, fetchShippingTracking } from "@/lib/ved/logistics";
import { applyShippingTracking, createShippingRequest, ShippingError } from "@/lib/ved/shipping";
import { proxyDomainApi, forwardDomainResponse } from "@/lib/ved/domain-api";
import { z } from "zod";

const schema = z.object({
  calculationId: z.string().min(1),
  origin: z.string().min(2),
  destination: z.string().min(2),
  mode: z.string().min(2),
  comment: z.string().optional(),
  selectedQuoteId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;
  try {
    const userId = (session!.user as { id?: string }).id!;
    const role = (session!.user as { role?: string }).role!;

    const proxied = await proxyDomainApi("/v1/shipping", {
      method: "GET",
      userId,
      role,
      query: req.nextUrl.searchParams,
    });
    if (proxied) return forwardDomainResponse(proxied);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.companyId) return NextResponse.json([]);

    if (req.nextUrl.searchParams.get("quotes") === "1") {
      const origin = req.nextUrl.searchParams.get("origin") || "Шанхай";
      const destination = req.nextUrl.searchParams.get("destination") || "Москва";
      const mode = req.nextUrl.searchParams.get("mode") || undefined;
      return NextResponse.json(
        await fetchShippingQuotes({ origin, destination, preferredMode: mode || undefined })
      );
    }

    const items = await prisma.shippingRequest.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
    });

    const enriched = await Promise.all(
      items.map(async (row) => {
        if (!row.trackingCode || row.status === "DELIVERED" || row.status === "CANCELLED") {
          return row;
        }
        const track = await fetchShippingTracking(row.trackingCode);
        return applyShippingTracking(prisma, row, track);
      })
    );
    return NextResponse.json(enriched);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list shipping" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;
  try {
    const userId = (session!.user as { id?: string }).id!;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });
    const body = schema.parse(await req.json());

    const proxied = await proxyDomainApi("/v1/shipping", {
      method: "POST",
      userId,
      role: (session!.user as { role?: string }).role,
      body,
    });
    if (proxied) return forwardDomainResponse(proxied);

    try {
      const created = await createShippingRequest(prisma, {
        userId,
        companyId: user.companyId,
        calculationId: body.calculationId,
        origin: body.origin,
        destination: body.destination,
        mode: body.mode,
        comment: body.comment,
        selectedQuoteId: body.selectedQuoteId,
      });
      return NextResponse.json(created, { status: 201 });
    } catch (e) {
      if (e instanceof ShippingError) {
        return NextResponse.json({ error: e.message }, { status: e.httpStatus });
      }
      throw e;
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create shipping" },
      { status: 400 }
    );
  }
}
