import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logCreate } from "@/lib/audit";

export const dynamic = "force-dynamic";

const EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN", "EDITOR"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!EDITOR_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reviews = await prisma.review.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(reviews);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!EDITOR_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { author, car, text, rating, date, isPublished } = body;

  if (!author || !text) {
    return NextResponse.json({ error: "Author and text required" }, { status: 400 });
  }

  const maxOrder = await prisma.review.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });

  const review = await prisma.review.create({
    data: {
      author,
      car: car || null,
      text,
      rating: rating || 5,
      date: date || null,
      isPublished: isPublished !== false,
      sortOrder: (maxOrder?.sortOrder || 0) + 1,
    },
  });

  logCreate(
    "review",
    review.id,
    (session.user as any).id || "",
    session.user?.name || "User",
    role,
    `Created review by ${author}`
  );

  return NextResponse.json(review, { status: 201 });
}
