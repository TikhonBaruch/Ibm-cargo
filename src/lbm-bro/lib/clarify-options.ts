export type ClarifyOption = { id: string; label: string; value: string; hsHeading?: string };

export const CUSTOM_OPTION_ID = "custom";

export function withCustomOption(options: ClarifyOption[]): ClarifyOption[] {
  return [...options, { id: CUSTOM_OPTION_ID, label: "Другое", value: "" }];
}

export const COMPOSITION: ClarifyOption[] = [
  { id: "cotton100", label: "100% хлопок", value: "100% хлопок" },
  { id: "cotton-elast", label: "Хлопок + эластан", value: "95% хлопок 5% эластан" },
  { id: "wool", label: "Шерсть", value: "шерсть" },
  { id: "polyester", label: "Полиэстер", value: "полиэстер" },
  { id: "mixed", label: "Смешанный", value: "смешанный состав" },
  { id: "unknown", label: "Не знаю", value: "состав не указан" },
];

export const KNIT_WOVEN: ClarifyOption[] = [
  { id: "knit", label: "Трикотаж", value: "трикотаж" },
  { id: "woven", label: "Ткань", value: "ткань woven" },
  { id: "unknown", label: "Не знаю", value: "тип полотна не указан" },
];

export const COLOR: ClarifyOption[] = [
  { id: "black", label: "Чёрный", value: "чёрный" },
  { id: "white", label: "Белый", value: "белый" },
  { id: "blue", label: "Синий", value: "синий" },
  { id: "gray", label: "Серый", value: "серый" },
  { id: "multi", label: "Мульти / принт", value: "мультицвет принт" },
];

export const FOOTWEAR_UPPER: ClarifyOption[] = [
  { id: "textile", label: "Текстиль", value: "верх текстиль" },
  { id: "leather", label: "Нат. кожа", value: "верх натуральная кожа" },
  { id: "eco-leather", label: "Экокожа", value: "верх искусственная кожа" },
  { id: "mesh", label: "Сетка", value: "верх сетка mesh" },
];

export const FOOTWEAR_SOLE: ClarifyOption[] = [
  { id: "rubber", label: "Резина", value: "подошва резина" },
  { id: "eva", label: "EVA", value: "подошва EVA" },
  { id: "pu", label: "PU / пластик", value: "подошва полиуретан пластик" },
  { id: "unknown", label: "Не знаю", value: "подошва не указана" },
];

export const FOOTWEAR_PURPOSE: ClarifyOption[] = [
  { id: "sport", label: "Спортивная", value: "спортивная обувь" },
  { id: "casual", label: "Повседневная", value: "повседневная обувь" },
  { id: "kids", label: "Детская", value: "детская обувь" },
  { id: "winter", label: "Зимняя", value: "зимняя обувь" },
];

export const CONDITION: ClarifyOption[] = [
  { id: "new", label: "Новый", value: "новый в упаковке" },
  { id: "used", label: "Б/у", value: "б/у used" },
  { id: "device-only", label: "Только аппарат", value: "без зарядки только аппарат" },
];

export const APPLIANCE_CONDITION: ClarifyOption[] = [
  { id: "new", label: "Новая", value: "новая техника" },
  { id: "used", label: "Б/у", value: "б/у техника" },
];

export const MATERIAL: ClarifyOption[] = [
  { id: "cotton", label: "Хлопок / текстиль", value: "материал хлопок" },
  { id: "leather", label: "Кожа", value: "материал кожа" },
  { id: "plastic", label: "Пластик", value: "материал пластик" },
  { id: "metal", label: "Металл", value: "материал металл" },
  { id: "rubber", label: "Резина", value: "материал резина" },
];

export const BAG_MATERIAL: ClarifyOption[] = [
  { id: "leather", label: "Нат. кожа", value: "натуральная кожа" },
  { id: "eco-leather", label: "Экокожа", value: "искусственная кожа" },
  { id: "textile", label: "Текстиль", value: "текстиль" },
  { id: "nylon", label: "Нейлон", value: "нейлон" },
];

export const BAG_KIND: ClarifyOption[] = [
  { id: "backpack", label: "Рюкзак", value: "рюкзак" },
  { id: "tote", label: "Шоппер", value: "шоппер сумка" },
  { id: "suitcase", label: "Чемодан", value: "чемодан" },
  { id: "wallet", label: "Кошелёк", value: "кошелёк" },
];

