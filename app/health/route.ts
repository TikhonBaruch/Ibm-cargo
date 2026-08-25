import { NextResponse } from "next/server";

/** Liveness for Compose healthcheck / gateway probe (C5). */
export async function GET() {
  return NextResponse.json({ ok: true, service: "web" });
}
