import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, BROKER_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { z } from "zod";

const schema = z.object({
  specialization: z.string().optional(),
  languages: z.string().optional(),
  about: z.string().optional(),
  acceptingJobs: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireRole(BROKER_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;
  const body = schema.parse(await req.json());

  const proxied = await proxyDomainApi("/v1/brokers/me", {
    method: "PATCH",
    userId,
    role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const updated = await prisma.brokerProfile.update({
    where: { userId },
    data: body,
  });
  return NextResponse.json(updated);
}
