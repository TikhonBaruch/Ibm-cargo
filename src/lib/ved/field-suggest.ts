/**
 * Local prefix suggestions for NewCalc fields (D32 combobox).
 * No LLM / no HTTP — curated dictionaries + substring/prefix match.
 */
export type FieldSuggestKind =
  | "itemName"
  | "originCountry"
  | "shipCountry"
  | "partyDescription"
  | "material"
  | "brand"
  | "composition";

export type FieldSuggestEntry = {
  /** Value written into the input on pick. */
  value: string;
  /** Optional display line (e.g. "CN · Китай"). Defaults to value. */
  label?: string;
  /** Extra match tokens (RU names, synonyms). */
  aliases?: string[];
};

const ITEM_NAMES: FieldSuggestEntry[] = [
  { value: "носки" },
  { value: "ноутбук" },
  { value: "автомобиль", aliases: ["авто", "машина"] },
  { value: "станок" },
  { value: "майка" },
  { value: "футболка" },
  { value: "кроссовки", aliases: ["кроссовок", "крос", "кросо", "sneakers", "кеды"] },
  { value: "кепка", aliases: ["бейсболка", "фуражка", "cap", "baseball"] },
  { value: "шапка", aliases: ["бини", "beanie"] },
  { value: "молоко", aliases: ["молочка", "milk"] },
  { value: "смартфон", aliases: ["телефон", "мобильный"] },
  { value: "планшет" },
  { value: "наушники" },
  { value: "куртка" },
  { value: "джинсы" },
  { value: "светодиодная лампа", aliases: ["лампа", "led"] },
  { value: "зарядное устройство", aliases: ["зарядка", "адаптер"] },
  { value: "кабель USB" },
  { value: "шина", aliases: ["резина"] },
  { value: "подшипник" },
  { value: "насос" },
  { value: "мебель" },
  { value: "игрушка" },
];

/** Common EAEU / trade-origin ISO-2 codes for create form. */
const ORIGIN_COUNTRIES: FieldSuggestEntry[] = [
  { value: "CN", label: "CN · Китай", aliases: ["китай", "china"] },
  { value: "VN", label: "VN · Вьетнам", aliases: ["вьетнам", "vietnam"] },
  { value: "TR", label: "TR · Турция", aliases: ["турция", "turkey"] },
  { value: "DE", label: "DE · Германия", aliases: ["германия", "germany"] },
  { value: "IT", label: "IT · Италия", aliases: ["италия", "italy"] },
  { value: "PL", label: "PL · Польша", aliases: ["польша", "poland"] },
  { value: "BY", label: "BY · Беларусь", aliases: ["беларусь", "белоруссия"] },
  { value: "KZ", label: "KZ · Казахстан", aliases: ["казахстан"] },
  { value: "UZ", label: "UZ · Узбекистан", aliases: ["узбекистан"] },
  { value: "IN", label: "IN · Индия", aliases: ["индия", "india"] },
  { value: "KR", label: "KR · Корея", aliases: ["корея", "korea"] },
  { value: "JP", label: "JP · Япония", aliases: ["япония", "japan"] },
  { value: "US", label: "US · США", aliases: ["сша", "америка", "usa"] },
  { value: "TW", label: "TW · Тайвань", aliases: ["тайвань", "taiwan"] },
  { value: "TH", label: "TH · Таиланд", aliases: ["таиланд", "thailand"] },
  { value: "BD", label: "BD · Бангладеш", aliases: ["бангладеш"] },
  { value: "ID", label: "ID · Индонезия", aliases: ["индонезия"] },
  { value: "MY", label: "MY · Малайзия", aliases: ["малайзия"] },
  { value: "AE", label: "AE · ОАЭ", aliases: ["оаэ", "эмираты"] },
  { value: "GB", label: "GB · Великобритания", aliases: ["великобритания", "англия", "uk"] },
];

/** Free-text ship-from country names (партия «Страна отправления»). */
const SHIP_COUNTRIES: FieldSuggestEntry[] = ORIGIN_COUNTRIES.map((e) => {
  const ru =
    (e.aliases || []).find((a) => /[а-яё]/i.test(a)) ||
    e.label?.split("·")[1]?.trim() ||
    e.value;
  return {
    value: ru.charAt(0).toUpperCase() + ru.slice(1),
    aliases: [e.value, ...(e.aliases || []), e.value.toLowerCase()],
  };
});

