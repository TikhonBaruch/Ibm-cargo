import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];

const createRecipientSchema = z.object({
  name: z.string().min(1, "Имя обязательно"),
  chatId: z.string().regex(/^\d+$/, "Chat ID должен быть числом"),
  role: z.enum(["manager", "master", "admin"], { message: "Роль: manager, master или admin" }),
});

const updateRecipientSchema = z.object({
  name: z.string().min(1).optional(),
  chatId: z.string().regex(/^\d+$/).optional(),
  role: z.enum(["manager", "master", "admin"]).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const recipients = await prisma.telegramRecipient.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(recipients);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createRecipientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const recipient = await prisma.telegramRecipient.create({
      data: parsed.data,
    });
    return NextResponse.json(recipient, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Получатель с таким Chat ID уже существует" }, { status: 409 });
    }
    throw e;
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  const parsed = updateRecipientSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const recipient = await prisma.telegramRecipient.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(recipient);
  } catch (e: any) {
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Получатель не найден" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as any)?.role;
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  await prisma.telegramRecipient.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
