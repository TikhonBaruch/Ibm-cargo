import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const specialist = await prisma.user.findUnique({
    where: { id },
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
  });

  if (!specialist) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(specialist);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any)?.role;
  if (!["SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowedFields = ["name", "image", "bio", "specialization", "phone", "experience", "sortOrder", "showInTeam"];
  const updateData: Record<string, any> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const specialist = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      specialization: true,
      phone: true,
      experience: true,
      sortOrder: true,
      showInTeam: true,
    },
  });

  return NextResponse.json(specialist);
}
