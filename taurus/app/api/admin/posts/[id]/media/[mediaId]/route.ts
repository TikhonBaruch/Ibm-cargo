import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { s3Configured, deleteFromS3 } from "@/lib/s3";
import { extractS3Key } from "@/lib/utils";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { mediaId } = await params;

  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete from S3 if configured
  if (s3Configured) {
    try {
      const key = extractS3Key(media.url);
      await deleteFromS3(key);
    } catch (err) {
      console.error("Failed to delete S3 file:", err);
    }
  }

  await prisma.media.delete({ where: { id: mediaId } });

  return NextResponse.json({ ok: true });
}
