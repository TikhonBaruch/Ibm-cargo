import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CLIENT_ROLES, BROKER_ROLES } from "@/lib/require-role";
import {
  precedentSuggestRequestSchema,
  searchPrecedentSuggestions,
  type PrecedentSuggestResponse,
} from "@/lib/ved/precedent-suggest";

const SUGGEST_ROLES = [...new Set([...CLIENT_ROLES, ...BROKER_ROLES])];

async function proxyPrecedentsService(
  body: unknown,
  userId: string,
  role?: string
): Promise<Response | null> {
  const base = (process.env.PRECEDENTS_SERVICE_URL || "").replace(/\/$/, "");
  if (!base) return null;
  const key = process.env.INTERNAL_API_KEY || process.env.NEXTAUTH_SECRET || "";
  try {
    return await fetch(`${base}/v1/suggest/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": key,
        "x-user-id": userId,
        ...(role ? { "x-user-role": role } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[suggest/query] precedents service unreachable", err);
    return null;
  }
}

/** POST /api/v1/suggest/query — precedent typeahead (past calcs + verified_determinations). */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(SUGGEST_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = precedentSuggestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const proxied = await proxyPrecedentsService(parsed.data, userId, role);
  if (proxied?.ok) {
    const data = (await proxied.json()) as PrecedentSuggestResponse;
    return NextResponse.json(data);
  }

  try {
    const { items, rejected } = await searchPrecedentSuggestions(prisma, {
      kind: parsed.data.kind,
      q: parsed.data.q,
      userId,
      limit: parsed.data.limit,
    });
    const out: PrecedentSuggestResponse = {
      engine: "precedent-suggest-v1",
      items,
      ...(rejected ? { rejected } : {}),
    };
    return NextResponse.json(out);
  } catch (err) {
    console.error("[suggest/query] local search failed", err);
    return NextResponse.json(
      { engine: "precedent-suggest-v1", items: [], rejected: "error" },
      { status: 200 }
    );
  }
}
