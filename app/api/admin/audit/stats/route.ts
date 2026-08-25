import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalToday, totalWeek, total, byAction, byEntity] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: today } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.auditLog.count(),
    prisma.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { _count: { action: "desc" } } }),
    prisma.auditLog.groupBy({ by: ["entity"], _count: true, orderBy: { _count: { entity: "desc" } } }),
  ]);

  return NextResponse.json({
    totalToday,
    totalWeek,
    total,
    byAction: byAction.map((a) => ({ action: a.action, count: a._count })),
    byEntity: byEntity.map((e) => ({ entity: e.entity, count: e._count })),
  });
}