export const COSMETIC_KIND: ClarifyOption[] = [
  { id: "cream", label: "Крем", value: "крем" },
  { id: "shampoo", label: "Шампунь", value: "шампунь" },
  { id: "perfume", label: "Духи", value: "духи парфюм" },
  { id: "makeup", label: "Декоративная", value: "декоративная косметика" },
];

export const ACCESSORY_MATERIAL: ClarifyOption[] = [
  { id: "metal", label: "Металл", value: "металл" },
  { id: "plastic", label: "Пластик", value: "пластик" },
  { id: "textile", label: "Текстиль", value: "текстиль" },
  { id: "leather", label: "Кожа", value: "кожа" },
  { id: "glass", label: "Стекло", value: "стекло" },
];

export const TOY_MATERIAL: ClarifyOption[] = [
  { id: "plastic", label: "Пластик", value: "пластик" },
  { id: "plush", label: "Плюш", value: "плюш мягкая игрушка" },
  { id: "wood", label: "Дерево", value: "дерево" },
  { id: "electronic", label: "С электроникой", value: "игрушка с батареей электроника" },
];

export const TOY_AGE: ClarifyOption[] = [
  { id: "0-2", label: "0–2 года", value: "0-2 года" },
  { id: "3-6", label: "3–6 лет", value: "3+ 6+" },
  { id: "7-12", label: "7–12 лет", value: "7+ 12+" },
  { id: "teen", label: "Подростки", value: "подростки" },
];

export const SPORTS_KIND: ClarifyOption[] = [
  { id: "ball", label: "Мяч", value: "мяч резина" },
  { id: "dumbbell", label: "Гантели", value: "гантели" },
  { id: "mat", label: "Коврик", value: "коврик TPE" },
  { id: "racket", label: "Ракетка", value: "ракетка" },
];

export const HOME_MATERIAL: ClarifyOption[] = [
  { id: "glass", label: "Стекло", value: "стекло" },
  { id: "ceramic", label: "Керамика", value: "керамика" },
  { id: "plastic", label: "Пластик", value: "пластик" },
  { id: "wood", label: "Дерево", value: "дерево" },
  { id: "metal", label: "Металл", value: "металл" },
  { id: "textile", label: "Текстиль", value: "текстиль" },
];

export const HOME_KIND: ClarifyOption[] = [
  { id: "dishes", label: "Посуда", value: "посуда" },
  { id: "textile", label: "Текстиль для дома", value: "текстиль для дома" },
  { id: "furniture", label: "Мебель", value: "мебель" },
  { id: "light", label: "Свет", value: "светильник лампа" },
];

export const TOOL_KIND: ClarifyOption[] = [
  { id: "hand", label: "Ручной", value: "ручной инструмент" },
  { id: "power", label: "Электроинструмент", value: "электроинструмент" },
  { id: "set", label: "Набор", value: "набор инструментов" },
];

export const FOOD_KIND: ClarifyOption[] = [
  { id: "tea", label: "Чай", value: "чай" },
  { id: "coffee", label: "Кофе", value: "кофе" },
  { id: "snacks", label: "Снеки / сладости", value: "снеки сладости" },
  { id: "supplement", label: "БАД / витамины", value: "БАД витамины" },
];

export const FOOD_CERT: ClarifyOption[] = [
  { id: "yes", label: "Есть сертификаты", value: "есть сертификаты" },
  { id: "no", label: "Нет", value: "нет сертификатов" },
  { id: "unknown", label: "Не знаю", value: "сертификаты не указаны" },
];

export const BABY_KIND: ClarifyOption[] = [
  { id: "clothes", label: "Одежда", value: "детская одежда" },
  { id: "shoes", label: "Обувь", value: "детская обувь" },
  { id: "stroller", label: "Коляска", value: "коляска" },
  { id: "toy", label: "Игрушка", value: "детская игрушка" },
];

export const BABY_AGE: ClarifyOption[] = [
  { id: "0-1", label: "0–1 год", value: "0-1 год" },
  { id: "1-3", label: "1–3 года", value: "1-3 года" },
  { id: "3-7", label: "3–7 лет", value: "3-7 лет" },
  { id: "size", label: "По размеру (98–128)", value: "размер 98-128" },
];

