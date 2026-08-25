import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { logUpdate, logDelete } from "@/lib/audit";

const updateReviewSchema = z.object({
  author: z.string().min(1).optional(),
  car: z.string().optional(),
  text: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  date: z.string().optional(),
  source: z.string().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const validated = updateReviewSchema.parse(body);

  const review = await prisma.review.update({
    where: { id },
    data: validated,
  });

  logUpdate("review", id, (session.user as any).id || "", session.user?.name || "User", role, `Updated review: ${review.author}`);
  return NextResponse.json(review);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.review.delete({ where: { id } });

  logDelete("review", id, (session.user as any).id || "", session.user?.name || "User", role);
  return NextResponse.json({ ok: true });
}
