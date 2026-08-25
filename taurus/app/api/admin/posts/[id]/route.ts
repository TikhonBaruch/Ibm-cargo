import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notifyPublished } from "@/lib/telegram";
import { s3Configured, deleteFromS3 } from "@/lib/s3";
import { extractS3Key } from "@/lib/utils";
import { logUpdate, logDelete } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { name: true, email: true } },
      tags: { select: { name: true, slug: true } },
      media: true,
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(post);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { title, content, excerpt, type, status, coverImage, isFeatured, location, tags, socialPlatforms } = body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (content !== undefined) data.content = content;
  if (excerpt !== undefined) data.excerpt = excerpt;
  if (type !== undefined) data.type = type;
  if (coverImage !== undefined) data.coverImage = coverImage;
  if (isFeatured !== undefined) data.isFeatured = isFeatured;
  if (location !== undefined) data.location = location;

  // Handle status change
  if (status !== undefined) {
    data.status = status;
    if (status === "PUBLISHED") {
      data.publishedAt = new Date();
    }
  }

  // Handle tags
  if (tags !== undefined && Array.isArray(tags)) {
    // Disconnect all existing tags
    await prisma.post.update({
      where: { id },
      data: { tags: { set: [] } },
    });

    // Connect new tags
    const tagConnections = [];
    for (const tagName of tags) {
      const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-");
      const tag = await prisma.tag.upsert({
        where: { slug: tagSlug },
        update: {},
        create: { name: tagName, slug: tagSlug },
      });
      tagConnections.push({ id: tag.id });
    }

    data.tags = { connect: tagConnections };
  }

  const post = await prisma.post.update({
    where: { id },
    data,
    include: {
      author: { select: { name: true } },
      tags: { select: { name: true } },
    },
  });

  // Notify when published (fire-and-forget)
  if (status === "PUBLISHED") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://taurus.vercel.app";
    notifyPublished(post.title, `${siteUrl}/posts/${post.slug}`).catch(() => {});

    // Auto-posting to social platforms
    if (socialPlatforms && socialPlatforms.length > 0) {
      for (const platform of socialPlatforms) {
        const existing = await prisma.socialPost.findFirst({ where: { postId: id, platform, status: { not: "failed" } } });
        if (!existing) {
          await prisma.socialPost.create({ data: { postId: id, platform, status: "sent", sentAt: new Date() } }).catch(() => {});
        }
      }
    }
  }

  logUpdate(
    "post",
    id,
    (session.user as any).id || "",
    session.user?.name || "User",
    (session.user as any)?.role || "USER",
    `Updated post: ${post.title}`
  );

  return NextResponse.json(post);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Get media files before deleting post
  if (s3Configured) {
    const media = await prisma.media.findMany({ where: { postId: id } });
    for (const file of media) {
      try {
        const key = extractS3Key(file.url);
        await deleteFromS3(key);
      } catch (err) {
        console.error("Failed to delete S3 file:", file.url, err);
      }
    }
  }

  await prisma.post.delete({ where: { id } });

  logDelete(
    "post",
    id,
    (session.user as any).id || "",
    session.user?.name || "User",
    (session.user as any)?.role || "USER"
  );

  return NextResponse.json({ ok: true });
}