/** Short party-description phrases for «Описание партии». */
const PARTY_DESCRIPTIONS: FieldSuggestEntry[] = [
  { value: "мужские носки, хлопок 100%, парная упаковка", aliases: ["носки", "носк"] },
  { value: "футболки хлопок, взрослые, ассортимент цветов", aliases: ["футболк", "майк"] },
  { value: "кроссовки текстиль/резина, для взрослых", aliases: ["кроссовк", "кеды", "обувь"] },
  { value: "кепки бейсболки текстиль, с козырьком", aliases: ["кепк", "бейсболк", "фуражк"] },
  { value: "ноутбуки 14'', для офиса, с зарядкой", aliases: ["ноутбук", "laptop"] },
  { value: "молоко питьевое / сухое (уточните форму)", aliases: ["молок", "milk"] },
  { value: "смартфоны, новые, с зарядным устройством", aliases: ["смартфон", "телефон"] },
  { value: "наушники беспроводные, пластик/силикон", aliases: ["наушник"] },
  { value: "светодиодные лампы E27, 10 Вт", aliases: ["ламп", "led"] },
  { value: "кабели USB-C, длина 1 м", aliases: ["кабель", "usb"] },
  { value: "джинсы деним, взрослые", aliases: ["джинс"] },
  { value: "куртки текстиль на подкладке", aliases: ["куртк"] },
];

const MATERIALS: FieldSuggestEntry[] = [
  { value: "хлопок" },
  { value: "трикотаж" },
  { value: "полиэстер" },
  { value: "нейлон" },
  { value: "кожа" },
  { value: "экокожа" },
  { value: "пластик" },
  { value: "ABS-пластик", aliases: ["abs"] },
  { value: "алюминий" },
  { value: "сталь" },
  { value: "нержавеющая сталь", aliases: ["нержавейка"] },
  { value: "медь" },
  { value: "дерево" },
  { value: "резина" },
  { value: "силикон" },
  { value: "стекло" },
  { value: "керамика" },
  { value: "ткань" },
  { value: "лён" },
  { value: "шерсть" },
];

const BRANDS: FieldSuggestEntry[] = [
  { value: "Nike" },
  { value: "Adidas" },
  { value: "Samsung" },
  { value: "Apple" },
  { value: "Lenovo" },
  { value: "Xiaomi" },
  { value: "Huawei" },
  { value: "Sony" },
  { value: "LG" },
  { value: "Bosch" },
  { value: "Siemens" },
  { value: "Toyota" },
  { value: "Hyundai" },
  { value: "Uniqlo" },
  { value: "Zara" },
  { value: "IKEA" },
  { value: "Philips" },
  { value: "Canon" },
  { value: "HP" },
  { value: "Dell" },
];

const COMPOSITIONS: FieldSuggestEntry[] = [
  { value: "хлопок 100%" },
  { value: "хлопок 80% / полиэстер 20%" },
  { value: "полиэстер 100%" },
  { value: "шерсть 100%" },
  { value: "aluminium + Li-ion" },
  { value: "сталь / пластик" },
  { value: "ABS + металл" },
  { value: "дерево / МДФ" },
  { value: "резина / текстиль" },
  { value: "силикон / пластик" },
  { value: "стекло / алюминий" },
  { value: "медь / ПВХ" },
  { value: "керамика / металл" },
];

