/**
 * Shared TN VED query matching (H1–H2): household RU stems + false-friend guards.
 * Consumers: directory search, C21 packs (triggers), cascade (later).
 * Canon: docs/knowledge/plan-tnved-hint-chains-audit.md
 */

export const TNVED_SEARCH_STOP = new Set([
  "для",
  "или",
  "без",
  "the",
  "and",
  "for",
  "with",
  "from",
]);

/** Fixture-driven denylist: short produce stem must not hitchhike dairy notes. */
export const TNVED_FALSE_FRIEND_PAIRS: ReadonlyArray<{ query: string; block: string }> = [
  { query: "огур", block: "йогурт" },
  { query: "огур", block: "yogurt" },
  { query: "огур", block: "yoghurt" },
  { query: "огур", block: "кефир" },
];

/**
 * P7: short C21 pack triggers (len ≤4) must not hitchhike longer unrelated tokens.
 * Canon: plan-hint-chains-precision-audit.md §P7.
 */
export const SHORT_TRIGGER_FALSE_FRIENDS: ReadonlyArray<{ stem: string; block: string }> = [
  { stem: "поло", block: "полотенц" },
  { stem: "кофе", block: "кофеин" },
  { stem: "кофе", block: "кофемаш" },
  { stem: "кофе", block: "кофеварк" },
  { stem: "крем", block: "брюле" },
  { stem: "крем", block: "brulee" },
  { stem: "pod", block: "ipod" },
  { stem: "pod", block: "airpod" },
  { stem: "стол", block: "столов" },
];

/**
 * Directory search colloquial aliases (H5 residual after C21 packs).
 * Canon: docs/knowledge/plan-tnved-search-alias-boost.md
 * — expand pool (codePrefix OR + stems) + score boost; blockHit = lexical denylist.
 */
export type TnvedSearchAlias = {
  id: string;
  test: RegExp;
  codePrefix: string;
  expandStems?: readonly string[];
  blockHit?: RegExp;
};

