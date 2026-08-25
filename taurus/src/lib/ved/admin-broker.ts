/**
 * Admin broker profile moderate + edit (D28).
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const adminBrokerPatchSchema = z
  .object({
    brokerProfileId: z.string().min(1),
    status: z.enum(["APPROVED", "REJECTED", "PENDING"]).optional(),
    acceptingJobs: z.boolean().optional(),
    specialization: z.string().trim().max(200).optional(),
    languages: z.string().trim().max(200).optional(),
    about: z.string().trim().max(4000).optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.status !== undefined ||
      d.acceptingJobs !== undefined ||
      d.specialization !== undefined ||
      d.languages !== undefined ||
      d.about !== undefined,
    { message: "status, acceptingJobs, or profile fields required" }
  );

export async function patchBrokerForAdmin(raw: unknown) {
  const body = adminBrokerPatchSchema.parse(raw);
  const data: {
    moderationStatus?: "APPROVED" | "REJECTED" | "PENDING";
    acceptingJobs?: boolean;
    specialization?: string | null;
    languages?: string | null;
    about?: string | null;
  } = {};
  if (body.status !== undefined) data.moderationStatus = body.status;
  if (body.acceptingJobs !== undefined) data.acceptingJobs = body.acceptingJobs;
  if (body.specialization !== undefined) data.specialization = body.specialization || null;
  if (body.languages !== undefined) data.languages = body.languages || null;
  if (body.about !== undefined) data.about = body.about || null;

  return prisma.brokerProfile.update({
    where: { id: body.brokerProfileId },
    data,
    include: { user: { select: { id: true, name: true, email: true, image: true, phone: true } } },
  });
}
