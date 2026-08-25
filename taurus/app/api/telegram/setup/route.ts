import { NextRequest, NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/require-role";
import { setWebhook, getWebhookInfo } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  const { url } = await request.json();
  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  const result = await setWebhook(url);
  return NextResponse.json(result);
}

export async function GET() {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  const info = await getWebhookInfo();
  return NextResponse.json(info);
}
