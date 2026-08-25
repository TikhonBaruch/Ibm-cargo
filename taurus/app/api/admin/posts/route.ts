import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateSlug, upsertTags } from "@/lib/utils";
import { logCreate } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  }

  const posts = await prisma.post.findMany({
    where,
    include: {
      author: { select: { name: true, email: true } },
      tags: { select: { name: true } },
      _count: { select: { media: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(posts);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, content, excerpt, type, status, coverImage, isFeatured, location, tags, authorId } = body;

    if (!title) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    // Generate unique slug
    const slugFinal = await generateSlug(title);

    // Use provided authorId or fallback to session user
    let author;
    if (authorId) {
      author = await prisma.user.findUnique({ where: { id: authorId } });
    } else {
      author = await prisma.user.findFirst({
        where: { role: { in: ["ADMIN", "EDITOR"] } },
      });
    }

    if (!author) {
      return NextResponse.json({ error: "No author found" }, { status: 500 });
    }

    // Handle tags
    const tagConnections = tags && Array.isArray(tags) ? await upsertTags(tags) : [];

    // Create post
    const post = await prisma.post.create({
      data: {
        title,
        slug: slugFinal,
        content: content || null,
        excerpt: excerpt || null,
        coverImage: coverImage || null,
        type: type || "NEWS",
        status: status || "DRAFT",
        isFeatured: isFeatured || false,
        location: location || null,
        authorId: author.id,
        tags: tagConnections.length > 0 ? { connect: tagConnections } : undefined,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
      include: {
        author: { select: { name: true } },
        tags: { select: { name: true } },
      },
    });

    logCreate(
      "post",
      post.id,
      (session.user as any).id || "",
      session.user?.name || "User",
      (session.user as any)?.role || "USER",
      `Created post: ${title}`
    );

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
