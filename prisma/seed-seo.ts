import { PrismaClient, PostType, PostStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SITE_IMAGES = [
  "https://picsum.photos/seed/cargobroker1/1200/630",
  "https://picsum.photos/seed/cargobroker2/1200/630",
  "https://picsum.photos/seed/cargobroker3/1200/630",
  "https://picsum.photos/seed/cargobroker4/1200/630",
];

const testPosts = [
  {
    title: "Завершён ремонт кузова BMW X5",
    slug: "remont-kuzova-bmw-x5",
    content: "Полный кузовной ремонт BMW X5: устранение вмятин, покраска крылья и двери, полировка. Работа заняла 3 дня. Клиент доволен результатом.",
    excerpt: "Кузовной ремонт BMW X5 — покраска, полировка, устранение вмятин.",
    type: PostType.WORK,
    coverImage: SITE_IMAGES[0],
    metaTitle: "Ремонт кузова BMW X5 — покраска и полировка",
    metaDescription: "Полный кузовной ремонт BMW X5: вмятины, покраска, полировка. Фото до и после.",
  },
  {
    title: "Обновление: теперь работаем с керамическим покрытием",
    slug: "keramicheskoe-pokrytie",
    content: "Мы запустили услугу керамического покрытия кузова. Наносим нано-керамику 9H с гарантией 2 года. Защита от царапин, УФ, реагентов. Стоимость от 15 000 ₽.",
    excerpt: "Новая услуга: керамическое покрытие 9H с гарантией 2 года.",
    type: PostType.UPDATE,
    coverImage: SITE_IMAGES[1],
    metaTitle: "Керамическое покрытие кузова 9H — новая услуга",
    metaDescription: "Нано-керамика 9H с гарантией 2 года. Защита от царапин, УФ, реагентов. От 15 000 ₽.",
  },
  {
    title: "Акция: скидка 20% на покраску",
    slug: "aktsiya-skidka-20",
    content: "До конца июля — скидка 20% на все виды покраски! Покраска бампера от 8 000 ₽, покраска крыла от 10 000 ₽. Запись по телефону.",
    excerpt: "Скидка 20% на покраску до конца июля. Бампер от 8 000 ₽.",
    type: PostType.PROMO,
    coverImage: SITE_IMAGES[2],
    metaTitle: "Скидка 20% на покраску автомобиля — акция июля",
    metaDescription: "Скидка 20% на все виды покраски до конца июля. Покраска бампера от 8 000 ₽.",
  },
  {
    title: "Открытие нового поста покраски",
    slug: "novyj-post-pokraski",
    content: "Мы расширились — открыли новый пост покраски с профессиональной кабиной. Теперь выполняем до 5 заказов в день. Адрес: ул. Цветочная 16.",
    excerpt: "Новый пост покраски с кабиной. Расширение производства.",
    type: PostType.NEWS,
    coverImage: SITE_IMAGES[3],
    metaTitle: "Новый пост покраски — Первая Покраска",
    metaDescription: "Открыт новый пост покраски с профессиональной кабиной. Адрес: ул. Цветочная 16, СПб.",
  },
];

async function main() {
  console.log("Seeding cargobroker test posts...");

  let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin",
        role: "ADMIN",
      },
    });
  }

  for (const postData of testPosts) {
    const existing = await prisma.post.findUnique({ where: { slug: postData.slug } });
    if (existing) {
      console.log(`  SKIP: ${postData.slug} (already exists)`);
      continue;
    }

    await prisma.post.create({
      data: {
        ...postData,
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        authorId: admin.id,
      },
    });
    console.log(`  CREATED: ${postData.slug}`);
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
