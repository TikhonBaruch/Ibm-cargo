import type { WizardDraft } from "./types";
import type { ClarifyOption } from "./clarify-options";
import {
  ACCESSORY_MATERIAL, APPLIANCE_CONDITION, APPLIANCE_POWER, APPAREL_GARMENT, APPAREL_GENDER,
  AUTO_PART_TYPE, BABY_AGE, BABY_KIND, BAG_KIND, BAG_MATERIAL, CODE_SCOPE, COLOR, COMPOSITION,
  CONDITION, COSMETIC_FORM, COSMETIC_KIND, COSMETIC_VOLUME, ELECTRONICS_DEVICE, ELECTRONICS_SPECS,
  FOOD_CERT, FOOD_KIND, FOOD_ORIGIN, FOOD_PACKAGING, FOOTWEAR_PURPOSE, FOOTWEAR_SOLE, FOOTWEAR_UPPER,
  GENERIC_BRAND_KIND, GENERIC_KIND, HOME_DISHES, HOME_KIND, HOME_MATERIAL, HOME_TEXTILE, KNIT_WOVEN,
  LAPTOP_SIZE, MATERIAL, SPORTS_KIND, TEXTILE_DENSITY, TEXTILE_WIDTH, TOOL_KIND, TOY_AGE, TOY_MATERIAL,
  YES_NO_DOCS, withCustomOption,
} from "./clarify-options";
import { hintTreeQuestions, hintTreeSkipQuestionIds } from "@/lib/ved/tnved-hint-trees";

export type { ClarifyOption } from "./clarify-options";

export type ClarificationQuestion = {
  id: string;
  text: string;
  required: boolean;
  hint?: string;
  kind?: "choice" | "text";
  options?: ClarifyOption[];
  allowCustom?: boolean;
};

type ClarifyInput = {
  wizard: WizardDraft;
  step: 1 | 2;
};

type Category =
  | "footwear"
  | "apparel"
  | "textiles"
  | "electronics"
  | "appliances"
  | "auto"
  | "cosmetics"
  | "bags"
  | "accessories"
  | "toys"
  | "sports"
  | "home"
  | "tools"
  | "food"
  | "baby"
  | "generic";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(s: string) {
  return s.toLowerCase().replace(/ё/g, "е");
}

