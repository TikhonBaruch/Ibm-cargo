import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logUpdate } from "@/lib/audit";

const EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN", "EDITOR"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!EDITOR_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const section = await prisma.pageSection.findUnique({ where: { id } });
  if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(section);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!EDITOR_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const section = await prisma.pageSection.update({
    where: { id },
    data: {
      title: body.title,
      subtitle: body.subtitle,
      content: body.content,
      image: body.image,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
      settings: body.settings,
    },
  });

  logUpdate(
    "pageSection",
    id,
    (session.user as any).id || "",
    session.user?.name || "User",
    role,
    `Updated section: ${section.title || section.type}`
  );

  return NextResponse.json(section);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!EDITOR_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (body.isActive !== undefined) {
    const section = await prisma.pageSection.update({
      where: { id },
      data: { isActive: body.isActive },
    });

    logUpdate(
      "pageSection",
      id,
      (session.user as any).id || "",
      session.user?.name || "User",
      role,
      `Toggled section: ${section.type} -> ${body.isActive ? "active" : "inactive"}`
    );

    return NextResponse.json(section);
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.pageSection.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
