import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logUpdate } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const setting = await prisma.siteSetting.findUnique({ where: { key: "restricted_mode" } });
  return NextResponse.json({ enabled: setting?.value === true || setting?.value === "true" });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any)?.role;
  if (role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { enabled } = await req.json();

  await prisma.siteSetting.upsert({
    where: { key: "restricted_mode" },
    update: { value: enabled },
    create: { key: "restricted_mode", value: enabled },
  });

  logUpdate(
    "siteSetting",
    "restricted_mode",
    (session.user as any)?.id || "",
    session.user?.name || "User",
    role,
    `Restricted mode ${enabled ? "ENABLED" : "DISABLED"}`
  );

  return NextResponse.json({ enabled });
}