export const TNVED_SEARCH_ALIASES: readonly TnvedSearchAlias[] = [
  {
    id: "mors-drink",
    // bare «морс/морсы», not «морская»
    test: /(?:^|[^\p{L}\p{N}])морс(?:ы|а|ом|у)?(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "2202",
    expandStems: ["морс", "напитк"],
    blockHit: /морск/i,
  },
  {
    id: "hdd-ssd",
    test: /(?:^|[^\p{L}\p{N}])(?:hdd|ssd)(?:$|[^\p{L}\p{N}])|ж[её]стк[а-яё]*\s+диск|винчестер|hard\s*disk|hard\s*drive|твердотельн|solid\s*state/iu,
    codePrefix: "8471",
    expandStems: ["жестк", "накопител", "винчестер", "ssd", "твердотельн"],
  },
  {
    id: "laptop",
    test: /ноутбук|laptop|notebook|macbook|портативн[a-zа-яё]*\s+вычисл/iu,
    codePrefix: "847130",
    // no «портативн» expand — pulls antennas/фонари; chapter OR is enough
    expandStems: ["ноутбук", "laptop", "notebook"],
    blockHit: /бамбук|bamboo/i,
  },
  // --- false-friend audit batch (plan-tnved-search-false-friend-audit.md) ---
  {
    id: "lemonade",
    test: /лимонад|lemonade/iu,
    codePrefix: "2202",
    expandStems: ["лимонад", "напитк"],
  },
  {
    id: "cola",
    test: /(?:^|[^\p{L}\p{N}])кол[аыуе](?:$|[^\p{L}\p{N}])|coca[- ]?cola|\bcola\b/iu,
    codePrefix: "2202",
    expandStems: ["кола", "напитк"],
  },
  {
    id: "orange-juice",
    test: /сок\s+апельсин|апельсин[a-zа-яё]*\s+сок|orange\s+juice/iu,
    codePrefix: "2009",
    expandStems: ["апельсин", "сок"],
  },
  {
    id: "mineral-water",
    test: /минеральн[a-zа-яё]*\s+вод|mineral\s+water/iu,
    codePrefix: "2201",
    expandStems: ["минеральн", "вод"],
    blockHit: /вата|шлаковат|силикатн/i,
  },
  {
    id: "laundry-powder",
    test: /стиральн\S*\s+порошок|порошок\S*\s+стиральн|washing\s+powder|laundry\s+detergent/iu,
    codePrefix: "3402",
    expandStems: ["стиральн", "моющ", "детергент"],
    blockHit: /драгоцен|платин|серебр|золот|металлич|слонов|кость|ivory|отходы|мука|помол|какао|горчич|крахмал/i,
  },
  {
    id: "raw-rice",
    test: /(?:^|[^\p{L}\p{N}])рис(?:а|у|ом|е)?(?:$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])rice(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "1006",
    expandStems: ["рис"],
    blockHit: /обработ|подготовл|хлопь|рисово/i,
  },
  {
    id: "sausage",
    test: /колбас|sausage/iu,
    codePrefix: "1601",
    expandStems: ["колбас"],
  },
  {
    id: "chips",
    test: /чипсы|chips|картофельн[a-zа-яё]*\s+чипс/iu,
    codePrefix: "1905",
    expandStems: ["чипс", "хрустящ"],
  },
  {
    id: "waffles",
    test: /(?:^|[^\p{L}\p{N}])вафл|waffles?/iu,
    codePrefix: "1905",
    expandStems: ["вафл"],
    blockHit: /мыл|soap|хлопья|гранул|порошк/i,
  },
  {
    id: "cake",
    test: /(?:^|[^\p{L}\p{N}])торт(?:ы|а|ом|у)?(?:$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])cake(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "1905",
    expandStems: ["торт", "кондитер"],
  },
  {
    id: "pizza",
    test: /пицц|pizza/iu,
    codePrefix: "1905",
    expandStems: ["пицц"],
  },
  {
    id: "chicken-soup",
    test: /суп\s+кури|кури[a-zа-яё]*\s+суп|chicken\s+soup/iu,
    codePrefix: "2104",
    expandStems: ["суп", "бульон"],
  },
  {
    id: "ice-cream",
    test: /мороженое|ice[- ]?cream/iu,
    codePrefix: "2105",
    expandStems: ["мороженое", "десерт"],
    blockHit:
      /рыб|треск|филе|лосос|gadus|заморож|панцир|кревет|ракообраз|моллюск|копчен|краб|лангуст|seafood|мороженн[a-zа-яё]*\s+(?:рыб|мяс|филе)/i,
  },
  {
    id: "glue",
    test: /(?:^|[^\p{L}\p{N}])клей(?:$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])glue(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "3506",
    expandStems: ["клей", "адгезив"],
    blockHit: /рыбий|желатин/i,
  },
  {
    id: "coffee-machine",
    test: /кофемаш|кофеварк|coffee\s*machine|coffee\s*maker|espresso\s*machine/iu,
    codePrefix: "8516",
    expandStems: ["кофемаш", "кофеварк", "электротермическ"],
  },
  {
    id: "kettle",
    test: /(?:^|[^\p{L}\p{N}])чайник(?:$|[^\p{L}\p{N}])|electric\s+kettle|чайников/iu,
    codePrefix: "8516",
    expandStems: ["чайник", "электротермическ"],
  },
  {
    id: "mattress",
    test: /матрас|mattress/iu,
    codePrefix: "9404",
    expandStems: ["матрас", "матрац"],
  },
  {
    id: "car-seat",
    test: /автокрес|car\s*seat|детск[a-zа-яё]*\s+кресл[a-zа-яё]*\s+авто/iu,
    codePrefix: "9401",
    expandStems: ["кресл", "детск"],
  },
  {
    id: "camera",
    test: /фотоаппарат|фотокамер|\bdslr\b|photo\s*camera/iu,
    codePrefix: "9006",
    expandStems: ["фотоаппарат", "фотокамер", "камер"],
  },
  {
    id: "wheelchair",
    test: /инвалидн[а-яa-z]*\s+коляск|wheelchair/iu,
    codePrefix: "8713",
    expandStems: ["инвалидн", "коляск"],
  },
  {
    id: "stroller",
    test: /(?:^|[^\p{L}\p{N}])коляск|stroller|baby\s+carriage|pushchair/iu,
    codePrefix: "8715",
    expandStems: ["коляск", "детск"],
    blockHit: /мотоцикл|мопед|двигател/i,
  },
  {
    id: "pen",
    test: /(?:^|[^\p{L}\p{N}])ручк[аиуеой]?(?:$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])pen(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "9608",
    expandStems: ["ручк", "шариков"],
  },
  {
    id: "ring-jewelry",
    test: /(?:^|[^\p{L}\p{N}])кольц[оаеу](?:$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])ring(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "7113",
    expandStems: ["кольцо", "ювелир", "перстен"],
    blockHit: /эфир|пероксид|фенол|спирт|химическ/i,
  },
  {
    id: "cigarettes",
    // bare tobacco cigarettes — not «электронная сигарета»
    test: /(?<!электронн[a-zа-яё]{0,12}\s)(?:^|[^\p{L}\p{N}])сигарет/iu,
    codePrefix: "2402",
    expandStems: ["сигарет", "табак"],
    blockHit: /электронн|вейп|vapor|vape/i,
  },
  {
    id: "agri-feed",
    test: /комбикорм|animal\s*feed|корм\s+для\s+скот/iu,
    codePrefix: "2309",
    expandStems: ["комбикорм", "корм"],
  },
  {
    id: "playstation",
    test: /playstation|play\s*station|\bps[45]\b|игровая\s+приставк/iu,
    codePrefix: "9504",
    expandStems: ["приставк", "игровы", "playstation"],
  },
  {
    id: "car-bumper",
    test: /(?:^|[^\p{L}\p{N}])бампер(?:$|[^\p{L}\p{N}])|car\s+bumper|авто[a-zа-яё]*\s+бампер/iu,
    codePrefix: "8708",
    expandStems: ["бампер", "кузов"],
    blockHit: /бамперн|аттракцион/i,
  },
  {
    id: "hdmi-cable",
    test: /hdmi|кабель\s+hdmi|hdmi\s+кабель/iu,
    codePrefix: "8544",
    expandStems: ["кабел", "провод", "hdmi"],
    blockHit: /желоб|канальн|магистральн/i,
  },
  {
    id: "chicken-meat",
    test: /(?:^|[^\p{L}\p{N}])куриц|(?:^|[^\p{L}\p{N}])chicken(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "0207",
    expandStems: ["куриц", "птиц"],
  },
  {
    id: "belt",
    test: /(?:^|[^\p{L}\p{N}])ремень(?:$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])ремни(?:$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])belt(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "4203",
    expandStems: ["ремен", "пояс"],
  },
  {
    id: "keds",
    test: /(?:^|[^\p{L}\p{N}])кеды(?:$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])keds?(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "6404",
    expandStems: ["кед", "обув", "текстильн"],
  },
  {
    id: "milk",
    test: /(?:^|[^\p{L}\p{N}])молоко(?:$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])milk(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "0401",
    expandStems: ["молоко"],
  },
  {
    id: "fabric",
    test: /(?:^|[^\p{L}\p{N}])ткань(?:$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])fabric(?:$|[^\p{L}\p{N}])/iu,
    codePrefix: "5208",
    expandStems: ["ткан", "хлопчат"],
  },
  {
    id: "gloves",
    test: /(?:^|[^\p{L}\p{N}])перчатк|gloves?/iu,
    codePrefix: "6116",
    expandStems: ["перчатк"],
  },
  {
    id: "mittens",
    test: /варежк|mittens?/iu,
    codePrefix: "6116",
    expandStems: ["варежк", "перчатк"],
  },
  {
    id: "tie",
    test: /галстук|necktie|\btie\b/iu,
    codePrefix: "6215",
    expandStems: ["галстук"],
  },
  {
    id: "pajama",
    test: /пижам|pajama|pyjama/iu,
    codePrefix: "6107",
    expandStems: ["пижам"],
  },
  {
    id: "robe",
    test: /(?:^|[^\p{L}\p{N}])халат|bathrobe|dressing\s+gown/iu,
    codePrefix: "6107",
    expandStems: ["халат"],
    blockHit: /одноразов|медицин|пациент/i,
  },
];

