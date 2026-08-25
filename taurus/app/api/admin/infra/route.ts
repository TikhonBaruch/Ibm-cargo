import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildInfraSections } from "@/lib/ved/infra-access";

export const dynamic = "force-dynamic";

/** SUPER_ADMIN only — ops structure + credentials from env */
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sections: buildInfraSections(process.env),
  });
}