export const GENERIC_BRAND_KIND: ClarifyOption[] = [
  { id: "shoes", label: "Обувь", value: "обувь" },
  { id: "apparel", label: "Одежда", value: "одежда" },
  { id: "bag", label: "Сумка / рюкзак", value: "рюкзак сумка" },
];

export const GENERIC_KIND: ClarifyOption[] = [
  { id: "apparel", label: "Одежда", value: "категория одежда" },
  { id: "footwear", label: "Обувь", value: "категория обувь" },
  { id: "textile", label: "Ткань", value: "категория ткань textile" },
  { id: "parts", label: "Запчасть", value: "запчасть для авто" },
  { id: "cosmetic", label: "Косметика", value: "категория косметика" },
];

export const TEXTILE_DENSITY: ClarifyOption[] = [
  { id: "light", label: "Лёгкая (до 120 г/м²)", value: "плотность 100 г/м2" },
  { id: "medium", label: "Средняя (120–200)", value: "плотность 160 г/м2" },
  { id: "heavy", label: "Плотная (200+)", value: "плотность 250 г/м2" },
  { id: "unknown", label: "Не знаю", value: "плотность не указана" },
];

export const TEXTILE_WIDTH: ClarifyOption[] = [
  { id: "140", label: "140 см", value: "ширина 140 см" },
  { id: "150", label: "150 см", value: "ширина 150 см" },
  { id: "180", label: "180 см", value: "ширина 180 см" },
  { id: "unknown", label: "Не знаю", value: "ширина не указана" },
];

export const ELECTRONICS_SPECS: ClarifyOption[] = [
  { id: "laptop-basic", label: "Ноутбук: 8 ГБ / SSD", value: "ноутбук 8GB SSD" },
  { id: "laptop-pro", label: "Ноутбук: 16 ГБ / SSD", value: "ноутбук 16GB SSD" },
  { id: "phone-128", label: "Телефон: 128 ГБ", value: "смартфон 128GB" },
  { id: "phone-256", label: "Телефон: 256 ГБ", value: "смартфон 256GB" },
  { id: "tv-55", label: "ТВ: 55\"", value: "телевизор 55 дюймов" },
];

export const LAPTOP_SIZE: ClarifyOption[] = [
  { id: "13", label: "13\" (~1.3 кг)", value: "13 дюймов 1.3 кг" },
  { id: "14", label: "14\" (~1.6 кг)", value: "14 дюймов 1.6 кг" },
  { id: "15", label: "15\"+ (~2 кг)", value: "15 дюймов 2 кг" },
];

export const APPLIANCE_POWER: ClarifyOption[] = [
  { id: "small", label: "До 1000 Вт", value: "до 1000 Вт" },
  { id: "medium", label: "1000–2000 Вт", value: "1500 Вт" },
  { id: "large", label: "2000+ Вт", value: "2000 Вт" },
  { id: "unknown", label: "Не знаю", value: "мощность не указана" },
];

export const YES_NO_DOCS: ClarifyOption[] = [
  { id: "no", label: "Нет", value: "нет документов" },
  { id: "later", label: "Приложу позже", value: "документы приложу позже" },
  { id: "yes", label: "Уже есть", value: "есть инвойс или фото" },
];

export const YES_NO: ClarifyOption[] = [
  { id: "yes", label: "Да", value: "да" },
  { id: "no", label: "Нет", value: "нет" },
];

export const CODE_SCOPE: ClarifyOption[] = [
  { id: "enough", label: "Достаточно", value: "описания достаточно для кода" },
  { id: "need-customs", label: "Нужна таможня", value: "нужен таможенный расчёт" },
];

export const APPAREL_GENDER: ClarifyOption[] = [
  { id: "men", label: "Мужское", value: "мужская одежда" },
  { id: "women", label: "Женское", value: "женская одежда" },
  { id: "kids", label: "Детское", value: "детская одежда" },
  { id: "unisex", label: "Унисекс", value: "унисекс одежда" },
];

