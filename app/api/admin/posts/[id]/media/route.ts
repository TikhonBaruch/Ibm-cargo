import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
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
  const { url, type, filename, size } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  // Verify post exists
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const media = await prisma.media.create({
    data: {
      url,
      type: type || "IMAGE",
      filename: filename || null,
      size: size || null,
      postId: id,
    },
  });

  return NextResponse.json(media);
}