export function resolveTnvedSearchAlias(query: string): TnvedSearchAlias | null {
  const q = String(query || "").trim();
  if (!q) return null;
  const hit = TNVED_SEARCH_ALIASES.find((a) => a.test.test(q)) ?? null;
  // Plant «молоко» must not boost dairy 0401 (coverage P0).
  if (hit?.id === "milk" && isPlantDairyQuery(q)) return null;
  // «электронная сигарета» → vape (8543), not tobacco 2402.
  if (hit?.id === "cigarettes" && /электронн|вейп|\bvape\b|vapor/i.test(q)) return null;
  return hit;
}

/** Bare «перец» is spice/veg ambiguous (0904 vs 0709) — require sweet/bell qualifiers. */
export const PRODUCE_PEPPER_REQUIRE_QUALIFIER = true;

/**
 * Coverage P0: plant-based «молоко/йогурт» must not map to dairy 04 / milk pack.
 * Canon: docs/knowledge/plan-hint-coverage-p0.md
 */
const PLANT_DAIRY_RE =
  /соев\w*|овсян\w*|миндальн\w*|кокосов\w*|рисов\w*|орехов\w*|растительн\w*|plant[- ]?based|soy\s*(?:milk|yogurt|yoghurt)|oat\s*(?:milk|yogurt)|almond\s*(?:milk|yogurt)|coconut\s*(?:milk|yogurt)|hazelnut\s*(?:milk|yogurt)|nut\s*milk|rice\s*milk/i;

