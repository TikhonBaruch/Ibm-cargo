import type { CategoryId } from "./types";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeClarifyText(s: string) {
  return s.toLowerCase().replace(/ё/g, "е");
}

/** Short tokens (hp, pc, tv) must be whole words. */
export function matchesClarify(desc: string, raw: string) {
  const q = normalizeClarifyText(desc);
  const p = normalizeClarifyText(raw);
  if (!p) return false;
  if (p.length <= 3) {
    return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(p)}(?:$|[^a-zа-я0-9])`, "i").test(q);
  }
  return q.includes(p);
}

export function hasAnyClarify(desc: string, parts: string[]) {
  return parts.some((p) => matchesClarify(desc, p));
}

function scoreKeys(desc: string, keys: string[]) {
  let score = 0;
  for (const k of keys) {
    if (matchesClarify(desc, k)) score += Math.min(normalizeClarifyText(k).length, 10);
  }
  return score;
}

export const CATEGORY_KEYS: Record<Exclude<CategoryId, "generic">, string[]> = {
  footwear: [
    "кроссов", "кросовк", "кросы", "кеды", "кед", "обув", "ботин", "туфл",
    "сандал", "босонож", "шлепан", "сланц", "тапоч", "сапог", "угги", "ugg",
    "лофер", "слипон", "мокасин", "балетк", "сабо", "валенк", "берц",
    "sneaker", "sneakers", "trainers", "shoes", "footwear", "boots", "sandals",
  ],
  apparel: [
    "одежд", "футболк", "майка", "майки", "майку", "поло", "рубашк", "сорочк", "блуз", "плать", "юбк",
    "шорты", "джинс", "брюк", "штаны", "леггинс", "лосин", "костюм", "пиджак",
    "куртк", "пальто", "пуховик", "ветровк", "парка", "жилет", "свитер", "свитшот",
    "худи", "толстов", "кардиган", "водолаз", "носки", "колгот", "белье", "трусы",
    "бюстгаль", "пижам", "халат", "спецодежд", "комбинезон", "галстук", "жилетк",
    "hoodie", "sweatshirt", "t-shirt", "tshirt", "t shirt", "jacket", "dress",
    "pants", "jeans", "shorts", "shirt", "blouse", "skirt", "leggings",
  ],
  textiles: [
    "ткан", "полотн", "трикотажн полотн", "рулон", "купон ткани", "хлопок 100",
    "ситец", "бязь", "сатин", "шерсть в рулон", "faux fur", "мех искусствен",
    "fabric", "textile roll",
  ],
  electronics: [
    "ноут", "laptop", "notebook", "macbook", "thinkpad", "смартфон", "телефон",
    "iphone", "android", "samsung galaxy", "xiaomi", "планшет", "ipad", "tablet",
    "наушник", "headphones", "airpods", "гарнитур", "earbuds", "колонк", "speaker",
    "зарядк", "powerbank", "повербанк", "блок питан", "адаптер usb", "type-c",
    "кабель usb", "hdmi", "монитор", "телевизор", "телевиз", "камер", "webcam",
    "фотоаппарат", "видеорегистратор", "роутер", "модем", "процессор", "видеокарт",
    "ssd", "флешк", "usb flash", "компьютер", "системн блок", "пк ", " pc",
    "lenovo", "asus", "acer", "dell", "mac book", "smartwatch", "часы умные",
  ],
  appliances: [
    "пылесос", "утюг", "фен", "мультиварк", "микроволн", "холодильник",
    "стиральн", "посудомойн", "кофемашин", "блендер", "тостер", "обогреватель",
    "кондиционер", "чайник электри",
  ],
  auto: [
    "автозапчаст", "запчаст", "амортизатор", "фильтр масля", "oil filter", "brake pad",
    "тормозн колод", "фара", "бампер", "диск колес", "шины для авто", "автошин", "дворник авто",
    "свеча зажиган", "стартер", "генератор авто", "oem", "подшипник", "рулев",
    "глушител", "радиатор", "кпп", "сцеплен", "стойк", "рычаг", "насос", "фильтр салон",
    "фильтр воздуш", "фильтр топлив",
  ],
  cosmetics: [
    "косметик", "крем", "сыворотк", "шампунь", "бальзам для волос", "помада",
    "тушь", "тональн", "духи", "туалетная вода", "парфюм", "лосьон", "маска для лица",
    "гель для душа", "мыло", "deodorant", "perfume", "skincare", "кондиционер",
    "скраб", "пена для брить", "бальзам", "масло космет",
  ],
  bags: [
    "рюкзак", "сумк", "портфель", "клатч", "кошелек", "кошелёк", "чемодан",
    "дорожн сумк", "шоппер", "backpack", "handbag", "tote", "wallet",
  ],
  accessories: [
    "очк", "солнечн очк", "ремень", "пояс", "шапк", "кепк", "шарф", "перчатк",
    "бижутер", "серьг", "цепочк", "браслет", "кольцо", "часы", "watch",
    "украшен", "головн убор",
  ],
  toys: [
    "игрушк", "конструктор", "lego", "кукл", "мягк игрушк", "машинк детск",
    "настолк игр", "пазл", "toy",
  ],
  sports: [
    "мяч", "гантел", "коврик для йог", "велосипед", "самокат", "ролики",
    "лыж", "сноуборд", "теннисн ракетк", "скакалка", "эспандер",
  ],
  home: [
    "посуд", "тарелк", "кастрюл", "сковород", "столов прибор", "ваза", "кружк", "бокал",
    "подушк", "одеял", "постельн", "простын", "штор", "покрывал", "салфет",
    "ковёр", "ковер", "светильник", "лампа", "люстр", "мебель", "стул", "стол", "полк",
  ],
  tools: [
    "инструмент", "дрель", "шуруповерт", "перфоратор", "ключ гаечн",
    "набор бит", "болгарк", "сварочн",
  ],
  food: [
    "чай ", "кофе ", "специи", "бакалея", "сладост", "шоколад", "снек",
    "батончик", "бад", "витамин", "протеин", "сухофрукт", "мёд", "мед ",
    "орех", "консерв", "макарон", "рис ", "мука", "сок ", "напиток",
  ],
  baby: [
    "детск", "для малыш", "подгузник", "коляск", "бутылочк", "соска",
    "слинг", "кроватка", "пеленк", "манеж", "распашон", "ползун",
  ],
};

export const SPORTSWEAR_BRANDS = [
  "nike", "adidas", "puma", "reebok", "asics", "fila", "converse", "vans",
  "new balance", "timberland", "columbia", "the north face", "under armour",
];

export function detectCategory(desc: string): CategoryId {
  const ranked = (Object.entries(CATEGORY_KEYS) as [Exclude<CategoryId, "generic">, string[]][])
    .map(([id, keys]) => ({ id, score: scoreKeys(desc, keys) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (top && top.score > 0) {
    if (top.id === "sports" && scoreKeys(desc, CATEGORY_KEYS.footwear) > 0) return "footwear";
    if (
      top.id === "textiles" &&
      scoreKeys(desc, CATEGORY_KEYS.apparel) > scoreKeys(desc, CATEGORY_KEYS.textiles)
    ) {
      return "apparel";
    }
    if (
      top.id === "baby" &&
      scoreKeys(desc, CATEGORY_KEYS.apparel) >= top.score &&
      hasAnyClarify(desc, ["одежд", "футбол", "рубаш", "носк", "комбинезон", "распашон", "ползун"])
    ) {
      return "apparel";
    }
    return top.id;
  }

  if (hasAnyClarify(desc, SPORTSWEAR_BRANDS)) return "generic";
  return "generic";
}

export function detectColor(desc: string) {
  return hasAnyClarify(desc, [
    "черн", "чёрн", "бел", "беж", "красн", "синий", "синяя", "синие",
    "голуб", "зелен", "желт", "серый", "серая", "серые", "оранж", "фиолет",
    "розов", "коричн", "хаки", "бордов", "белый", "черный", "чёрный",
  ]);
}

export function detectComposition(desc: string) {
  return hasAnyClarify(desc, [
    "хлопок", "хлопк", "лен", "шерст", "полиэстер", "полиэст", "эластан", "спандекс",
    "вискоз", "нейлон", "акрил", "модал", "шелк", "кашемир", "bamboo",
    "cotton", "polyester", "elastane", "spandex", "%",
  ]);
}

export function detectFootwearUpper(desc: string) {
  return hasAnyClarify(desc, [
    "верх", "ткан", "текстил", "трикот", "хлопк", "нат. кож", "натуральн кож",
    "искусств кож", "экокож", "синтет", "замш", "нубук", "mesh", "сетк",
  ]);
}

export function detectFootwearSole(desc: string) {
  return hasAnyClarify(desc, [
    "подошв", "резин", "эва", "eva", "пластик", "полиуретан", "pu ", "tpr",
    "композиционн кож", "полимер",
  ]);
}

export function detectElectronicsSpecs(desc: string) {
  return hasAnyClarify(desc, [
    "гб", "gb", "ssd", "nvme", "hdd", "озу", "ram", "диагон", "дюйм",
    "кг", "i5", "i7", "i9", "ryzen", "мп", "mah", "ватт",
  ]);
}

export function detectBrand(desc: string) {
  return hasAnyClarify(desc, [
    ...SPORTSWEAR_BRANDS, "uniqlo", "zara", "h&m", "apple", "lenovo", "asus",
    "acer", "dell", "hp", "xiaomi", "huawei", "samsung", "sony", "lg",
    "бренд", "производител",
  ]);
}

export function detectApparelGender(desc: string) {
  return hasAnyClarify(desc, [
    "мужск", "женск", "детск", "унисекс", "men", "women", "boys", "girls", "kids",
  ]);
}

export function detectGarmentType(desc: string) {
  return hasAnyClarify(desc, [
    "футбол", "рубаш", "поло", "майк", "курт", "пальт", "пухов", "брюк", "джинс",
    "шорт", "носк", "колгот", "плать", "юбк", "бель", "трус", "худи", "свитер", "комбинезон",
  ]);
}

export function detectUnderwearOrSocks(desc: string) {
  return hasAnyClarify(desc, ["носк", "колгот", "трус", "бель", "бюстг", "пижам"]);
}

export function detectElectronicsDevice(desc: string) {
  return hasAnyClarify(desc, [
    "ноут", "laptop", "notebook", "macbook", "thinkpad", "телефон", "смартфон", "iphone",
    "наушник", "headphone", "airpods", "гарнитур", "earbuds", "заряд", "powerbank",
    "кабель", "usb", "hdmi", "монитор", "телевиз", "ssd", "флеш", "планшет", "ipad", "tablet",
  ]);
}

export function detectAutoPartType(desc: string) {
  return hasAnyClarify(desc, [
    "фильтр", "тормоз", "колод", "амортиз", "бампер", "крыл", "двигат", "фар",
    "шин", "диск колес", "стартер", "генератор", "подшипник", "глушител", "радиатор", "oil filter",
  ]);
}

export function detectCosmeticForm(desc: string) {
  return hasAnyClarify(desc, [
    "крем", "шампун", "лосьон", "гель", "мыл", "пудр", "аэрозол", "спрей", "парфюм", "духи", "сыворотк",
  ]);
}

export function detectCosmeticVolume(desc: string) {
  return hasAnyClarify(desc, ["мл", "ml", "л ", "литр", "объём", "объем"]);
}

export function detectHomeKindHint(desc: string) {
  return hasAnyClarify(desc, [
    "посуд", "тарел", "кастр", "сковор", "подуш", "одеял", "постель", "простын",
    "мебел", "ламп", "свет", "штор", "ковер", "ковёр",
  ]);
}

export function coreReady(desc: string, category: CategoryId) {
  if (category === "apparel") return detectComposition(desc);
  if (category === "electronics") return detectElectronicsSpecs(desc) || desc.length >= 36;
  if (category === "footwear") return detectFootwearUpper(desc) && detectFootwearSole(desc);
  if (category === "textiles") return detectComposition(desc);
  return desc.length >= 24;
}

/** Human tip labels for open gaps (NewCalc StageTip). */
export function gapTipLabels(desc: string, category: CategoryId): string[] {
  const labels: string[] = [];
  if (category === "footwear") {
    if (!detectFootwearUpper(desc)) labels.push("верх");
    if (!detectFootwearSole(desc)) labels.push("подошва");
    if (desc.trim().length < 28) labels.push("назначение");
  } else if (category === "apparel") {
    if (!detectComposition(desc)) labels.push("состав");
    if (!hasAnyClarify(desc, ["трикотаж", "вязан", "ткан", "knit", "woven"])) {
      labels.push("трикотаж/ткань");
    }
  } else if (category === "electronics") {
    if (!detectElectronicsDevice(desc)) labels.push("тип устройства");
    if (!detectElectronicsSpecs(desc)) labels.push("характеристики");
  } else if (category === "textiles") {
    if (!detectComposition(desc)) labels.push("состав");
  }
  return labels;
}