/** Short tokens (hp, pc, tv) must be whole words, otherwise "кроссовки" / "одежда" get wrong questions. */
function matches(desc: string, raw: string) {
  const q = normalize(desc);
  const p = normalize(raw);
  if (!p) return false;
  if (p.length <= 3) {
    return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(p)}(?:$|[^a-zа-я0-9])`, "i").test(q);
  }
  return q.includes(p);
}

function hasAny(desc: string, parts: string[]) {
  return parts.some((p) => matches(desc, p));
}

function scoreKeys(desc: string, keys: string[]) {
  let score = 0;
  for (const k of keys) {
    if (matches(desc, k)) score += Math.min(normalize(k).length, 10);
  }
  return score;
}

const CATEGORY_KEYS: Record<Exclude<Category, "generic">, string[]> = {
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
    "молок", "сливки", "сгущен", "кефир", "йогурт", "творог",
  ],
  baby: [
    "детск", "для малыш", "подгузник", "коляск", "бутылочк", "соска",
    "слинг", "кроватка", "пеленк", "манеж", "распашон", "ползун",
  ],
};

const SPORTSWEAR_BRANDS = [
  "nike", "adidas", "puma", "reebok", "asics", "fila", "converse", "vans",
  "new balance", "timberland", "columbia", "the north face", "under armour",
];

function detectCategory(desc: string): Category {
  const ranked = (Object.entries(CATEGORY_KEYS) as [Exclude<Category, "generic">, string[]][])
    .map(([id, keys]) => ({ id, score: scoreKeys(desc, keys) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (top && top.score > 0) {
    // "спортивные кроссовки" must stay footwear, not sports/apparel.
    if (top.id === "sports" && scoreKeys(desc, CATEGORY_KEYS.footwear) > 0) return "footwear";
    if (top.id === "textiles" && scoreKeys(desc, CATEGORY_KEYS.apparel) > scoreKeys(desc, CATEGORY_KEYS.textiles)) {
      return "apparel";
    }
    if (top.id === "baby" && scoreKeys(desc, CATEGORY_KEYS.apparel) >= top.score
      && hasAny(desc, ["одежд", "футбол", "рубаш", "носк", "комбинезон", "распашон", "ползун"])) {
      return "apparel";
    }
    return top.id;
  }

  if (hasAny(desc, SPORTSWEAR_BRANDS)) return "generic";
  return "generic";
}

function detectColor(desc: string) {
  return hasAny(desc, [
    "черн", "чёрн", "бел", "беж", "красн", "синий", "синяя", "синие",
    "голуб", "зелен", "желт", "серый", "серая", "серые", "оранж", "фиолет",
    "розов", "коричн", "хаки", "бордов", "белый", "черный", "чёрный",
  ]);
}

function detectComposition(desc: string) {
  return hasAny(desc, [
    "хлопок", "хлопк", "лен", "шерст", "полиэстер", "полиэст", "эластан", "спандекс",
    "вискоз", "нейлон", "акрил", "модал", "шелк", "кашемир", "bamboo",
    "cotton", "polyester", "elastane", "spandex", "%",
  ]);
}

function detectFootwearUpper(desc: string) {
  return hasAny(desc, [
    "верх", "ткан", "текстил", "трикот", "хлопк", "нат. кож", "натуральн кож",
    "искусств кож", "экокож", "синтет", "замш", "нубук", "mesh", "сетк",
  ]);
}

function detectFootwearSole(desc: string) {
  return hasAny(desc, [
    "подошв", "резин", "эва", "eva", "пластик", "полиуретан", "pu ", "tpr",
    "композиционн кож", "полимер",
  ]);
}

function detectElectronicsSpecs(desc: string) {
  return hasAny(desc, [
    "гб", "gb", "ssd", "nvme", "hdd", "озу", "ram", "диагон", "дюйм",
    "кг", "i5", "i7", "i9", "ryzen", "мп", "mah", "ватт",
  ]);
}

function detectBrand(desc: string) {
  return hasAny(desc, [
    ...SPORTSWEAR_BRANDS, "uniqlo", "zara", "h&m", "apple", "lenovo", "asus",
    "acer", "dell", "hp", "xiaomi", "huawei", "samsung", "sony", "lg",
    "бренд", "производител",
  ]);
}

function detectApparelGender(desc: string) {
  return hasAny(desc, [
    "мужск", "женск", "детск", "унисекс", "men", "women", "boys", "girls", "kids",
  ]);
}

function detectGarmentType(desc: string) {
  return hasAny(desc, [
    "футбол", "рубаш", "поло", "майк", "курт", "пальт", "пухов", "брюк", "джинс",
    "шорт", "носк", "колгот", "плать", "юбк", "бель", "трус", "худи", "свитер", "комбинезон",
  ]);
}

function detectUnderwearOrSocks(desc: string) {
  return hasAny(desc, ["носк", "колгот", "трус", "бель", "бюстг", "пижам"]);
}

function detectElectronicsDevice(desc: string) {
  return hasAny(desc, [
    "ноут", "laptop", "notebook", "macbook", "thinkpad", "телефон", "смартфон", "iphone",
    "наушник", "headphone", "airpods", "гарнитур", "earbuds", "заряд", "powerbank",
    "кабель", "usb", "hdmi", "монитор", "телевиз", "ssd", "флеш", "планшет", "ipad", "tablet",
  ]);
}

function detectAutoPartType(desc: string) {
  return hasAny(desc, [
    "фильтр", "тормоз", "колод", "амортиз", "бампер", "крыл", "двигат", "фар",
    "шин", "диск колес", "стартер", "генератор", "подшипник", "глушител", "радиатор", "oil filter",
  ]);
}

function detectCosmeticForm(desc: string) {
  return hasAny(desc, [
    "крем", "шампун", "лосьон", "гель", "мыл", "пудр", "аэрозол", "спрей", "парфюм", "духи", "сыворотк",
  ]);
}

function detectCosmeticVolume(desc: string) {
  return hasAny(desc, ["мл", "ml", "л ", "литр", "объём", "объем"]);
}

function detectHomeKindHint(desc: string) {
  return hasAny(desc, [
    "посуд", "тарел", "кастр", "сковор", "подуш", "одеял", "постель", "простын",
    "мебел", "ламп", "свет", "штор", "ковер", "ковёр",
  ]);
}

function hasDocs(wizard: WizardDraft) {
  return Array.isArray(wizard.docs) && wizard.docs.length > 0;
}

function parsePrice(wizard: WizardDraft) {
  const n = Number(wizard.price);
  return Number.isFinite(n) ? n : NaN;
}

type QBase = Pick<ClarificationQuestion, "id" | "text" | "required" | "hint">;

function choiceQ(base: QBase, options: ClarifyOption[], opts?: { allowCustom?: boolean }): ClarificationQuestion {
  return {
    ...base,
    kind: "choice",
    options: opts?.allowCustom ? withCustomOption(options) : options,
    allowCustom: opts?.allowCustom,
  };
}

function textQ(base: QBase): ClarificationQuestion {
  return { ...base, kind: "text" };
}

export function normalizeQuestion(q: ClarificationQuestion): ClarificationQuestion {
  if (q.kind === "choice" && q.options?.length) return q;
  if (q.kind === "text") return q;
  return { ...q, kind: "text" };
}

function questionsForCategory(desc: string, category: Category): ClarificationQuestion[] {
  const qs: ClarificationQuestion[] = [];
  const short = desc.trim().length < 28;

  if (category === "footwear") {
    if (!detectFootwearUpper(desc)) {
      qs.push(choiceQ({
        id: "upper",
        required: false,
        text: "Из чего верх кроссовок/обуви?",
        hint: "Материал верха влияет на код ТН ВЭД.",
      }, FOOTWEAR_UPPER));
    }
    if (!detectFootwearSole(desc)) {
      qs.push(choiceQ({
        id: "sole",
        required: false,
        text: "Из чего подошва?",
        hint: "Резина, EVA или PU — разные позиции классификатора.",
      }, FOOTWEAR_SOLE));
    }
    if (short) {
      qs.push(choiceQ({
        id: "purpose",
        required: false,
        text: "Какая это обувь по назначению?",
      }, FOOTWEAR_PURPOSE));
    }
    if (short && !detectBrand(desc)) {
      qs.push(textQ({
        id: "brand",
        required: false,
        text: "Бренд, если знаете",
        hint: "Nike, Adidas, без бренда — напишите «нет».",
      }));
    }
    return qs;
  }

  if (category === "apparel") {
    if (!detectComposition(desc)) {
      qs.push(choiceQ({
        id: "composition",
        required: false,
        text: "Какой состав ткани?",
        hint: "Можно выбрать примерный состав.",
      }, COMPOSITION, { allowCustom: true }));
    }
    if (!hasAny(desc, ["трикотаж", "вязан", "ткан", "knit", "woven"])) {
      qs.push(choiceQ({
        id: "knit-woven",
        required: false,
        text: "Это трикотаж (тянущийся) или ткань (рубашечная/джинсовая)?",
        hint: "Трикотаж — футболки и худи; ткань — джинсы и рубашки.",
      }, KNIT_WOVEN));
    }
    if (!detectColor(desc)) {
      qs.push(choiceQ({
        id: "color",
        required: false,
        text: "Какой основной цвет?",
      }, COLOR, { allowCustom: true }));
    }
    if (!detectApparelGender(desc) && short && !detectUnderwearOrSocks(desc)) {
      qs.push(choiceQ({
        id: "gender",
        required: false,
        text: "Для кого одежда?",
        hint: "Пол и возраст влияют на код в группах 61–62.",
      }, APPAREL_GENDER));
    }
    if (!detectGarmentType(desc) && short) {
      qs.push(choiceQ({
        id: "garment",
        required: false,
        text: "Что это за изделие?",
        hint: "Верх, низ, верхняя одежда или бельё.",
      }, APPAREL_GARMENT));
    }
    if (short && !detectBrand(desc)) {
      qs.push(textQ({
        id: "brand",
        required: false,
        text: "Бренд, если известен",
        hint: "Можно «нет» или «no name».",
      }));
    }
    return qs;
  }

  if (category === "textiles") {
    if (!detectComposition(desc)) {
      qs.push(choiceQ({
        id: "composition",
        required: false,
        text: "Состав ткани",
        hint: "Выберите основной состав или укажите свой.",
      }, COMPOSITION, { allowCustom: true }));
    }
    if (!hasAny(desc, ["г/м", "г/м2", "плотн", "gsm"])) {
      qs.push(choiceQ({
        id: "density",
        required: false,
        text: "Какая плотность (г/м²)?",
        hint: "Для хлопка часто 80–200 г/м².",
      }, TEXTILE_DENSITY));
    }
    if (!hasAny(desc, ["ширин", "см"])) {
      qs.push(choiceQ({
        id: "width",
        required: false,
        text: "Ширина рулона",
        hint: "Типичные значения для ткани в рулоне.",
      }, TEXTILE_WIDTH, { allowCustom: true }));
    }
    return qs;
  }

  if (category === "electronics") {
    if (!detectElectronicsDevice(desc)) {
      qs.push(choiceQ({
        id: "device",
        required: false,
        text: "Что за устройство или аксессуар?",
        hint: "Ноутбук, телефон, наушники, зарядка, кабель…",
      }, ELECTRONICS_DEVICE, { allowCustom: true }));
    }
    if (short && !detectBrand(desc)) {
      qs.push(textQ({
        id: "brand-model",
        required: false,
        text: "Укажите бренд и модель",
        hint: "Lenovo ThinkPad T480, iPhone 13, Xiaomi Redmi…",
      }));
    }
    if (!detectElectronicsSpecs(desc)) {
      qs.push(choiceQ({
        id: "specs",
        required: false,
        text: "Какие ключевые характеристики?",
        hint: "Выберите типичный вариант или укажите свой.",
      }, ELECTRONICS_SPECS, { allowCustom: true }));
    }
    if (hasAny(desc, ["ноут", "laptop", "notebook", "macbook"]) && !hasAny(desc, ["диагон", "дюйм", "кг"])) {
      qs.push(choiceQ({
        id: "display-weight",
        required: false,
        text: "Диагональ экрана и вес",
        hint: "Важно для кода «до 10 кг».",
      }, LAPTOP_SIZE, { allowCustom: true }));
    }
    if (hasAny(desc, ["телефон", "смартфон", "iphone"]) && !hasAny(desc, ["нов", "б/у", "used"])) {
      qs.push(choiceQ({
        id: "condition",
        required: false,
        text: "Новые или б/у, с зарядкой в комплекте?",
      }, CONDITION));
    }
    return qs;
  }

  if (category === "appliances") {
    qs.push(choiceQ({
      id: "power",
      required: false,
      text: "Мощность и объём/размер",
      hint: "Ориентир по шильдику на технике.",
    }, APPLIANCE_POWER, { allowCustom: true }));
    if (!hasAny(desc, ["нов", "б/у"])) {
      qs.push(choiceQ({
        id: "condition",
        required: false,
        text: "Техника новая или б/у?",
        hint: "Для таможни это разные режимы.",
      }, APPLIANCE_CONDITION));
    }
    return qs;
  }

  if (category === "auto") {
    if (!detectAutoPartType(desc)) {
      qs.push(choiceQ({
        id: "part-type",
        required: false,
        text: "Какая группа запчасти?",
        hint: "Фильтр, тормоза, подвеска, кузов, двигатель…",
      }, AUTO_PART_TYPE, { allowCustom: true }));
    }
    if (short) {
      qs.push(textQ({
        id: "vehicle",
        required: false,
        text: "Для какого авто (марка / модель / год)?",
        hint: "Toyota Camry 2018 или «универсальные».",
      }));
    }
    qs.push(textQ({
      id: "part",
      required: false,
      text: "Точное название детали и материал, если знаете",
      hint: "Амортизатор, пластиковый бампер, колодки.",
    }));
    return qs;
  }

  if (category === "cosmetics") {
    if (!hasAny(desc, ["шампун", "крем", "духи", "парфюм", "помад", "тушь", "декоратив", "мыл", "лосьон"])) {
      qs.push(choiceQ({
        id: "kind",
        required: false,
        text: "Что именно: крем, шампунь, духи, декоративная косметика?",
        hint: "От вида зависит код и ограничения.",
      }, COSMETIC_KIND));
    }
    if (!detectCosmeticForm(desc)) {
      qs.push(choiceQ({
        id: "form",
        required: false,
        text: "Форма: жидкость, крем, твёрдое или аэрозоль?",
      }, COSMETIC_FORM));
    }
    if (!detectCosmeticVolume(desc)) {
      qs.push(choiceQ({
        id: "volume-range",
        required: false,
        text: "Примерный объём одной упаковки",
        hint: "Для духов и жидкостей важен объём.",
      }, COSMETIC_VOLUME));
    }
    return qs;
  }

  if (category === "bags") {
    if (!hasAny(desc, ["кож", "текстил", "ткан", "полиэстер", "нейлон", "пластик"])) {
      qs.push(choiceQ({
        id: "material",
        required: false,
        text: "Материал сумки/рюкзака снаружи",
      }, BAG_MATERIAL, { allowCustom: true }));
    }
    qs.push(choiceQ({
      id: "kind",
      required: false,
      text: "Это рюкзак, шоппер, чемодан или кошелёк?",
    }, BAG_KIND));
    return qs;
  }

  if (category === "accessories") {
    qs.push(choiceQ({
      id: "material",
      required: false,
      text: "Основной материал",
      hint: "Металл, пластик, текстиль, кожа, стекло.",
    }, ACCESSORY_MATERIAL, { allowCustom: true }));
    if (!detectBrand(desc) && short) {
      qs.push(textQ({
        id: "brand",
        required: false,
        text: "Бренд, если есть",
        hint: "Можно «без бренда».",
      }));
    }
    return qs;
  }

  if (category === "toys") {
    qs.push(choiceQ({
      id: "material",
      required: false,
      text: "Из чего игрушка?",
      hint: "Пластик, плюш, дерево или с электроникой.",
    }, TOY_MATERIAL));
    qs.push(choiceQ({
      id: "age",
      required: false,
      text: "Для какого возраста?",
    }, TOY_AGE, { allowCustom: true }));
    return qs;
  }

  if (category === "sports") {
    qs.push(choiceQ({
      id: "kind",
      required: false,
      text: "Какой спортивный инвентарь?",
      hint: "Мяч, гантели, коврик, ракетка…",
    }, SPORTS_KIND, { allowCustom: true }));
    return qs;
  }

  if (category === "home") {
    if (!detectHomeKindHint(desc)) {
      qs.push(choiceQ({
        id: "kind",
        required: false,
        text: "Что именно: посуда, текстиль для дома, мебель, свет?",
      }, HOME_KIND));
    }
    if (hasAny(desc, ["посуд", "тарел", "кастр", "сковор", "кружк", "бокал", "столов"])) {
      qs.push(choiceQ({
        id: "dishes-material",
        required: false,
        text: "Материал посуды",
      }, HOME_DISHES, { allowCustom: true }));
    } else if (hasAny(desc, ["подуш", "одеял", "постель", "простын", "штор", "покрывал", "салфет"])) {
      qs.push(choiceQ({
        id: "textile-material",
        required: false,
        text: "Состав текстиля для дома",
      }, HOME_TEXTILE, { allowCustom: true }));
    } else {
      qs.push(choiceQ({
        id: "material",
        required: false,
        text: "Материал изделия",
      }, HOME_MATERIAL, { allowCustom: true }));
    }
    return qs;
  }

  if (category === "tools") {
    qs.push(choiceQ({
      id: "kind",
      required: false,
      text: "Ручной или электроинструмент?",
      hint: "Мощность можно указать в «Другое».",
    }, TOOL_KIND, { allowCustom: true }));
    return qs;
  }

  if (category === "food") {
    qs.push(choiceQ({
      id: "kind",
      required: false,
      text: "Что за продукт?",
      hint: "Чай, кофе, снеки, БАД…",
    }, FOOD_KIND, { allowCustom: true }));
    qs.push(choiceQ({
      id: "packaging",
      required: false,
      text: "Как упаковано?",
      hint: "Розница, опт или заморозка.",
    }, FOOD_PACKAGING));
    qs.push(choiceQ({
      id: "origin",
      required: false,
      text: "Страна происхождения продукта",
    }, FOOD_ORIGIN, { allowCustom: true }));
    qs.push(choiceQ({
      id: "cert",
      required: false,
      text: "Есть ли сертификаты / срок годности на момент ввоза?",
    }, FOOD_CERT));
    return qs;
  }

  if (category === "baby") {
    qs.push(choiceQ({
      id: "kind",
      required: false,
      text: "Что именно для детей?",
    }, BABY_KIND));
    qs.push(choiceQ({
      id: "age",
      required: false,
      text: "Возраст ребёнка / размер",
    }, BABY_AGE, { allowCustom: true }));
    return qs;
  }

  if (hasAny(desc, SPORTSWEAR_BRANDS) && desc.trim().split(/\s+/).length <= 3) {
    qs.push(choiceQ({
      id: "kind",
      required: false,
      text: "Это одежда, обувь или аксессуар этого бренда?",
    }, GENERIC_BRAND_KIND));
  } else {
    qs.push(choiceQ({
      id: "kind",
      required: false,
      text: "Уточните, что это за товар (название и вид)",
      hint: "Как на инвойсе: одежда, обувь, ткань, запчасть…",
    }, GENERIC_KIND, { allowCustom: true }));
  }
  qs.push(choiceQ({
    id: "material",
    required: false,
    text: "Из какого материала основная часть?",
  }, MATERIAL, { allowCustom: true }));
  return qs;
}

function coreReady(desc: string, category: Category) {
  if (category === "apparel") return detectComposition(desc);
  if (category === "electronics") return detectElectronicsSpecs(desc) || desc.length >= 36;
  if (category === "footwear") return detectFootwearUpper(desc) && detectFootwearSole(desc);
  if (category === "textiles") return detectComposition(desc);
  return desc.length >= 24;
}

/**
 * Returns clarifying questions for the wizard.
 *
 * Notes:
 * - Currently returns demo/heuristic questions (no endpoint configured).
 * - Contract intentionally stays async so we can later replace internals with real AI calls.
 */
export async function getClarificationQuestions({ wizard, step }: ClarifyInput): Promise<ClarificationQuestion[]> {
  const endpoint = process.env.NEXT_PUBLIC_AI_CLARIFY_URL;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step, wizard }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.questions)) {
          return (data.questions as ClarificationQuestion[]).map(normalizeQuestion);
        }
      }
    } catch {
      // Fall back to heuristics
    }
  }

  const desc = wizard.desc.trim();
  const docsOk = hasDocs(wizard);
  const price = parsePrice(wizard);
  const qs: ClarificationQuestion[] = [];

  if (step === 1) {
    if (!desc) return [];
    const category = detectCategory(desc);
    const skip = new Set(hintTreeSkipQuestionIds(desc));
    const packQs = hintTreeQuestions(desc).map((q) =>
      choiceQ(
        { id: q.id, required: false, text: q.text, hint: q.hint },
        q.options,
        { allowCustom: true },
      ),
    );
    const catQs = questionsForCategory(desc, category).filter((q) => !skip.has(q.id));
    qs.push(...packQs, ...catQs);

    if (!docsOk && coreReady(desc, category)) {
      qs.push(choiceQ({
        id: "docs",
        required: false,
        text: "Есть фото или инвойс, чтобы уточнить точнее?",
        hint: "Документы не обязательны, но помогают с кодом.",
      }, YES_NO_DOCS));
    }
  }

  if (step === 2) {
    if (!Number.isFinite(price) || price <= 0) {
      qs.push(textQ({
        id: "price",
        required: true,
        text: "Уточните таможенную стоимость партии (в $)",
        hint: "Это значение используется для расчёта пошлины и НДС",
      }));
    } else if (price < 5000) {
      qs.push(textQ({
        id: "price-low",
        required: false,
        text: "Стоимость кажется невысокой — всё ли учтено в сумме партии?",
        hint: "Можно уточнить: объём/количество, что входит в стоимость",
      }));
    }

    if (wizard.tariff === "Код") {
      qs.push(choiceQ({
        id: "code-scope",
        required: false,
        text: "Тариф «Код» не считает пошлину. Этого описания достаточно для ТН ВЭД?",
        hint: "Если нужен расчёт платежей — позже можно взять «Таможню».",
      }, CODE_SCOPE));
    }
  }

  const docsQ = qs.find((q) => q.id === "docs");
  const trimmed = docsQ
    ? [...qs.filter((q) => q.id !== "docs").slice(0, 2), docsQ]
    : qs.slice(0, 3);
  return trimmed.map(normalizeQuestion);
}
