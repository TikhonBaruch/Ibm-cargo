import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public list of published posts (no auth). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);

  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      ...(type ? { type: type as "NEWS" | "WORK" | "UPDATE" | "EVENT" | "PROMO" } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      coverImage: true,
      type: true,
      location: true,
      publishedAt: true,
      excerpt: true,
    },
  });

  return NextResponse.json(posts);
}
