import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const promo = await prisma.post.findFirst({
    where: { type: "PROMO", status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, content: true, publishedAt: true },
  });

  return NextResponse.json(promo || null, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
