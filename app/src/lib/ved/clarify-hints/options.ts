import type { ProductAttrs } from "../product-description";
import type { ClarifyOption } from "./types";

export const CUSTOM_OPTION_ID = "custom";

export function withCustomOption(options: ClarifyOption[]): ClarifyOption[] {
  return [...options, { id: CUSTOM_OPTION_ID, label: "Другое", searchValue: "" }];
}

function opt(
  id: string,
  label: string,
  searchValue: string,
  attrsPatch?: ProductAttrs,
  hsHint?: string
): ClarifyOption {
  return {
    id,
    label,
    searchValue,
    ...(attrsPatch ? { attrsPatch } : {}),
    ...(hsHint ? { hsHint } : {}),
  };
}

export const COMPOSITION: ClarifyOption[] = [
  opt("cotton100", "100% хлопок", "100% хлопок", { composition: "100% хлопок" }),
  opt("cotton-elast", "Хлопок + эластан", "95% хлопок 5% эластан", {
    composition: "95% хлопок 5% эластан",
  }),
  opt("wool", "Шерсть", "шерсть", { composition: "шерсть" }),
  opt("polyester", "Полиэстер", "полиэстер", { composition: "полиэстер" }),
  opt("mixed", "Смешанный", "смешанный состав", { composition: "смешанный состав" }),
  opt("unknown", "Не знаю", "состав не указан"),
];

export const KNIT_WOVEN: ClarifyOption[] = [
  opt("knit", "Трикотаж", "трикотаж", { extra: { knitWoven: "трикотаж" } }),
  opt("woven", "Ткань", "ткань woven", { extra: { knitWoven: "ткань woven" } }),
  opt("unknown", "Не знаю", "тип полотна не указан"),
];

export const COLOR: ClarifyOption[] = [
  opt("black", "Чёрный", "чёрный", { extra: { color: "чёрный" } }),
  opt("white", "Белый", "белый", { extra: { color: "белый" } }),
  opt("blue", "Синий", "синий", { extra: { color: "синий" } }),
  opt("gray", "Серый", "серый", { extra: { color: "серый" } }),
  opt("multi", "Мульти / принт", "мультицвет принт", { extra: { color: "мультицвет принт" } }),
];

export const FOOTWEAR_UPPER: ClarifyOption[] = [
  opt("textile", "Текстиль", "верх текстиль", {
    material: "текстиль",
    extra: { upper: "верх текстиль" },
  }),
  opt("leather", "Нат. кожа", "верх натуральная кожа", {
    material: "натуральная кожа",
    extra: { upper: "верх натуральная кожа" },
  }),
  opt("synthetic", "Экокожа", "верх искусственная кожа", {
    material: "искусственная кожа",
    extra: { upper: "верх искусственная кожа" },
  }),
  opt("mesh", "Сетка", "верх сетка mesh", {
    material: "сетка",
    extra: { upper: "верх сетка mesh" },
  }),
];

export const FOOTWEAR_SOLE: ClarifyOption[] = [
  opt("rubber", "Резина", "подошва резина", { extra: { sole: "подошва резина" } }),
  opt("eva", "EVA", "подошва EVA", { extra: { sole: "подошва EVA" } }),
  opt("pu", "PU / пластик", "подошва полиуретан пластик", {
    extra: { sole: "подошва полиуретан пластик" },
  }),
  opt("unknown", "Не знаю", "подошва не указана"),
];

export const FOOTWEAR_PURPOSE: ClarifyOption[] = [
  opt("sport", "Спортивная", "спортивная обувь", { purpose: "спортивная обувь" }),
  opt("casual", "Повседневная", "повседневная обувь", { purpose: "повседневная обувь" }),
  opt("kids", "Детская", "детская обувь", { purpose: "детская обувь" }),
  opt("winter", "Зимняя", "зимняя обувь", { purpose: "зимняя обувь" }),
];

export const CONDITION: ClarifyOption[] = [
  opt("new", "Новый", "новый в упаковке", { extra: { condition: "новый в упаковке" } }),
  opt("used", "Б/у", "б/у used", { extra: { condition: "б/у used" } }),
  opt("device-only", "Только аппарат", "без зарядки только аппарат", {
    extra: { condition: "без зарядки только аппарат" },
  }),
];

export const APPLIANCE_CONDITION: ClarifyOption[] = [
  opt("new", "Новая", "новая техника", { extra: { condition: "новая техника" } }),
  opt("used", "Б/у", "б/у техника", { extra: { condition: "б/у техника" } }),
];