/** Input device «мышь», not PC — blocks computers pack / laptop attr. */
const POINTER_DEVICE_RE =
  /(?:^|[^a-zа-я0-9])мышь(?:$|[^a-zа-я0-9])|(?:^|[^a-zа-я0-9])mouse(?:$|[^a-zа-я0-9])/i;

/** Juice/soft drink — fruit pack must not win on «яблочный сок» / «лимонад». */
const JUICE_BEVERAGE_RE =
  /(?:^|[^a-zа-я0-9])сок(?:$|[^a-zа-я0-9])|нектар|(?:^|[^a-zа-я0-9])juice(?:$|[^a-zа-я0-9])|smoothie|(?:^|[^a-zа-я0-9])морс(?:$|[^a-zа-я0-9])|лимонад|lemonade|компот/i;

/** Coffee appliance — not tea/coffee chapter 09. */
const COFFEE_MACHINE_RE = /кофемаш|кофеварк|coffee\s*machine|coffee\s*maker|espresso\s*machine/i;

/** Child car seat — not home furniture «кресло». */
const CAR_SEAT_RE = /автокрес|car\s*seat|детск\w*\s+кресл\w*\s+авто/i;

/** Laundry detergent — not washing machine appliance. */
const LAUNDRY_DETERGENT_RE =
  /стиральн\w*\s+порошок|порошок\s+стиральн|стиральный\s+порошок|washing\s+powder|laundry\s+detergent/i;

/** Prepared soup/stew — produce must not win on «овощной суп». */
const PREPARED_MEAL_RE =
  /(?:^|[^a-zа-я0-9])суп(?:$|[^a-zа-я0-9])|борщ|бульон|похлебк|(?:^|[^a-zа-я0-9])soup(?:$|[^a-zа-я0-9])/i;

/** Dairy butter — not plant-oil pantry pack. */
const DAIRY_FAT_RE = /масло\s+сливоч|сливочн\w*\s+масло|(?:^|[^a-zа-я0-9])butter(?:$|[^a-zа-я0-9])/i;

/** Edible plant cooking oil — not dairy milk/butter pack. */
const COOKING_OIL_RE =
  /масло\s+(?:подсол|оливков|растительн|кукуруз|sunflower|olive)|(?:подсол|оливков|растительн|sunflower|olive)\w*\s+масло/i;

/** Fish/seafood context for conserves disambiguation. */
const FISH_SEAFOOD_RE =
  /рыб|лосос|форел|тунец|кревет|кальмар|икр|морепродукт|fish|seafood|salmon|tuna/i;

/** Vegetable/mushroom conserves — not fish pack. */
const VEG_CONSERVE_RE = /консерв|тушенк|marinad/i;
const VEG_CONTEXT_RE = /овощ|огур|томат|помидор|капуст|гриб|фасол|горошек/i;

/** Motor oil / antifreeze — not pantry cooking oil / dairy. */
const MOTOR_OIL_RE =
  /моторн\w*\s+масло|масло\s+моторн|антифриз|engine\s*oil|antifreeze|тормозн\w*\s+колодк|тормозн\w*\s+жидкост|brake\s*pad/i;

/** PC component / storage — not whole computer pack. */
const PC_PARTS_RE =
  /\bssd\b|\bhdd\b|ж[её]стк\w*\s+диск|винчестер|видеокарт|процессор|материнск|оперативн\w*\s+памят|флешк|карта\s+памят|блок\s+питани|graphics\s*card|usb\s*flash|memory\s*card|hard\s*disk|hard\s*drive/i;

/** Photo camera gear — not security CCTV. */
const PHOTO_GEAR_RE =
  /фотоаппарат|фотокамер|объектив|штатив|вспышк|gopro|camera\s*lens|tripod|\bdslr\b/i;

/** Vape / e-cig — not tobacco cigarettes pack. */
const VAPE_DEVICE_RE =
  /вейп|(?:электронн\w*\s+)?сигарет\w*|vape|\bpod\b|испарител/i;

/** Gaming console / controller — not soft toys pack. */
const GAMING_CONSOLE_RE =
  /xbox|геймпад|джойстик|игровая\s+приставк|playstation|nintendo|gamepad|joystick|game\s*console|steam\s*deck/i;

/** Farm animal feed — not pet-food (cats/dogs). */
const AGRI_FEED_RE =
  /комбикорм|(?:^|[^a-zа-я0-9])сено(?:$|[^a-zа-я0-9])|силос|корм\s+скот|корм\s+для\s+скот|animal\s*feed|(?:^|[^a-zа-я0-9])hay(?:$|[^a-zа-я0-9])|silage/i;

/** Wheelchair / rehab mobility — not baby stroller. */
const WHEELCHAIR_RE =
  /инвалидн[а-яa-z]*\s+коляск|wheelchair|костыл/i;

