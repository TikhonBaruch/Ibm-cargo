import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logCreate, logUpdate } from "@/lib/audit";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const postId = new URL(req.url).searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  const socialPosts = await prisma.socialPost.findMany({ where: { postId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(socialPosts);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any)?.role;
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { postId, platform } = body;
  if (!postId || !platform) return NextResponse.json({ error: "postId and platform required" }, { status: 400 });

  const validPlatforms = ["telegram", "whatsapp", "vk"];
  if (!validPlatforms.includes(platform)) return NextResponse.json({ error: "Invalid platform" }, { status: 400 });

  const existing = await prisma.socialPost.findFirst({ where: { postId, platform, status: { not: "failed" } } });
  if (existing) return NextResponse.json({ error: "Already posted" }, { status: 409 });

  const socialPost = await prisma.socialPost.create({ data: { postId, platform, status: "pending" } });
  logCreate("socialPost", socialPost.id, (session.user as any)?.id || "", session.user?.name || "User", role, `Platform: ${platform}`);

  return NextResponse.json(socialPost, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any)?.role;
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, status, error: errorMsg } = body;
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const updateData: any = { status };
  if (status === "sent") updateData.sentAt = new Date();
  if (errorMsg) updateData.error = errorMsg;

  const socialPost = await prisma.socialPost.update({ where: { id }, data: updateData });
  logUpdate("socialPost", id, (session.user as any)?.id || "", session.user?.name || "User", role, `Status: ${status}`);

  return NextResponse.json(socialPost);
}
