/**
 * Public CLIENT registration: Company + User in one transaction (MVP signup).
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type RegisterClientInput = {
  companyName: string;
  inn?: string;
  name: string;
  email: string;
  password: string;
};

export async function registerClient(input: RegisterClientInput) {
  const email = input.email.trim().toLowerCase();
  const companyName = input.companyName.trim();
  const name = input.name.trim();

  if (!companyName || !name || !email) {
    throw new Error("Company name, contact name and email are required");
  }
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        inn: input.inn?.trim() || null,
        balanceRub: 0,
      },
    });
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "CLIENT",
        companyId: company.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
      },
    });
    return { user, company: { id: company.id, name: company.name, balanceRub: company.balanceRub } };
  });
}
