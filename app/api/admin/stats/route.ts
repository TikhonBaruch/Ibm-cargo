import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PLATFORM_ROLES, requireRole } from "@/lib/require-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(PLATFORM_ROLES);
  if (error) return error;

  const [totalPosts, pendingPosts, publishedPosts, totalReviews, totalBookings, pendingBookings, totalAuditToday] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { status: "PENDING" } }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.review.count(),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "NEW" } }),
    prisma.auditLog.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  return NextResponse.json({
    totalPosts,
    pendingPosts,
    publishedPosts,
    totalReviews,
    totalBookings,
    pendingBookings,
    totalAuditToday,
  });
}