/** Raw fabric/yarn — not finished apparel packs. */
const TEXTILES_RAW_RE =
  /ткань|пряжа|нитки|полотно\s+ткацк|fabric|(?:^|[^a-zа-я0-9])yarn(?:$|[^a-zа-я0-9])|(?:^|[^a-zа-я0-9])thread(?:$|[^a-zа-я0-9])/i;

/** Yoga / exercise mat — not floor rug (570x). */
const YOGA_MAT_RE =
  /йог[аеи]|yoga\s*mat|exercise\s*mat|коврик\s+(?:для\s+)?(?:йог|фитнес|спорт)|(?:йог|фитнес)\w*\s+коврик/i;

/** Finished apparel garment — хлопок as composition must not steal textiles-raw. */
const FINISHED_APPAREL_RE =
  /майк|футболк|худи|свитер|рубашк|брюк|джинс|юбк|куртк|плать|сарафан|носк|колгот|гольф|чулк|пижам|халат|плащ|пальто|пуховик|жилет|кардиган|водолазк/i;

export function isPlantDairyQuery(query: string): boolean {
  return PLANT_DAIRY_RE.test(normalizeTnvedQueryText(query));
}

export function isPointerDeviceQuery(query: string): boolean {
  return POINTER_DEVICE_RE.test(normalizeTnvedQueryText(query));
}

export function isJuiceOrBeverageQuery(query: string): boolean {
  return JUICE_BEVERAGE_RE.test(normalizeTnvedQueryText(query));
}

export function isPreparedMealQuery(query: string): boolean {
  return PREPARED_MEAL_RE.test(normalizeTnvedQueryText(query));
}

export function isCoffeeMachineQuery(query: string): boolean {
  return COFFEE_MACHINE_RE.test(normalizeTnvedQueryText(query));
}

export function isCarSeatQuery(query: string): boolean {
  return CAR_SEAT_RE.test(normalizeTnvedQueryText(query));
}

export function isLaundryDetergentQuery(query: string): boolean {
  return LAUNDRY_DETERGENT_RE.test(normalizeTnvedQueryText(query));
}

export function isDairyFatQuery(query: string): boolean {
  return DAIRY_FAT_RE.test(normalizeTnvedQueryText(query));
}

export function isCookingOilQuery(query: string): boolean {
  return COOKING_OIL_RE.test(normalizeTnvedQueryText(query));
}

export function isFishSeafoodQuery(query: string): boolean {
  return FISH_SEAFOOD_RE.test(normalizeTnvedQueryText(query));
}

export function isVegetableConservesQuery(query: string): boolean {
  const q = normalizeTnvedQueryText(query);
  return VEG_CONSERVE_RE.test(q) && VEG_CONTEXT_RE.test(q);
}

export function isMotorOilQuery(query: string): boolean {
  return MOTOR_OIL_RE.test(normalizeTnvedQueryText(query));
}

export function isPcPartsQuery(query: string): boolean {
  return PC_PARTS_RE.test(normalizeTnvedQueryText(query));
}

export function isPhotoGearQuery(query: string): boolean {
  return PHOTO_GEAR_RE.test(normalizeTnvedQueryText(query));
}

export function isVapeDeviceQuery(query: string): boolean {
  const q = normalizeTnvedQueryText(query);
  // Plain cigarettes/cigars are tobacco, not vape — exclude when no e-cig marker.
  if (/(?:электронн|вейп|vape|\bpod\b|испарител)/i.test(q)) return true;
  return false;
}

export function isGamingConsoleQuery(query: string): boolean {
  return GAMING_CONSOLE_RE.test(normalizeTnvedQueryText(query));
}

export function isAgriFeedQuery(query: string): boolean {
  return AGRI_FEED_RE.test(normalizeTnvedQueryText(query));
}

export function isWheelchairQuery(query: string): boolean {
  return WHEELCHAIR_RE.test(normalizeTnvedQueryText(query));
}

export function isTextilesRawQuery(query: string): boolean {
  return TEXTILES_RAW_RE.test(normalizeTnvedQueryText(query));
}

export function isYogaMatQuery(query: string): boolean {
  return YOGA_MAT_RE.test(normalizeTnvedQueryText(query));
}

export function isFinishedApparelQuery(query: string): boolean {
  return FINISHED_APPAREL_RE.test(normalizeTnvedQueryText(query));
}

/** Works truck / forklift as the product — not «АКБ для погрузчика». */
const FORKLIFT_MACHINE_RE =
  /(?:электро)?погрузчик|штабел[её]р|ричтрак|вилочн\w*\s*погруз|forklift|reach\s*truck|stacker/i;

