import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { upsertTnvedBatch } from "@/lib/ved/tnved";
import { z } from "zod";

const importSchema = z.object({
  items: z
    .array(
      z.object({
        code: z.string(),
        codeDisplay: z.string().optional(),
        level: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8), z.literal(10)]),
        parentCode: z.string().nullable().optional(),
        titleRu: z.string().min(1),
        titleEn: z.string().nullable().optional(),
        isLeaf: z.boolean().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().nullable().optional(),
        rate: z
          .object({
            dutyKind: z.enum(["AD_VALOREM", "SPECIFIC", "COMBINED"]).optional(),
            dutyPct: z.number().nullable().optional(),
            dutyRubPerUnit: z.number().nullable().optional(),
            vatPct: z.number().nullable().optional(),
            feeHintRub: z.number().int().nullable().optional(),
            unit: z.string().nullable().optional(),
            source: z.string().nullable().optional(),
          })
          .optional(),
      })
    )
    .min(1)
    .max(500),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;
  const body = importSchema.parse(await req.json());

  const proxied = await proxyDomainApi("/v1/tnved/import", {
    method: "POST",
    userId,
    role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const result = await upsertTnvedBatch(
    prisma,
    body.items.map((it) => ({
      code: it.code,
      codeDisplay: it.codeDisplay || it.code,
      level: it.level,
      parentCode: it.parentCode,
      titleRu: it.titleRu,
      titleEn: it.titleEn,
      isLeaf: it.isLeaf ?? false,
      isActive: it.isActive ?? true,
      notes: it.notes,
      rate: it.rate
        ? {
            code: it.code,
            dutyKind: it.rate.dutyKind ?? "AD_VALOREM",
            dutyPct: it.rate.dutyPct,
            dutyRubPerUnit: it.rate.dutyRubPerUnit,
            vatPct: it.rate.vatPct,
            feeHintRub: it.rate.feeHintRub,
            unit: it.rate.unit,
            source: it.rate.source,
          }
        : undefined,
    }))
  );
  return NextResponse.json(result, { status: 201 });
}
