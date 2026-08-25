import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { logCreate } from "@/lib/audit";
import { isVedCreatableRole, vedUserListWhere } from "@/lib/ved/super-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only SUPER_ADMIN and ADMIN can list users
  const userRole = (session.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: vedUserListWhere(),
    select: {
      id: true,
      name: true,
      email: true,
      telegramId: true,
      telegramName: true,
      role: true,
      createdAt: true,
      password: true,
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Don't send passwords to client
  const safeUsers = users.map(({ password, ...user }) => ({
    ...user,
    hasPassword: !!password,
  }));

  return NextResponse.json(safeUsers);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ADMIN and SUPER_ADMIN can create users (never SUPER_ADMIN)
  const userRole = (session.user as any)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, role, password } = await request.json();

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email required" }, { status: 400 });
  }

  const nextRole = role || "EDITOR";
  if (!isVedCreatableRole(nextRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role: nextRole || "EDITOR",
      password: hashedPassword,
      ...(nextRole === "MANUFACTURER"
        ? {
            company: {
              create: {
                name,
                kind: "MANUFACTURER",
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  logCreate(
    "user",
    user.id,
    (session.user as any).id || "",
    session.user?.name || "User",
    userRole,
    `Created user: ${name} (${nextRole || "EDITOR"})`
  );

  return NextResponse.json(user, { status: 201 });
}