const TRACTION_BATTERY_PRIMARY_RE =
  /^(?:аккумулятор|акб|батарея|тяговый)|(?:аккумулятор|акб|батарея|тягов\w*\s*аккумулятор)\w*(?:\s+\w+){0,6}\s+(?:для|к)\s+(?:погруз|штабел|ричтрак|forklift)/i;

export function isForkliftMachineQuery(query: string): boolean {
  const q = normalizeTnvedQueryText(query);
  if (!FORKLIFT_MACHINE_RE.test(q)) return false;
  if (TRACTION_BATTERY_PRIMARY_RE.test(q)) return false;
  return true;
}

export function isTractionBatteryQuery(query: string): boolean {
  const q = normalizeTnvedQueryText(query);
  return TRACTION_BATTERY_PRIMARY_RE.test(q) ||
    (/(?:аккумулятор|акб|батарея)/i.test(q) && /тягов/i.test(q));
}

export function normalizeTnvedQueryText(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
}

/** RU household stem expansions — not a full morphological stemmer. */
export function householdStemVariants(token: string): string[] {
  const t = normalizeTnvedQueryText(token);
  if (t.length < 2) return [];
  const out: string[] = [t];

  // огурец → огурц (slice(-1) would wrongly yield «огуре»)
  if (t.endsWith("ец") && t.length >= 5) {
    out.push(`${t.slice(0, -2)}ц`);
  } else if (t.length >= 5) {
    // кепка → кепк; огурцы → огурц; помидоры → помидор
    out.push(t.slice(0, -1));
  }

  // носок → носк
  if (t.endsWith("ок") && t.length >= 5) {
    out.push(`${t.slice(0, -2)}к`);
  }
  // носки already covered by slice(-1) → носк

  if ((t.endsWith("ия") || t.endsWith("ие")) && t.length >= 5) {
    out.push(t.slice(0, -1));
  }

  if (t.length >= 8) {
    out.push(t.slice(0, -2));
  }

  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const v of out) {
    if (v.length < 2 || seen.has(v)) continue;
    seen.add(v);
    uniq.push(v);
  }
  return uniq;
}

export function tnvedQueryTokens(query: string): string[] {
  const q = normalizeTnvedQueryText(query);
  if (!q) return [];
  const words = q
    .replace(/[-_/\\,.;:()[\]{}+]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !TNVED_SEARCH_STOP.has(w));
  if (words.length) return words;
  if (q.length >= 2 && !TNVED_SEARCH_STOP.has(q)) return [q];
  return [];
}

/** Stems for SQL contains + scoring (H1). */
export function tnvedQueryStems(query: string): string[] {
  const tokens = tnvedQueryTokens(query);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    for (const v of householdStemVariants(t)) {
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `stem` appears as a whole token / word-boundary in text. */
export function hasTokenBoundary(text: string, stem: string): boolean {
  const hay = normalizeTnvedQueryText(text);
  const s = normalizeTnvedQueryText(stem);
  if (!hay || !s) return false;
  return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(s)}(?:$|[^a-zа-я0-9])`, "i").test(hay);
}

/** Token boundary or prefix of a token (stem «огурц» ↔ title «Огурцы»). */
export function hasTokenOrPrefix(text: string, stem: string): boolean {
  const hay = normalizeTnvedQueryText(text);
  const s = normalizeTnvedQueryText(stem);
  if (!hay || !s) return false;
  if (hasTokenBoundary(hay, s)) return true;
  return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(s)}[a-zа-я0-9]*`, "i").test(hay);
}

export function isFalseFriendPair(query: string, hitText: string): boolean {
  const q = normalizeTnvedQueryText(query);
  const hit = normalizeTnvedQueryText(hitText);
  if (!q || !hit) return false;
  for (const { query: qq, block } of TNVED_FALSE_FRIEND_PAIRS) {
    // Query must look like the short produce family — not «йогурт» itself containing «огур».
    const queryIsFamily =
      hasTokenOrPrefix(q, qq) || q.includes("огурец") || q.includes("огурц") || q === qq;
    if (!queryIsFamily) continue;
    if (!hit.includes(block)) continue;
    if (!hasTokenOrPrefix(hit, qq) && !hit.includes("огурец") && !hit.includes("огурц")) {
      return true;
    }
  }
  return false;
}

/** True when a short pack stem should be ignored because the query is a known hitchhike. */
export function isShortTriggerFalseFriend(stem: string, desc: string): boolean {
  const s = normalizeTnvedQueryText(stem);
  const q = normalizeTnvedQueryText(desc);
  if (!s || !q) return false;
  for (const { stem: st, block } of SHORT_TRIGGER_FALSE_FRIENDS) {
    if (s !== st) continue;
    if (q.includes(block) || hasTokenOrPrefix(q, block)) return true;
  }
  return false;
}

