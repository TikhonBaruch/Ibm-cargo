import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const specialists = [
  {
    name: "Алексей Петров",
    email: "alexey@test.test",
    role: "SPECIALIST" as const,
    bio: "Мастер кузовного ремонта с 12-летним стажем. Специализируюсь на восстановлении после ДТП и покраске. Работаю с автомобилями любых марок.",
    specialization: "Мастер кузовного ремонта",
    phone: "+7 (812) 123-45-67",
    experience: 12,
    sortOrder: 1,
    showInTeam: true,
  },
  {
    name: "Мария Иванова",
    email: "maria@test.test",
    role: "EDITOR" as const,
    bio: "Колорист-технолог. Подбор точного оттенка краски по образцу или коду. Опыт работы с Mercedes, BMW, Audi. Гарантия точного попадания в цвет.",
    specialization: "Колорист-технолог",
    phone: "+7 (812) 234-56-78",
    experience: 8,
    sortOrder: 2,
    showInTeam: true,
  },
  {
    name: "Дмитрий Козлов",
    email: "dmitry@test.test",
    role: "EDITOR" as const,
    bio: "Специалист по полировке и защитным покрытиям. Провожу керамическое покрытие, нано-защиту, полировку после покраски. Более 500 обработанных автомобилей.",
    specialization: "Специалист по покрытиям",
    phone: "+7 (812) 345-67-89",
    experience: 6,
    sortOrder: 3,
    showInTeam: true,
  },
  {
    name: "Елена Сидорова",
    email: "elena@test.test",
    role: "EDITOR" as const,
    bio: "Менеджер по работе с клиентами. Консультации, запись на ремонт, контроль сроков. Свободно владею английским языком.",
    specialization: "Менеджер по клиентам",
    phone: "+7 (812) 456-78-90",
    experience: 4,
    sortOrder: 4,
    showInTeam: true,
  },
];

async function main() {
  console.log("Creating test specialists...");

  for (const data of specialists) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      console.log(`  SKIP: ${data.name} (already exists)`);
      continue;
    }

    await prisma.user.create({
      data: {
        ...data,
        password: null,
        emailVerified: new Date(),
      },
    });
    console.log(`  CREATED: ${data.name} (${data.specialization})`);
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
