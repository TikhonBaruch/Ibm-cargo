import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logUpdate } from "@/lib/audit";

const EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN", "EDITOR"];

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!EDITOR_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pageKey = searchParams.get("pageKey");

  if (pageKey) {
    const seo = await prisma.siteSeo.findUnique({ where: { pageKey } });
    return NextResponse.json(seo || null);
  }

  const all = await prisma.siteSeo.findMany({ orderBy: { pageKey: "asc" } });
  return NextResponse.json(all);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!EDITOR_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { pageKey, metaTitle, metaDescription, ogImage } = body;

  if (!pageKey) {
    return NextResponse.json({ error: "pageKey required" }, { status: 400 });
  }

  const seo = await prisma.siteSeo.upsert({
    where: { pageKey },
    update: { metaTitle, metaDescription, ogImage },
    create: { pageKey, metaTitle, metaDescription, ogImage },
  });

  logUpdate("siteSeo", seo.id, (session.user as any).id || "", session.user?.name || "User", role, `Updated SEO for: ${pageKey}`);
  return NextResponse.json(seo);
}
