import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN", "EDITOR"];

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!EDITOR_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") || "landing";

  const sections = await prisma.pageSection.findMany({
    where: { page },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(sections);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { page, type, title, subtitle, content, image, sortOrder, isActive, settings } = body;

  if (!page || !type) {
    return NextResponse.json({ error: "page and type required" }, { status: 400 });
  }

  const section = await prisma.pageSection.create({
    data: {
      page,
      type,
      title,
      subtitle,
      content,
      image,
      sortOrder: sortOrder || 0,
      isActive: isActive !== false,
      settings,
    },
  });

  return NextResponse.json(section, { status: 201 });
}