export const MATERIAL: ClarifyOption[] = [
  opt("cotton", "Хлопок / текстиль", "материал хлопок", { material: "хлопок" }),
  opt("leather", "Кожа", "материал кожа", { material: "кожа" }),
  opt("plastic", "Пластик", "материал пластик", { material: "пластик" }),
  opt("metal", "Металл", "материал металл", { material: "металл" }),
  opt("rubber", "Резина", "материал резина", { material: "резина" }),
];

export const BAG_MATERIAL: ClarifyOption[] = [
  opt("leather", "Нат. кожа", "натуральная кожа", { material: "натуральная кожа" }),
  opt("synthetic", "Экокожа", "искусственная кожа", { material: "искусственная кожа" }),
  opt("textile", "Текстиль", "текстиль", { material: "текстиль" }),
  opt("nylon", "Нейлон", "нейлон", { material: "нейлон" }),
];

export const BAG_KIND: ClarifyOption[] = [
  opt("backpack", "Рюкзак", "рюкзак", { purpose: "рюкзак", extra: { bagKind: "рюкзак" } }),
  opt("tote", "Шоппер", "шоппер сумка", { purpose: "шоппер сумка", extra: { bagKind: "шоппер" } }),
  opt("suitcase", "Чемодан", "чемодан", { purpose: "чемодан", extra: { bagKind: "чемодан" } }),
  opt("wallet", "Кошелёк", "кошелёк", { purpose: "кошелёк", extra: { bagKind: "кошелёк" } }),
];

export const COSMETIC_KIND: ClarifyOption[] = [
  opt("cream", "Крем", "крем", { purpose: "крем", extra: { cosmeticKind: "крем" } }),
  opt("shampoo", "Шампунь", "шампунь", { purpose: "шампунь", extra: { cosmeticKind: "шампунь" } }),
  opt("perfume", "Духи", "духи парфюм", { purpose: "духи парфюм", extra: { cosmeticKind: "духи" } }),
  opt("makeup", "Декоративная", "декоративная косметика", {
    purpose: "декоративная косметика",
    extra: { cosmeticKind: "декоративная" },
  }),
];

export const ACCESSORY_MATERIAL: ClarifyOption[] = [
  opt("metal", "Металл", "металл", { material: "металл" }),
  opt("plastic", "Пластик", "пластик", { material: "пластик" }),
  opt("textile", "Текстиль", "текстиль", { material: "текстиль" }),
  opt("leather", "Кожа", "кожа", { material: "кожа" }),
  opt("glass", "Стекло", "стекло", { material: "стекло" }),
];

export const TOY_MATERIAL: ClarifyOption[] = [
  opt("plastic", "Пластик", "пластик", { material: "пластик" }),
  opt("plush", "Плюш", "плюш мягкая игрушка", { material: "плюш" }),
  opt("wood", "Дерево", "дерево", { material: "дерево" }),
  opt("electronic", "С электроникой", "игрушка с батареей электроника", {
    material: "пластик",
    technicalSpecs: "с батареей",
  }),
];

export const TOY_AGE: ClarifyOption[] = [
  opt("0-2", "0–2 года", "0-2 года", { extra: { ageGroup: "0-2" } }),
  opt("3-6", "3–6 лет", "3+ 6+", { extra: { ageGroup: "3-6" } }),
  opt("7-12", "7–12 лет", "7+ 12+", { extra: { ageGroup: "7-12" } }),
  opt("teen", "Подростки", "подростки", { extra: { ageGroup: "teen" } }),
];

export const SPORTS_KIND: ClarifyOption[] = [
  opt("ball", "Мяч", "мяч резина", { purpose: "мяч", material: "резина" }),
  opt("dumbbell", "Гантели", "гантели", { purpose: "гантели" }),
  opt("mat", "Коврик", "коврик TPE", { purpose: "коврик", material: "TPE" }),
  opt("racket", "Ракетка", "ракетка", { purpose: "ракетка" }),
];

export const HOME_MATERIAL: ClarifyOption[] = [
  opt("glass", "Стекло", "стекло", { material: "стекло" }),
  opt("ceramic", "Керамика", "керамика", { material: "керамика" }),
  opt("plastic", "Пластик", "пластик", { material: "пластик" }),
  opt("wood", "Дерево", "дерево", { material: "дерево" }),
  opt("metal", "Металл", "металл", { material: "металл" }),
  opt("textile", "Текстиль", "текстиль", { material: "текстиль" }),
];

