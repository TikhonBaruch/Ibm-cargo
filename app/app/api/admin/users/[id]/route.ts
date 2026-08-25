import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { s3Configured, deleteFromS3 } from "@/lib/s3";
import { extractS3Key } from "@/lib/utils";

function generatePassword(length = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = session.user?.role;
  const userId = session.user?.id;
  const { id } = await params;
  const { password, role, resetPassword } = await request.json();

  // ADMIN/SUPER can manage others; users can change own password
  const isStaffAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";
  if (!isStaffAdmin && userId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Role changes: SUPER only. Password reset: ADMIN or SUPER (not on SUPER targets).
  if (role && userRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only SUPER_ADMIN can change roles" }, { status: 403 });
  }
  if (resetPassword && !isStaffAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cannot modify SUPER_ADMIN" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};

  // Password reset — generate random password
  if (resetPassword) {
    const newPassword = generatePassword();
    updateData.password = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id }, data: updateData });
    return NextResponse.json({
      ok: true,
      newPassword,
      warning: "Скопируйте пароль и передайте пользователю. Он больше не будет показан.",
    });
  }

  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    updateData.password = await bcrypt.hash(password, 10);
  }

  if (role && userRole === "SUPER_ADMIN") {
    if (role === "SUPER_ADMIN") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updateData.role = role;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only SUPER_ADMIN can delete users
  if (session.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Can't delete yourself
  if (session.user?.id === id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  // Can't delete other SUPER_ADMINs
  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (targetUser.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cannot delete SUPER_ADMIN" }, { status: 400 });
  }

  // Clean up S3 files from user's posts before deletion
  if (s3Configured) {
    const userPosts = await prisma.post.findMany({
      where: { authorId: id },
      select: { id: true },
    });
    for (const post of userPosts) {
      const media = await prisma.media.findMany({ where: { postId: post.id } });
      for (const file of media) {
        try {
          const key = extractS3Key(file.url);
          await deleteFromS3(key);
        } catch {}
      }
    }
  }

  // Delete user's posts and user
  await prisma.post.deleteMany({ where: { authorId: id } });
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