/**
 * P7 pack-trigger match policy:
 * - multi-word keys → substring (order as authored, e.g. «перец слад»)
 * - len ≤ 3 → exact token boundary only («лук», «чай»; no «луковица» via bare лук — use «луков»)
 * - len === 4 → token or prefix, minus SHORT_TRIGGER_FALSE_FRIENDS («поло»≠«полотенце»)
 * - len ≥ 5 → substring (existing C21 stems: огурц, помидор, …)
 */
export function packTriggerMatches(desc: string, raw: string): boolean {
  const q = normalizeTnvedQueryText(desc);
  const p = normalizeTnvedQueryText(raw).trim();
  if (!q || !p) return false;
  if (/\s/.test(p)) return q.includes(p);
  if (p.length <= 3) return hasTokenBoundary(q, p);
  if (p.length === 4) {
    if (isShortTriggerFalseFriend(p, q)) return false;
    return hasTokenBoundary(q, p) || hasTokenOrPrefix(q, p);
  }
  return q.includes(p);
}

/**
 * Notes match quality for one stem.
 * Short stems (<5): substring-only hit does not count (false-friend class).
 */
export function notesStemMatchKind(
  notes: string,
  stem: string
): "token" | "substring" | null {
  const n = normalizeTnvedQueryText(notes);
  const s = normalizeTnvedQueryText(stem);
  if (!n || !s) return null;
  const noteParts = n.split(/[,\n;]+/).map((p) => p.trim()).filter(Boolean);
  if (
    noteParts.some(
      (p) => p === s || p.startsWith(`${s} `) || p.startsWith(`${s},`) || hasTokenOrPrefix(p, s)
    ) ||
    hasTokenOrPrefix(n, s)
  ) {
    return "token";
  }
  if (n.includes(s)) {
    if (s.length < 5) return null;
    return "substring";
  }
  return null;
}

/**
 * Concrete 10-digit leaves that receive search-alias synonyms in `TnvedCode.notes`
 * (`tnved:load -- --search-extras`). Not blockHit / ranking policy — only recall tokens.
 * Prefer one primary leaf under the alias codePrefix (lab classifier).
 */
export const TNVED_SEARCH_ALIAS_DB_LEAVES: Readonly<
  Record<string, readonly string[]>
> = {
  "mors-drink": ["2202100000", "2202991100"],
  "hdd-ssd": ["8471705000", "8471702000", "8471707000"],
  laptop: ["8471300000"],
  lemonade: ["2202100000"],
  cola: ["2202100000", "2202991100"],
  "orange-juice": ["2009111900", "2009119900"],
  "mineral-water": ["2201101100", "2201101900"],
  "laundry-powder": ["3402909000", "3402901000"],
  "raw-rice": ["1006306700", "1006309800"],
  sausage: ["1601009100", "1601009900"],
  chips: ["1905905500", "1905906000"],
  waffles: ["1905321100", "1905329900"],
  cake: ["1905903000", "1905906000"],
  pizza: ["1905903000", "1905905500"],
  "chicken-soup": ["2104100000"],
  "ice-cream": ["2105001000", "2105009100"],
  glue: ["3506100000", "3506910000"],
  "coffee-machine": ["8516710000"],
  kettle: ["8516797000"],
  mattress: ["9404100000", "9404291000"],
  "car-seat": ["9401200000", "9401800000"],
  camera: ["9006538000", "9006400000"],
  wheelchair: ["8713100000", "8713900000"],
  stroller: ["8715001000"],
  pen: ["9608101000", "9608109900"],
  "ring-jewelry": ["7113190000", "7113110000"],
  cigarettes: ["2402209000", "2402201000"],
  "agri-feed": ["2309903100", "2309902000"],
  playstation: ["9504500000", "9504301000"],
  "car-bumper": ["8708299000", "8708109000"],
  "hdmi-cable": ["8544429000", "8544499100"],
  "chicken-meat": ["0207119000", "0207129000"],
  belt: ["4203300000", "4203400000"],
  keds: ["6404110000", "6404199000"],
  milk: ["0401101000", "0401201100"],
  fabric: ["5208119000", "5208121900"],
  gloves: ["6116108000", "6116910000"],
  mittens: ["6116910000", "6116108000"],
  tie: ["6215100000", "6215200000"],
  pajama: ["6107210000", "6107910000"],
  robe: ["6107910000", "6107210000"],
};