export const HOME_KIND: ClarifyOption[] = [
  opt("dishes", "Посуда", "посуда", { purpose: "посуда" }),
  opt("textile", "Текстиль для дома", "текстиль для дома", { purpose: "текстиль для дома" }),
  opt("furniture", "Мебель", "мебель", { purpose: "мебель" }),
  opt("light", "Свет", "светильник лампа", { purpose: "светильник лампа" }),
];

export const TOOL_KIND: ClarifyOption[] = [
  opt("hand", "Ручной", "ручной инструмент", { purpose: "ручной инструмент" }),
  opt("power", "Электроинструмент", "электроинструмент", { purpose: "электроинструмент" }),
  opt("set", "Набор", "набор инструментов", { purpose: "набор инструментов" }),
];

export const FOOD_KIND: ClarifyOption[] = [
  opt("tea", "Чай", "чай", { purpose: "чай" }),
  opt("coffee", "Кофе", "кофе", { purpose: "кофе" }),
  opt("snacks", "Снеки / сладости", "снеки сладости", { purpose: "снеки сладости" }),
  opt("supplement", "БАД / витамины", "БАД витамины", { purpose: "БАД витамины" }),
];

export const FOOD_CERT: ClarifyOption[] = [
  opt("yes", "Есть сертификаты", "есть сертификаты", { extra: { cert: "есть" } }),
  opt("no", "Нет", "нет сертификатов", { extra: { cert: "нет" } }),
  opt("unknown", "Не знаю", "сертификаты не указаны"),
];

export const BABY_KIND: ClarifyOption[] = [
  opt("clothes", "Одежда", "детская одежда", { purpose: "детская одежда" }),
  opt("shoes", "Обувь", "детская обувь", { purpose: "детская обувь" }),
  opt("stroller", "Коляска", "коляска", { purpose: "коляска" }),
  opt("toy", "Игрушка", "детская игрушка", { purpose: "детская игрушка" }),
];

export const BABY_AGE: ClarifyOption[] = [
  opt("0-1", "0–1 год", "0-1 год", { extra: { ageGroup: "0-1" } }),
  opt("1-3", "1–3 года", "1-3 года", { extra: { ageGroup: "1-3" } }),
  opt("3-7", "3–7 лет", "3-7 лет", { extra: { ageGroup: "3-7" } }),
  opt("size", "По размеру (98–128)", "размер 98-128", { extra: { ageGroup: "98-128" } }),
];

export const GENERIC_BRAND_KIND: ClarifyOption[] = [
  opt("shoes", "Обувь", "обувь", { purpose: "обувь" }),
  opt("apparel", "Одежда", "одежда", { purpose: "одежда" }),
  opt("bag", "Сумка / рюкзак", "рюкзак сумка", { purpose: "рюкзак сумка" }),
];

export const GENERIC_KIND: ClarifyOption[] = [
  opt("apparel", "Одежда", "категория одежда", { purpose: "одежда" }),
  opt("footwear", "Обувь", "категория обувь", { purpose: "обувь" }),
  opt("textile", "Ткань", "категория ткань textile", { purpose: "ткань" }),
  opt("parts", "Запчасть", "запчасть для авто", { purpose: "запчасть" }),
  opt("cosmetic", "Косметика", "категория косметика", { purpose: "косметика" }),
];

export const TEXTILE_DENSITY: ClarifyOption[] = [
  opt("light", "Лёгкая (до 120 г/м²)", "плотность 100 г/м2", {
    technicalSpecs: "плотность 100 г/м2",
  }),
  opt("medium", "Средняя (120–200)", "плотность 160 г/м2", {
    technicalSpecs: "плотность 160 г/м2",
  }),
  opt("heavy", "Плотная (200+)", "плотность 250 г/м2", {
    technicalSpecs: "плотность 250 г/м2",
  }),
  opt("unknown", "Не знаю", "плотность не указана"),
];

export const TEXTILE_WIDTH: ClarifyOption[] = [
  opt("140", "140 см", "ширина 140 см", { technicalSpecs: "ширина 140 см" }),
  opt("150", "150 см", "ширина 150 см", { technicalSpecs: "ширина 150 см" }),
  opt("180", "180 см", "ширина 180 см", { technicalSpecs: "ширина 180 см" }),
  opt("unknown", "Не знаю", "ширина не указана"),
];

