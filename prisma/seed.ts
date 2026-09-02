import { PrismaClient, PostType, PostStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { PLATFORM_SETTING_KEYS } from "../src/lib/ved/domain";
import { upsertTnvedBatch, type TnvedImportItem } from "../src/lib/ved/tnved";
import { TNVED_DEMO_RATE_SOURCE } from "../src/lib/ved/tnved-fns";
import { buildFingerprint } from "../src/lib/ved/verified-determinations";
import type { ProductAttrs } from "../src/lib/ved/product-description";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "demo1234";

/** Official FNS titles + synonym notes from scripts/fixtures/tnved/demo-pack.json */
async function seedTnvedDirectory() {
  const packPath = path.join(__dirname, "../scripts/fixtures/tnved/demo-pack.json");
  const pack = JSON.parse(fs.readFileSync(packPath, "utf8")) as {
    items: TnvedImportItem[];
    leafCount: number;
  };
  await prisma.tnvedDutyRate.deleteMany({
    where: { source: { in: ["seed-heuristic-v1", TNVED_DEMO_RATE_SOURCE] } },
  });
  const { upserted } = await upsertTnvedBatch(prisma, pack.items);
  console.log("TN VED seeded: leaves", pack.leafCount, "upserts", upserted);
}

/** Clar-DB-4: demo БД-2 pairs so create can hit precedent without LLM (forklift ≠ AKB). */
async function seedDemoPrecedents(brokerUserId: string) {
  const rows: Array<{
    name: string;
    description: string;
    attrs: ProductAttrs;
    hsCodeFinal: string;
    brokerComment: string;
  }> = [
    {
      name: "Вилочный электропогрузчик",
      description: "Самоходный погрузчик с вилочным захватом, встроенный Li-ion АКБ",
      attrs: {
        composition: "сталь; встроенный Li-ion аккумулятор",
        purpose: "складской погрузчик",
        hsHint: "8427 10 100 0",
        originCountry: "CN",
        extra: { powerSource: "electric", vehicleKind: "forklift" },
      },
      hsCodeFinal: "8427101000",
      brokerComment: "Clar-DB seed: машина 8427, не АКБ 8507",
    },
    {
      name: "Погрузчик дизельный вилочный",
      description: "Самоходный погрузчик с ДВС",
      attrs: {
        composition: "сталь; двигатель дизельный",
        purpose: "складской погрузчик ДВС",
        hsHint: "8427 20 190 0",
        originCountry: "CN",
        extra: { powerSource: "ICE", vehicleKind: "forklift" },
      },
      hsCodeFinal: "8427201900",
      brokerComment: "Clar-DB seed: прочие самоходные 8427 20",
    },
    {
      name: "Тяговый литий-ионный аккумулятор для погрузчика",
      description: "Сменный АКБ LiFePO4 для электропогрузчика",
      attrs: {
        composition: "литий-ион LiFePO4",
        purpose: "тяговый аккумулятор",
        hsHint: "8507 60 000 0",
        originCountry: "CN",
        extra: { powerSource: "battery-pack", vehicleKind: "battery-only" },
      },
      hsCodeFinal: "8507600000",
      brokerComment: "Clar-DB seed: отдельный АКБ 8507, экосбор РОП",
    },
    {
      name: "Аккумулятор литий-ионный",
      description: "Перезаряжаемый Li-ion аккумулятор",
      attrs: {
        composition: "литий-ион",
        purpose: "электрический аккумулятор",
        hsHint: "8507 60 000 0",
        originCountry: "CN",
        extra: { powerSource: "battery-pack" },
      },
      hsCodeFinal: "8507600000",
      brokerComment: "Clar-DB seed: Li-ion 8507 60",
    },
  ];

  let upserted = 0;
  for (const row of rows) {
    const fingerprint = buildFingerprint({
      name: row.name,
      description: row.description,
      attrs: row.attrs,
    });
    const digits = row.hsCodeFinal.replace(/\D/g, "");
    const existing = await prisma.verifiedDetermination.findFirst({
      where: { fingerprint },
      orderBy: { approvedAt: "desc" },
    });
    if (existing) {
      await prisma.verifiedDetermination.update({
        where: { id: existing.id },
        data: {
          canonicalText: `${row.name} ${row.description}`.toLowerCase(),
          attrsSnapshot: row.attrs,
          hsCodeFinal: row.hsCodeFinal,
          hsCodeDigits: digits,
          brokerComment: row.brokerComment,
          approvedByUserId: brokerUserId,
          quality: "BROKER",
        },
      });
    } else {
      await prisma.verifiedDetermination.create({
        data: {
          fingerprint,
          canonicalText: `${row.name} ${row.description}`.toLowerCase(),
          attrsSnapshot: row.attrs,
          hsCodeFinal: row.hsCodeFinal,
          hsCodeDigits: digits,
          brokerComment: row.brokerComment,
          approvedByUserId: brokerUserId,
          quality: "BROKER",
        },
      });
    }
    upserted += 1;
  }
  console.log("Demo precedents seeded:", upserted);
}

async function main() {
  await seedTnvedDirectory();

  // === Tags ===
  const tags = [
    { name: "ТН ВЭД", slug: "tnved" },
    { name: "Импорт", slug: "import" },
    { name: "Таможня", slug: "tamozhnya" },
    { name: "Пошлины", slug: "poshliny" },
    { name: "Документы", slug: "dokumenty" },
    { name: "Перевозка", slug: "perevozka" },
    { name: "Новость", slug: "novost" },
    { name: "Акция", slug: "aktsiya" },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      create: tag,
      update: {},
    });
  }
  console.log("Tags seeded:", tags.length);

  // === Admin User (demo ADMIN for /admin — not SUPER; D28/A3) ===
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    create: {
      email: "admin@example.com",
      name: "Администратор",
      role: "ADMIN",
      emailVerified: new Date(),
    },
    update: {
      role: "ADMIN",
      name: "Администратор",
    },
  });
  console.log("Admin user:", adminUser.email);

  // === Sample Posts ===
  const samplePosts = [
    {
      title: "Как определить код ТН ВЭД за 3 минуты с помощью AI",
      slug: "kak-opredelit-kod-tnved-za-3-minuty",
      content: "AI-классификация товаров позволяет мгновенно определить код ТН ВЭД по описанию, фото или документам. Наш алгоритм анализирует характеристики товара и подбирает наиболее точный код с учётом преференций и ограничений.",
      type: PostType.NEWS,
      status: PostStatus.PUBLISHED,
      authorId: adminUser.id,
      publishedAt: new Date(),
    },
    {
      title: "Кейс: расчёт таможенных платежей при импорте электроники из Китая",
      slug: "keks-raschet-tamozhennyh-platezhej-kitaj",
      content: "Клиент импортировал партию ноутбуков Lenovo на сумму 18 000 $. AI определил код 8471 30 000 0, рассчитал пошлину 7% (327 000 ₽), НДС 20% (584 000 ₽) и таможенный сбор (15 000 ₽). Итого: 1 248 700 ₽. Весь расчёт занял 2 минуты.",
      type: PostType.WORK,
      status: PostStatus.PUBLISHED,
      isFeatured: true,
      authorId: adminUser.id,
      publishedAt: new Date(),
    },
    {
      title: "AI против ручного расчёта: экономия до 70% времени",
      slug: "ai-protiv-ruchnogo-rascheta",
      content: "Сравнили скорость и точность AI-расчёта таможенных платежей с ручным методом. Результат: AI справляется за 1-3 минуты вместо 3-5 дней, а точность классификации составляет 95%+ после проверки брокером.",
      type: PostType.UPDATE,
      status: PostStatus.PUBLISHED,
      authorId: adminUser.id,
      publishedAt: new Date(),
    },
  ];

  for (const post of samplePosts) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      create: post,
      update: {},
    });
  }
  console.log("Sample posts created:", samplePosts.length);

  // === CMS Landing Sections ===
  const sections = [
    {
      page: "landing",
      type: "hero",
      title: "LBM БРОКЕР",
      subtitle: "AI-платформа для импорта",
      content: JSON.stringify({
        bullets: [
          "AI расчёт за 1-3 минуты",
          "Проверка брокером",
          "PDF отчёт и документы",
          "Перевозка в 1 клик"
        ],
        ctaText: "Рассчитать стоимость импорта",
        ctaLink: "/admin"
      }),
      sortOrder: 0,
      isActive: true,
    },
    {
      page: "landing",
      type: "about",
      title: "О платформе",
      content: JSON.stringify({
        bullets: [
          "AI определяет код ТН ВЭД",
          "Расчёт пошлин, НДС, сборов",
          "Проверка документов OCR",
          "Брокер подтверждает результат"
        ],
        stats: [
          { value: "6", label: "AI-модулей" },
          { value: "1-3", label: "минуты на расчёт" },
          { value: "95%+", label: "точность классификации" }
        ]
      }),
      sortOrder: 1,
      isActive: true,
    },
    {
      page: "landing",
      type: "features",
      title: "Возможности",
      content: JSON.stringify({
        items: [
          { name: "AI Customs", desc: "Определение кода ТН ВЭД" },
          { name: "AI Duty", desc: "Расчёт пошлин и НДС" },
          { name: "AI OCR", desc: "Распознавание документов" },
          { name: "AI Documents", desc: "Проверка и валидация" },
          { name: "AI Broker", desc: "Консультации и верификация" },
          { name: "AI Cargo", desc: "Поиск перевозчиков" }
        ]
      }),
      sortOrder: 2,
      isActive: true,
    },
    {
      page: "landing",
      type: "reviews",
      title: "Отзывы",
      content: JSON.stringify({
        limit: 6,
        showLink: true
      }),
      sortOrder: 3,
      isActive: true,
    },
    {
      page: "landing",
      type: "booking",
      title: "Связаться с нами",
      content: JSON.stringify({
        phone: "+7 (800) 555-35-35",
        email: "info@cargobroker.ru",
        address: "Москва",
        workHours: "Пн-Пт: 09:00 – 18:00"
      }),
      sortOrder: 4,
      isActive: true,
    },
  ];

  for (const section of sections) {
    await prisma.pageSection.upsert({
      where: { page_type: { page: section.page, type: section.type } },
      create: section,
      update: {
        title: section.title,
        subtitle: section.subtitle,
        content: section.content,
        sortOrder: section.sortOrder,
        isActive: section.isActive,
      },
    });
  }
  console.log("Landing sections seeded:", sections.length);

  // === SEO Settings ===
  const seoSettings = [
    {
      pageKey: "home",
      metaTitle: "LBM Брокер — AI-платформа для импорта",
      metaDescription: "AI определяет код ТН ВЭД, рассчитывает пошлины, проверяет документы. Брокер подтверждает результат.",
    },
    {
      pageKey: "portfolio",
      metaTitle: "Кейсы — LBM Брокер",
      metaDescription: "Примеры расчётов таможенных платежей и импортных операций",
    },
    {
      pageKey: "posts",
      metaTitle: "Статьи — LBM Брокер",
      metaDescription: "Новости, гайды по импорту и обновления платформы",
    },
  ];

  for (const seo of seoSettings) {
    await prisma.siteSeo.upsert({
      where: { pageKey: seo.pageKey },
      create: seo,
      update: seo,
    });
  }
  console.log("SEO settings seeded:", seoSettings.length);

  // === Sample Reviews ===
  const reviews = [
    {
      author: "Алексей Волков, ООО «ИмпортТрейд»",
      text: "Рассчитали таможенные платежи за 2 минуты вместо 3 дней. AI определил код ТН ВЭД точно, брокер подтвердил. Экономия колоссальная.",
      rating: 5,
      source: "manual",
      isPublished: true,
      sortOrder: 1,
    },
    {
      author: "Мария Козлова, ИП",
      text: "Впервые импортировала товар из Китая. LBM Брокер помог разобраться с документами, нашёл ошибки в инвойсе до подачи на таможню.",
      rating: 5,
      source: "manual",
      isPublished: true,
      sortOrder: 2,
    },
    {
      author: "Дмитрий Соколов, «Восток Логистик»",
      text: "Используем платформу для регулярных поставок. Marketplace перевозчиков экономит время на поиск ставок. Рекомендую.",
      rating: 4,
      source: "manual",
      isPublished: true,
      sortOrder: 3,
    },
  ];

  for (const review of reviews) {
    const existing = await prisma.review.findFirst({ where: { author: review.author } });
    if (!existing) {
      await prisma.review.create({ data: review });
    }
  }
  console.log("Sample reviews created:", reviews.length);

  // Lock primary super-admin email (obscure CMS login)
  const superEmail = "2178737@gmail.com";
  await prisma.siteSetting.upsert({
    where: { key: "locked_admin_email" },
    update: { value: superEmail },
    create: { key: "locked_admin_email", value: superEmail },
  });
  console.log("Super admin email locked:", superEmail);

  // === VED domain seed ===
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const superPasswordHash = await bcrypt.hash("2178737", 10);

  await prisma.user.update({
    where: { id: adminUser.id },
    data: { password: passwordHash, role: "ADMIN", name: "Администратор (demo)" },
  });

  const obscureSuper = await prisma.user.upsert({
    where: { email: superEmail },
    create: {
      email: superEmail,
      name: "Супер-админ",
      role: "SUPER_ADMIN",
      password: superPasswordHash,
      emailVerified: new Date(),
    },
    update: {
      role: "SUPER_ADMIN",
      password: superPasswordHash,
      name: "Супер-админ",
    },
  });
  console.log("Obscure SUPER_ADMIN:", obscureSuper.email, "→ /2178737");

  // Platform operator (ADMIN): VED ops cabinet without Legacy CMS (D6).
  const operatorUser = await prisma.user.upsert({
    where: { email: "operator@example.com" },
    create: {
      email: "operator@example.com",
      name: "Администратор платформы",
      role: "ADMIN",
      password: passwordHash,
      emailVerified: new Date(),
    },
    update: {
      role: "ADMIN",
      password: passwordHash,
      name: "Администратор платформы",
    },
  });
  console.log("Platform operator (ADMIN):", operatorUser.email);
  console.log("Demo admin@ → ADMIN (VED /admin)");

  const tariffs = [
    {
      code: "EXPRESS" as const,
      name: "Экспресс",
      priceRub: 990,
      brokerSharePct: 0,
      maxPositions: 3,
      slaHours: 1,
      description: "Только AI",
    },
    {
      code: "STANDARD" as const,
      name: "Стандарт",
      priceRub: 2990,
      brokerSharePct: 35,
      maxPositions: 3,
      slaHours: 4,
      description: "AI + брокер ≤ 4 ч",
    },
    {
      code: "PRO" as const,
      name: "Профи",
      priceRub: 5990,
      brokerSharePct: 40,
      maxPositions: 10,
      slaHours: 4,
      description: "Приоритет, до 10 позиций",
    },
  ];
  for (const t of tariffs) {
    await prisma.tariffPlan.upsert({
      where: { code: t.code },
      create: t,
      update: {
        priceRub: t.priceRub,
        brokerSharePct: t.brokerSharePct,
        maxPositions: t.maxPositions,
        slaHours: t.slaHours,
        description: t.description,
        isActive: true,
      },
    });
  }
  console.log("Tariffs seeded:", tariffs.length);

  const settings: Array<{ key: string; value: number | boolean }> = [
    { key: PLATFORM_SETTING_KEYS.confidenceThreshold, value: 0.75 },
    { key: PLATFORM_SETTING_KEYS.defaultSlaHours, value: 4 },
    { key: PLATFORM_SETTING_KEYS.preferredClaimHours, value: 4 },
    { key: PLATFORM_SETTING_KEYS.usdRate, value: 90 },
    { key: PLATFORM_SETTING_KEYS.cnyRate, value: 12.5 },
    { key: PLATFORM_SETTING_KEYS.eurRate, value: 98 },
    { key: PLATFORM_SETTING_KEYS.fxBufferPct, value: 2 },
    { key: PLATFORM_SETTING_KEYS.marketplaceEnabled, value: true },
    { key: PLATFORM_SETTING_KEYS.autoAssignBrokers, value: true },
    { key: PLATFORM_SETTING_KEYS.maintenanceMode, value: false },
  ];
  for (const s of settings) {
    await prisma.siteSetting.upsert({
      where: { key: s.key },
      create: { key: s.key, value: s.value },
      update: { value: s.value },
    });
  }

  const company = await prisma.company.upsert({
    where: { id: "seed-company-importer" },
    create: {
      id: "seed-company-importer",
      name: "ООО «Импортёр»",
      inn: "7701234567",
      kpp: "770101001",
      legalAddress: "Москва, ул. Примерная, 1",
      contactEmail: "client@example.com",
      contactPhone: "+7 900 000-00-01",
      balanceRub: 50000,
      clientSegment: "RETAIL_SMALL",
    },
    update: { balanceRub: 50000, name: "ООО «Импортёр»", clientSegment: "RETAIL_SMALL" },
  });

  const client = await prisma.user.upsert({
    where: { email: "client@example.com" },
    create: {
      email: "client@example.com",
      name: "Клиент Импортёр",
      role: "CLIENT",
      password: passwordHash,
      companyId: company.id,
      emailVerified: new Date(),
    },
    update: { role: "CLIENT", password: passwordHash, companyId: company.id },
  });

  const broker = await prisma.user.upsert({
    where: { email: "broker@example.com" },
    create: {
      email: "broker@example.com",
      name: "А. Иванов",
      role: "BROKER",
      password: passwordHash,
      emailVerified: new Date(),
      specialization: "Электроника, Китай / ЕАЭС",
    },
    update: { role: "BROKER", password: passwordHash },
  });

  await prisma.brokerProfile.upsert({
    where: { userId: broker.id },
    create: {
      userId: broker.id,
      specialization: "Электроника, Китай / ЕАЭС",
      languages: "RU, EN, CN",
      about: "Таможенный брокер, 8 лет опыта",
      acceptingJobs: true,
      rating: 4.9,
      moderationStatus: "APPROVED",
      closedPerWeek: 28,
      avgSlaHours: 3.1,
    },
    update: { moderationStatus: "APPROVED", acceptingJobs: true },
  });

  await seedDemoPrecedents(broker.id);

  const mfgCompany = await prisma.company.upsert({
    where: { id: "seed-company-manufacturer" },
    create: {
      id: "seed-company-manufacturer",
      name: "Завод «Эталон»",
      inn: "7707654321",
      contactEmail: "manufacturer@example.com",
      kind: "MANUFACTURER",
    },
    update: { name: "Завод «Эталон»", kind: "MANUFACTURER" },
  });

  await prisma.user.upsert({
    where: { email: "manufacturer@example.com" },
    create: {
      email: "manufacturer@example.com",
      name: "Менеджер завода",
      role: "MANUFACTURER",
      password: passwordHash,
      companyId: mfgCompany.id,
      emailVerified: new Date(),
    },
    update: { role: "MANUFACTURER", password: passwordHash, companyId: mfgCompany.id },
  });

  // Children reference ManufacturerSku with ON DELETE RESTRICT.
  const mfgSkuIds = (
    await prisma.manufacturerSku.findMany({
      where: { companyId: mfgCompany.id },
      select: { id: true },
    })
  ).map((s) => s.id);
  if (mfgSkuIds.length > 0) {
    await prisma.skuOrderRequest.deleteMany({ where: { manufacturerSkuId: { in: mfgSkuIds } } });
    await prisma.skuOrderPool.deleteMany({ where: { manufacturerSkuId: { in: mfgSkuIds } } });
    await prisma.manufacturerSku.deleteMany({ where: { id: { in: mfgSkuIds } } });
  }
  await prisma.manufacturerSku.createMany({
    data: [
      {
        companyId: mfgCompany.id,
        sku: "NB-T14-16",
        gtin: "6901234567890",
        name: "Ноутбук ThinkPad T14",
        customsName: "Машина вычислительная портативная, 14 дюймов, для обработки данных",
        brand: "Lenovo",
        model: "ThinkPad T14",
        originCountry: "CN",
        status: "PUBLISHED",
        netWeightKg: 1.4,
        grossWeightKg: 2.1,
        volumeM3: 0.008,
        lengthMm: 318,
        widthMm: 218,
        heightMm: 18,
        material: "plastic/metal",
        compositionText: "корпус пластик/металл; Li-ion батарея встроена",
        purpose: "обработка данных",
        hsHint: "8471",
        features: [
          {
            kind: "BATTERY",
            label: "Li-ion встроенный",
            value: "52",
            unit: "Wh",
            separatelyDeclared: false,
          },
        ],
        packagings: [
          {
            level: "UNIT",
            packType: "retail box",
            lengthMm: 420,
            widthMm: 280,
            heightMm: 70,
            weightKg: 2.1,
          },
          {
            level: "MASTER",
            packType: "carton",
            qtyPerParent: 5,
            lengthMm: 450,
            widthMm: 300,
            heightMm: 380,
            weightKg: 11.2,
          },
          {
            level: "PALLET",
            packType: "euro_pallet",
            qtyPerParent: 20,
            lengthMm: 1200,
            widthMm: 800,
            heightMm: 1400,
            weightKg: 240,
          },
        ],
        moq: 20,
        packMultiple: 5,
        incoterms: "FCA",
      },
      {
        companyId: mfgCompany.id,
        sku: "GEN-2K-GDI",
        name: "Генератор бензиновый 2 кВт",
        customsName: "Генераторная установка с двигателем внутреннего сгорания, 2 кВт",
        brand: "Etalon",
        model: "GDI-2000",
        originCountry: "CN",
        status: "DRAFT",
        netWeightKg: 21,
        grossWeightKg: 24,
        lengthMm: 480,
        widthMm: 320,
        heightMm: 410,
        purpose: "выработка электроэнергии",
        hsHint: "8502",
        features: [
          {
            kind: "ENGINE",
            label: "ДВС бензин",
            value: "79",
            unit: "cm3",
            separatelyDeclared: true,
          },
        ],
        packagings: [
          {
            level: "MASTER",
            packType: "carton",
            qtyPerParent: 1,
            lengthMm: 520,
            widthMm: 360,
            heightMm: 450,
            weightKg: 24,
          },
        ],
        moq: 10,
      },
    ],
  });

  const seededSku = await prisma.manufacturerSku.findFirst({
    where: { companyId: mfgCompany.id, sku: "NB-T14-16" },
  });
  if (seededSku) {
    await prisma.skuOrderRequest.deleteMany({ where: { clientCompanyId: company.id } });
    await prisma.skuOrderRequest.create({
      data: {
        clientCompanyId: company.id,
        manufacturerSkuId: seededSku.id,
        qty: 8,
        note: "Демо: хвост в сборный заказ",
        status: "SUBMITTED",
      },
    });
  }

  const standard = await prisma.tariffPlan.findUniqueOrThrow({ where: { code: "STANDARD" } });

  // Demo multi-item calculation in QUEUED for broker smoke path (Phase 0).
  const demoNumber = "#SEED-MULTI";
  const existingDemo = await prisma.calculation.findUnique({ where: { number: demoNumber } });
  if (existingDemo) {
    await prisma.calculationItem.deleteMany({ where: { calculationId: existingDemo.id } });
    await prisma.calculation.delete({ where: { id: existingDemo.id } });
  }

  const queuedAt = new Date();
  const demoCalc = await prisma.calculation.create({
    data: {
      number: demoNumber,
      status: "QUEUED",
      title: "Ноутбуки + зарядки (demo)",
      description: "Партия ноутбуков Lenovo и зарядных устройств из Китая",
      country: "CN",
      shipmentValue: "18000 USD",
      clientUserId: client.id,
      companyId: company.id,
      tariffId: standard.id,
      preferredBrokerUserId: broker.id,
      hsCode: "8471 30 000 0",
      confidence: 0.91,
      dutyRub: 327000,
      vatRub: 584000,
      feeRub: 15000,
      totalPaymentsRub: 926000,
      paidAt: queuedAt,
      queuedAt,
      slaDeadline: new Date(queuedAt.getTime() + 4 * 3600_000),
      aiDraft: {
        hsCode: "8471 30 000 0",
        confidence: 0.91,
        disclaimer: "Demo seed — не для таможни",
      },
      items: {
        create: [
          {
            name: "Ноутбук Lenovo",
            description: "15\" i5 16GB",
            qty: 50,
            unit: "шт",
            unitPrice: 320,
            hsCodeAi: "8471 30 000 0",
            dutyRub: 280000,
            vatRub: 480000,
            sortOrder: 0,
          },
          {
            name: "Зарядное устройство 65W",
            description: "USB-C PD",
            qty: 50,
            unit: "шт",
            unitPrice: 18,
            hsCodeAi: "8504 40 820 0",
            dutyRub: 47000,
            vatRub: 104000,
            sortOrder: 1,
          },
        ],
      },
    },
    include: { items: true },
  });

  console.log("VED users:", client.email, broker.email, "password:", DEMO_PASSWORD);
  console.log("Demo QUEUED calc:", demoCalc.number, "items:", demoCalc.items.length);

  // Client branch demos: AI_READY (pay) + DONE (shipping/PDF)
  const express = await prisma.tariffPlan.findUniqueOrThrow({ where: { code: "EXPRESS" } });

  async function upsertDemo(
    number: string,
    data: {
      number: string;
      status: "AI_READY" | "DONE" | "QUEUED";
      title: string;
      description: string;
      country?: string;
      shipmentValue?: string;
      clientUserId: string;
      companyId: string;
      tariffId: string;
      preferredBrokerUserId?: string | null;
      hsCode?: string;
      hsCodeFinal?: string | null;
      confidence?: number;
      dutyRub?: number;
      vatRub?: number;
      feeRub?: number;
      totalPaymentsRub?: number;
      paidAt?: Date;
      doneAt?: Date;
      queuedAt?: Date;
      slaDeadline?: Date;
      pdfHtml?: string | null;
      aiDraft?: object;
      items: { create: Array<Record<string, unknown>> };
    }
  ) {
    const existing = await prisma.calculation.findUnique({ where: { number } });
    if (existing) {
      await prisma.shippingRequest.deleteMany({ where: { calculationId: existing.id } });
      await prisma.calculationItem.deleteMany({ where: { calculationId: existing.id } });
      await prisma.calculation.delete({ where: { id: existing.id } });
    }
    return prisma.calculation.create({ data: data as never, include: { items: true } });
  }

  const readyCalc = await upsertDemo("#SEED-READY", {
    number: "#SEED-READY",
    status: "AI_READY",
    title: "Мониторы (client pay demo)",
    description: "Партия мониторов 27\" для оплаты тарифа",
    country: "CN",
    shipmentValue: "9000 USD",
    clientUserId: client.id,
    companyId: company.id,
    tariffId: standard.id,
    preferredBrokerUserId: broker.id,
    hsCode: "8528 52 100 0",
    confidence: 0.88,
    dutyRub: 120000,
    vatRub: 210000,
    feeRub: 10000,
    totalPaymentsRub: 340000,
    aiDraft: { hsCode: "8528 52 100 0", confidence: 0.88, disclaimer: "Demo AI_READY" },
    items: {
      create: [
        {
          name: "Монитор 27\"",
          qty: 40,
          unit: "шт",
          unitPrice: 200,
          hsCodeAi: "8528 52 100 0",
          dutyRub: 100000,
          vatRub: 180000,
          sortOrder: 0,
        },
        {
          name: "Кабель HDMI",
          qty: 40,
          unit: "шт",
          unitPrice: 5,
          hsCodeAi: "8544 42 900 0",
          dutyRub: 20000,
          vatRub: 30000,
          sortOrder: 1,
        },
      ],
    },
  });

  const doneAt = new Date();
  const doneCalc = await upsertDemo("#SEED-DONE", {
    number: "#SEED-DONE",
    status: "DONE",
    title: "Клавиатуры (client shipping demo)",
    description: "Express DONE — PDF и перевозка",
    country: "CN",
    shipmentValue: "3000 USD",
    clientUserId: client.id,
    companyId: company.id,
    tariffId: express.id,
    hsCode: "8471 60 700 0",
    hsCodeFinal: "8471 60 700 0",
    confidence: 0.96,
    dutyRub: 40000,
    vatRub: 70000,
    feeRub: 5000,
    totalPaymentsRub: 115000,
    paidAt: doneAt,
    doneAt,
    pdfHtml: `<html><body><h1>LBM Брокер · #SEED-DONE</h1><h2>Сопоставление позиций</h2><p>HS 8471 60 700 0</p></body></html>`,
    aiDraft: { hsCode: "8471 60 700 0", confidence: 0.96, disclaimer: "Demo DONE" },
    items: {
      create: [
        {
          name: "Клавиатура USB",
          qty: 100,
          unit: "шт",
          unitPrice: 25,
          hsCodeAi: "8471 60 700 0",
          hsCodeFinal: "8471 60 700 0",
          dutyRub: 40000,
          vatRub: 70000,
          sortOrder: 0,
        },
      ],
    },
  });

  console.log("Demo AI_READY:", readyCalc.number, "DONE:", doneCalc.number);
  console.log("\n✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
