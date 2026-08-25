import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const specialists = await prisma.user.findMany({
    where: { showInTeam: true },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      bio: true,
      specialization: true,
      phone: true,
      experience: true,
      sortOrder: true,
      showInTeam: true,
      role: true,
      _count: { select: { posts: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(specialists);
}