export const APPAREL_GARMENT: ClarifyOption[] = [
  { id: "top", label: "Верх (футболка, рубашка)", value: "верхняя часть одежды" },
  { id: "bottom", label: "Низ (брюки, шорты)", value: "брюки шорты низ" },
  { id: "outer", label: "Куртка / пальто", value: "верхняя одежда куртка" },
  { id: "underwear", label: "Бельё / носки", value: "нижнее бельё носки" },
  { id: "dress", label: "Платье / комбинезон", value: "платье комбинезон" },
];

export const ELECTRONICS_DEVICE: ClarifyOption[] = [
  { id: "laptop", label: "Ноутбук / ПК", value: "ноутбук портативный" },
  { id: "phone", label: "Смартфон / планшет", value: "смартфон планшет" },
  { id: "audio", label: "Наушники / гарнитура", value: "наушники гарнитура" },
  { id: "charger", label: "Зарядка / блок питания", value: "зарядное устройство блок питания" },
  { id: "cable", label: "Кабель / USB", value: "кабель USB провод" },
  { id: "display", label: "Монитор / ТВ", value: "устройство монитор телевизор" },
  { id: "storage", label: "SSD / флешка", value: "SSD накопитель флешка" },
];

export const AUTO_PART_TYPE: ClarifyOption[] = [
  { id: "filter-oil", label: "Фильтр масла", value: "фильтр масла двигателя" },
  { id: "filter-air", label: "Фильтр воздуха", value: "фильтр воздуха двигателя" },
  { id: "brake", label: "Тормоза / колодки", value: "тормозные колодки диски" },
  { id: "suspension", label: "Подвеска / амортизатор", value: "амортизатор подвеска" },
  { id: "body", label: "Кузов (бампер, крыло)", value: "кузов бампер крыло" },
  { id: "engine", label: "Двигатель / навесное", value: "деталь двигателя" },
  { id: "electrical", label: "Электрика / фары", value: "электрика фара авто" },
  { id: "tires", label: "Шины / диски", value: "шины диски колёса" },
];

export const COSMETIC_FORM: ClarifyOption[] = [
  { id: "liquid", label: "Жидкость (шампунь, лосьон)", value: "жидкая косметика" },
  { id: "cream", label: "Крем / паста", value: "крем паста" },
  { id: "solid", label: "Твёрдое (мыло, стик)", value: "твёрдая косметика мыло" },
  { id: "aerosol", label: "Аэрозоль / спрей", value: "аэрозоль спрей" },
  { id: "powder", label: "Пудра / сыпучее", value: "пудра сыпучая" },
];

export const COSMETIC_VOLUME: ClarifyOption[] = [
  { id: "small", label: "До 50 мл", value: "объём до 50 мл" },
  { id: "medium", label: "50–250 мл", value: "объём 100 мл" },
  { id: "large", label: "250 мл и больше", value: "объём 500 мл" },
  { id: "unknown", label: "Не знаю", value: "объём не указан" },
];

export const FOOD_PACKAGING: ClarifyOption[] = [
  { id: "retail", label: "Розничная упаковка", value: "розничная упаковка" },
  { id: "bulk", label: "Опт / мешки", value: "оптовая упаковка мешок" },
  { id: "frozen", label: "Замороженное", value: "замороженный продукт" },
  { id: "unknown", label: "Не знаю", value: "упаковка не указана" },
];

export const FOOD_ORIGIN: ClarifyOption[] = [
  { id: "cn", label: "Китай", value: "происхождение Китай" },
  { id: "tr", label: "Турция", value: "происхождение Турция" },
  { id: "eu", label: "ЕС", value: "происхождение ЕС" },
  { id: "other", label: "Другое", value: "страна происхождения другая" },
];

export const HOME_DISHES: ClarifyOption[] = [
  { id: "ceramic", label: "Керамика / фарфор", value: "керамика фарфор посуда" },
  { id: "glass", label: "Стекло", value: "стекло посуда" },
  { id: "metal", label: "Металл", value: "металл посуда" },
  { id: "plastic", label: "Пластик", value: "пластик посуда" },
];

export const HOME_TEXTILE: ClarifyOption[] = [
  { id: "cotton", label: "Хлопок", value: "хлопок текстиль для дома" },
  { id: "poly", label: "Синтетика", value: "полиэстер текстиль для дома" },
  { id: "mixed", label: "Смешанный", value: "смешанный текстиль для дома" },
  { id: "unknown", label: "Не знаю", value: "состав текстиля не указан" },
];