const CATALOG: Record<FieldSuggestKind, FieldSuggestEntry[]> = {
  itemName: ITEM_NAMES,
  originCountry: ORIGIN_COUNTRIES,
  shipCountry: SHIP_COUNTRIES,
  partyDescription: PARTY_DESCRIPTIONS,
  material: MATERIALS,
  brand: BRANDS,
  composition: COMPOSITIONS,
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function entryMatches(entry: FieldSuggestEntry, q: string): boolean {
  if (!q) return true;
  const n = norm(q);
  if (norm(entry.value).includes(n)) return true;
  if (entry.label && norm(entry.label).includes(n)) return true;
  return (entry.aliases || []).some((a) => norm(a).includes(n) || n.includes(norm(a)));
}

function scoreEntry(entry: FieldSuggestEntry, q: string): number {
  if (!q) return 0;
  const n = norm(q);
  const v = norm(entry.value);
  if (v.startsWith(n)) return 0;
  if ((entry.aliases || []).some((a) => norm(a).startsWith(n))) return 1;
  if (v.includes(n)) return 2;
  return 3;
}

function originCountryRuName(entry: FieldSuggestEntry): string {
  const fromLabel = entry.label?.split("·")[1]?.trim();
  if (fromLabel) return fromLabel;
  const ru = (entry.aliases || []).find((a) => /[а-яё]/i.test(a));
  if (ru) return ru.charAt(0).toUpperCase() + ru.slice(1);
  return entry.value;
}

/** RU labels for the create-form country select (same catalog as origin suggestions). */
export function originCountrySelectOptions(): { label: string; iso: string }[] {
  const rows = ORIGIN_COUNTRIES.map((e) => ({
    label: originCountryRuName(e),
    iso: e.value,
  }));
  if (!rows.some((r) => r.label === "ЕС")) {
    const de = rows.findIndex((r) => r.iso === "DE");
    rows.splice(de < 0 ? rows.length : de + 1, 0, { label: "ЕС", iso: "DE" });
  }
  return rows;
}

/** Human country for order chrome. Accepts ISO, RU name, or «CN · Китай». */
export function originCountryRuLabel(...raw: Array<string | null | undefined>): string {
  const v = raw.map((x) => (x || "").trim()).find(Boolean) || "";
  if (!v) return "";
  const n = norm(v);
  if (n === "ес" || n === "eu") return "ЕС";
  for (const e of ORIGIN_COUNTRIES) {
    const ru = originCountryRuName(e);
    if (norm(e.value) === n || norm(ru) === n) return ru;
    if (e.label && norm(e.label) === n) return ru;
    if ((e.aliases || []).some((a) => norm(a) === n)) return ru;
  }
  const dotted = v.includes("·") ? v.split("·")[1]?.trim() : "";
  if (dotted && dotted !== v) return originCountryRuLabel(dotted);
  return v;
}

/** Filter curated suggestions for a field kind. Empty query → first `limit` entries. */
export function filterFieldSuggestions(
  kind: FieldSuggestKind,
  query: string,
  limit = 8
): FieldSuggestEntry[] {
  const catalog = CATALOG[kind] || [];
  const q = query.trim();
  const matched = catalog.filter((e) => entryMatches(e, q));
  matched.sort((a, b) => scoreEntry(a, q) - scoreEntry(b, q) || a.value.localeCompare(b.value, "ru"));
  return matched.slice(0, Math.max(1, limit));
}

export function fieldSuggestDisplay(entry: FieldSuggestEntry): string {
  return entry.label || entry.value;
}

/**
 * Coerce free text (RU alias / ISO-2) to origin ISO-2 on blur/pick.
 * Returns null if nothing confident — leave the field for the user to fix.
 */
export function resolveOriginCountryCode(query: string): string | null {
  const q = query.trim();
  if (!q) return null;
  if (/^[A-Za-z]{2}$/.test(q)) return q.toUpperCase();
  const hits = filterFieldSuggestions("originCountry", q, 8);
  if (!hits.length) return null;
  const n = norm(q);
  const exact = hits.find(
    (e) =>
      norm(e.value) === n ||
      norm(e.label || "") === n ||
      (e.aliases || []).some((a) => norm(a) === n)
  );
  if (exact) return exact.value;
  // Unique prefix among aliases/codes (e.g. «кит» → CN).
  if (hits.length === 1) return hits[0].value;
  const prefixHits = hits.filter(
    (e) =>
      norm(e.value).startsWith(n) ||
      (e.aliases || []).some((a) => norm(a).startsWith(n)) ||
      (e.label && norm(e.label).includes(n) && scoreEntry(e, q) <= 1)
  );
  if (prefixHits.length === 1) return prefixHits[0].value;
  return null;
}