export const ELECTRONICS_SPECS: ClarifyOption[] = [
  opt("laptop-basic", "Ноутбук: 8 ГБ / SSD", "ноутбук 8GB SSD", {
    technicalSpecs: "8GB SSD",
  }),
  opt("laptop-pro", "Ноутбук: 16 ГБ / SSD", "ноутбук 16GB SSD", {
    technicalSpecs: "16GB SSD",
  }),
  opt("phone-128", "Телефон: 128 ГБ", "смартфон 128GB", { technicalSpecs: "128GB" }),
  opt("phone-256", "Телефон: 256 ГБ", "смартфон 256GB", { technicalSpecs: "256GB" }),
  opt("tv-55", "ТВ: 55\"", "телевизор 55 дюймов", { technicalSpecs: "55 дюймов" }),
];

export const LAPTOP_SIZE: ClarifyOption[] = [
  opt("13", "13\" (~1.3 кг)", "13 дюймов 1.3 кг", {
    technicalSpecs: "13 дюймов 1.3 кг",
    netWeightKg: 1.3,
  }),
  opt("14", "14\" (~1.6 кг)", "14 дюймов 1.6 кг", {
    technicalSpecs: "14 дюймов 1.6 кг",
    netWeightKg: 1.6,
  }),
  opt("15", "15\"+ (~2 кг)", "15 дюймов 2 кг", {
    technicalSpecs: "15 дюймов 2 кг",
    netWeightKg: 2,
  }),
];

export const APPLIANCE_POWER: ClarifyOption[] = [
  opt("small", "До 1000 Вт", "до 1000 Вт", { technicalSpecs: "до 1000 Вт" }),
  opt("medium", "1000–2000 Вт", "1500 Вт", { technicalSpecs: "1500 Вт" }),
  opt("large", "2000+ Вт", "2000 Вт", { technicalSpecs: "2000 Вт" }),
  opt("unknown", "Не знаю", "мощность не указана"),
];

export const YES_NO_DOCS: ClarifyOption[] = [
  opt("no", "Нет", "нет документов"),
  opt("later", "Приложу позже", "документы приложу позже"),
  opt("yes", "Уже есть", "есть инвойс или фото"),
];

export const YES_NO: ClarifyOption[] = [
  opt("yes", "Да", "да"),
  opt("no", "Нет", "нет"),
];

export const CODE_SCOPE: ClarifyOption[] = [
  opt("enough", "Достаточно", "описания достаточно для кода"),
  opt("need-customs", "Нужна таможня", "нужен таможенный расчёт"),
];

export const APPAREL_GENDER: ClarifyOption[] = [
  opt("men", "Мужское", "мужская одежда", { extra: { gender: "мужская" } }),
  opt("women", "Женское", "женская одежда", { extra: { gender: "женская" } }),
  opt("kids", "Детское", "детская одежда", { extra: { gender: "детская", ageGroup: "kids" } }),
  opt("unisex", "Унисекс", "унисекс одежда", { extra: { gender: "унисекс" } }),
];

export const APPAREL_GARMENT: ClarifyOption[] = [
  opt("top", "Верх (футболка, рубашка)", "верхняя часть одежды", {
    extra: { garmentType: "верх" },
  }),
  opt("bottom", "Низ (брюки, шорты)", "брюки шорты низ", { extra: { garmentType: "низ" } }),
  opt("outer", "Куртка / пальто", "верхняя одежда куртка", {
    extra: { garmentType: "верхняя одежда" },
  }),
  opt("underwear", "Бельё / носки", "нижнее бельё носки", {
    extra: { garmentType: "бельё" },
  }),
  opt("dress", "Платье / комбинезон", "платье комбинезон", {
    extra: { garmentType: "платье" },
  }),
];

export const ELECTRONICS_DEVICE: ClarifyOption[] = [
  opt("laptop", "Ноутбук / ПК", "ноутбук портативный", {
    purpose: "ноутбук",
    extra: { deviceType: "ноутбук" },
  }),
  opt("phone", "Смартфон / планшет", "смартфон планшет", {
    purpose: "смартфон",
    extra: { deviceType: "смартфон" },
  }),
  opt("audio", "Наушники / гарнитура", "наушники гарнитура", {
    purpose: "наушники",
    extra: { deviceType: "наушники" },
  }),
  opt("charger", "Зарядка / блок питания", "зарядное устройство блок питания", {
    purpose: "зарядка",
    extra: { deviceType: "зарядка" },
  }),
  opt("cable", "Кабель / USB", "кабель USB провод", {
    purpose: "кабель",
    extra: { deviceType: "кабель" },
  }),
  opt("display", "Монитор / ТВ", "устройство монитор телевизор", {
    purpose: "монитор",
    extra: { deviceType: "монитор" },
  }),
  opt("storage", "SSD / флешка", "SSD накопитель флешка", {
    purpose: "SSD",
    extra: { deviceType: "SSD" },
  }),
];