/** Extra full-word keys beyond expandStems (abbr / EN / бытовые формы). */
const SEARCH_ALIAS_EXTRA_NOTE_KEYS: Readonly<Record<string, readonly string[]>> = {
  "mors-drink": ["морс", "морсы", "ягодный морс"],
  "hdd-ssd": ["hdd", "ssd", "жесткий диск", "винчестер", "твердотельный накопитель", "hard disk"],
  laptop: ["ноутбук", "laptop", "notebook", "macbook"],
  lemonade: ["лимонад", "lemonade", "газировка"],
  cola: ["кола", "coca-cola", "coca cola"],
  "orange-juice": ["сок апельсиновый", "апельсиновый сок", "orange juice"],
  "mineral-water": ["минеральная вода", "вода минеральная", "mineral water"],
  "laundry-powder": ["стиральный порошок", "порошок стиральный", "laundry detergent"],
  "raw-rice": ["рис", "рис белый", "rice"],
  sausage: ["колбаса", "колбасы", "сосиски", "sausage"],
  chips: ["чипсы", "чипсы картофельные", "potato chips"],
  waffles: ["вафли", "waffle", "waffles"],
  cake: ["торт", "торты", "cake"],
  pizza: ["пицца", "пиццы", "pizza"],
  "chicken-soup": ["суп куриный", "куриный суп", "chicken soup", "бульон"],
  "ice-cream": ["мороженое", "ice cream"],
  glue: ["клей", "клей канцелярский", "glue"],
  "coffee-machine": ["кофемашина", "кофеварка", "coffee machine", "coffee maker"],
  kettle: ["чайник", "чайник электрический", "electric kettle"],
  mattress: ["матрас", "матрац", "mattress"],
  "car-seat": ["автокресло", "детское автокресло", "car seat"],
  camera: ["фотоаппарат", "фотокамера", "digital camera"],
  wheelchair: ["инвалидная коляска", "wheelchair"],
  stroller: ["коляска детская", "детская коляска", "stroller"],
  pen: ["ручка", "ручка шариковая", "ballpoint pen"],
  "ring-jewelry": ["кольцо", "кольцо золотое", "gold ring"],
  cigarettes: ["сигареты", "сигарета", "cigarettes"],
  "agri-feed": ["комбикорм", "корм для скота", "animal feed"],
  playstation: ["playstation", "игровая приставка", "play station"],
  "car-bumper": ["бампер", "бампер авто", "car bumper"],
  "hdmi-cable": ["hdmi", "кабель hdmi", "hdmi кабель"],
  "chicken-meat": ["курица", "мясо курицы", "chicken"],
  belt: ["ремень", "ремни", "leather belt"],
  keds: ["кеды", "кед", "sneakers"],
  milk: ["молоко", "питьевое молоко", "milk"],
  fabric: ["ткань", "ткань хлопковая", "fabric"],
  gloves: ["перчатки", "gloves"],
  mittens: ["варежки", "mittens"],
  tie: ["галстук", "necktie", "tie"],
  pajama: ["пижама", "pajamas", "pyjama"],
  robe: ["халат", "bathrobe"],
};

function uniqTokens(parts: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const t = String(raw || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Synonyms for `tnved:load -- --search-extras` (no blockHit). */
export function searchAliasesAsSearchExtras(): Map<
  string,
  { why: string[]; tokens: string[] }
> {
  const out = new Map<string, { why: string[]; tokens: string[] }>();
  for (const alias of TNVED_SEARCH_ALIASES) {
    const leaves = TNVED_SEARCH_ALIAS_DB_LEAVES[alias.id];
    if (!leaves?.length) continue;
    const tokens = uniqTokens([
      ...(alias.expandStems || []),
      ...(SEARCH_ALIAS_EXTRA_NOTE_KEYS[alias.id] || []),
    ]);
    if (!tokens.length) continue;
    const why = `Бытовой синоним поиска (${alias.id}) → префикс ${alias.codePrefix}`;
    for (const code of leaves) {
      const digits = String(code || "").replace(/\D/g, "");
      if (![4, 6, 8, 10].includes(digits.length)) continue;
      const row = out.get(digits) || { why: [], tokens: [] };
      if (!row.why.includes(why)) row.why.push(why);
      row.tokens.push(...tokens);
      out.set(digits, row);
    }
  }
  for (const [code, row] of out) {
    out.set(code, { why: row.why, tokens: uniqTokens(row.tokens) });
  }
  return out;
}

export function searchAliasFocusCodes(): string[] {
  const codes = new Set<string>();
  for (const leaves of Object.values(TNVED_SEARCH_ALIAS_DB_LEAVES)) {
    for (const c of leaves) {
      const digits = String(c || "").replace(/\D/g, "");
      if ([4, 6, 8, 10].includes(digits.length)) codes.add(digits);
    }
  }
  return [...codes];
}
