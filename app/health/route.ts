import { NextResponse } from "next/server";
import { webHealthPayload } from "@/lib/web-health";

/** Liveness for Compose healthcheck / gateway probe (C5). */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(webHealthPayload());
}