export const AUTO_PART_TYPE: ClarifyOption[] = [
  opt("filter-oil", "Фильтр масла", "фильтр масла двигателя", {
    purpose: "фильтр масла",
  }),
  opt("filter-air", "Фильтр воздуха", "фильтр воздуха двигателя", {
    purpose: "фильтр воздуха",
  }),
  opt("brake", "Тормоза / колодки", "тормозные колодки диски", {
    purpose: "тормозные колодки",
  }),
  opt("suspension", "Подвеска / амортизатор", "амортизатор подвеска", {
    purpose: "амортизатор",
  }),
  opt("body", "Кузов (бампер, крыло)", "кузов бампер крыло", { purpose: "кузов" }),
  opt("engine", "Двигатель / навесное", "деталь двигателя", { purpose: "деталь двигателя" }),
  opt("electrical", "Электрика / фары", "электрика фара авто", { purpose: "электрика" }),
  opt("tires", "Шины / диски", "шины диски колёса", { purpose: "шины" }),
];

export const COSMETIC_FORM: ClarifyOption[] = [
  opt("liquid", "Жидкость (шампунь, лосьон)", "жидкая косметика", {
    extra: { form: "жидкость" },
  }),
  opt("cream", "Крем / паста", "крем паста", { extra: { form: "крем" } }),
  opt("solid", "Твёрдое (мыло, стик)", "твёрдая косметика мыло", { extra: { form: "твёрдое" } }),
  opt("aerosol", "Аэрозоль / спрей", "аэрозоль спрей", { extra: { form: "аэрозоль" } }),
  opt("powder", "Пудра / сыпучее", "пудра сыпучая", { extra: { form: "пудра" } }),
];

export const COSMETIC_VOLUME: ClarifyOption[] = [
  opt("small", "До 50 мл", "объём до 50 мл", { technicalSpecs: "до 50 мл" }),
  opt("medium", "50–250 мл", "объём 100 мл", { technicalSpecs: "100 мл" }),
  opt("large", "250 мл и больше", "объём 500 мл", { technicalSpecs: "500 мл" }),
  opt("unknown", "Не знаю", "объём не указан"),
];

export const FOOD_PACKAGING: ClarifyOption[] = [
  opt("retail", "Розничная упаковка", "розничная упаковка", {
    extra: { packaging: "розница" },
  }),
  opt("bulk", "Опт / мешки", "оптовая упаковка мешок", { extra: { packaging: "опт" } }),
  opt("frozen", "Замороженное", "замороженный продукт", { extra: { packaging: "заморозка" } }),
  opt("unknown", "Не знаю", "упаковка не указана"),
];

export const FOOD_ORIGIN: ClarifyOption[] = [
  opt("cn", "Китай", "происхождение Китай", { originCountry: "CN" }),
  opt("tr", "Турция", "происхождение Турция", { originCountry: "TR" }),
  opt("eu", "ЕС", "происхождение ЕС", { extra: { originRegion: "EU" } }),
  opt("other", "Другое", "страна происхождения другая"),
];

export const HOME_DISHES: ClarifyOption[] = [
  opt("ceramic", "Керамика / фарфор", "керамика фарфор посуда", {
    material: "керамика",
  }),
  opt("glass", "Стекло", "стекло посуда", { material: "стекло" }),
  opt("metal", "Металл", "металл посуда", { material: "металл" }),
  opt("plastic", "Пластик", "пластик посуда", { material: "пластик" }),
];

export const HOME_TEXTILE: ClarifyOption[] = [
  opt("cotton", "Хлопок", "хлопок текстиль для дома", { composition: "хлопок" }),
  opt("poly", "Синтетика", "полиэстер текстиль для дома", { composition: "полиэстер" }),
  opt("mixed", "Смешанный", "смешанный текстиль для дома", {
    composition: "смешанный состав",
  }),
  opt("unknown", "Не знаю", "состав текстиля не указан"),
];
