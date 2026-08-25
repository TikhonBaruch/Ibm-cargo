import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logUpdate, logCreate } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const promo = await prisma.post.findFirst({
    where: { type: "PROMO" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, content: true, status: true, publishedAt: true },
  });

  return NextResponse.json(promo || null);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, title, content } = await request.json();

  const author = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "EDITOR"] } },
  });

  if (!author) {
    return NextResponse.json({ error: "No author found" }, { status: 500 });
  }

  let promo;
  if (id) {
    promo = await prisma.post.update({
      where: { id },
      data: { title, content, status: "PUBLISHED", publishedAt: new Date() },
    });
  } else {
    promo = await prisma.post.create({
      data: {
        title,
        slug: `promo-${crypto.randomUUID()}`,
        content,
        type: "PROMO",
        status: "PUBLISHED",
        authorId: author.id,
        publishedAt: new Date(),
      },
    });
  }

  const userId = (session.user as any)?.id || "";
  const userName = session.user?.name || "User";

  if (id) {
    logUpdate("post", promo.id, userId, userName, role, `Updated promo: ${title}`);
  } else {
    logCreate("post", promo.id, userId, userName, role, `Created promo: ${title}`);
  }

  return NextResponse.json(promo);
}
