import { NextResponse } from "next/server";
import { z } from "zod";
import { registerClient } from "@/lib/ved/register";
import { logAction } from "@/lib/audit";

const schema = z.object({
  companyName: z.string().min(1).max(200),
  inn: z.string().max(20).optional(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  password: z.string().min(6).max(128),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const result = await registerClient(body);

    await logAction({
      action: "REGISTER",
      entity: "user",
      entityId: result.user.id,
      userId: result.user.id,
      userName: result.user.name || undefined,
      userRole: "CLIENT",
      details: `company ${result.company.name}`,
    });

    return NextResponse.json(
      {
        ok: true,
        user: result.user,
        company: result.company,
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Registration failed";
    const status = msg.includes("already registered") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
