/** HS helpers — keep in sync with src/lib/ved/tnved.ts + tnved-query-match.ts */

export function normalizeHsCode(input) {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (![2, 4, 6, 8, 10].includes(digits.length)) return null;
  return digits;
}

export function formatHsCode(code) {
  const digits = normalizeHsCode(code);
  if (!digits) return null;
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  const parts = [];
  for (let i = 0; i < digits.length; i += 2) {
    parts.push(digits.slice(i, i + 2));
  }
  return parts.join(" ");
}

const TNVED_SEARCH_STOP = new Set(["для", "или", "без", "the", "and", "for", "with", "from"]);
const TNVED_FALSE_FRIEND_PAIRS = [
  { query: "огур", block: "йогурт" },
  { query: "огур", block: "yogurt" },
  { query: "огур", block: "yoghurt" },
  { query: "огур", block: "кефир" },
];

/** Keep in sync with src/lib/ved/tnved-query-match.ts TNVED_SEARCH_ALIASES */
const PLANT_DAIRY_RE =
  /соев\w*|овсян\w*|миндальн\w*|кокосов\w*|рисов\w*|орехов\w*|растительн\w*|plant[- ]?based|soy\s*(?:milk|yogurt|yoghurt)|oat\s*(?:milk|yogurt)|almond\s*(?:milk|yogurt)|coconut\s*(?:milk|yogurt)|hazelnut\s*(?:milk|yogurt)|nut\s*milk|rice\s*milk/i;

const TNVED_SEARCH_ALIASES = [
  {
    id: "mors-drink",
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
    expandStems: ["ноутбук", "laptop", "notebook", "портативн"],
  },
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
    test: /стиральн[a-zа-яё]*\s+порошок|порошок\s+стиральн|washing\s+powder|laundry\s+detergent/iu,
    codePrefix: "3402",
    expandStems: ["стиральн", "порошок", "моющ"],
    blockHit: /драгоцен|платин|серебр|золот|металлич/i,
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
    expandStems: ["морожен"],
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
    expandStems: ["кольц", "ювелир"],
  },
  {
    id: "cigarettes",
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

export function resolveTnvedSearchAlias(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  const hit = TNVED_SEARCH_ALIASES.find((a) => a.test.test(q)) || null;
  if (hit?.id === "milk" && PLANT_DAIRY_RE.test(normalizeTnvedQueryText(q))) return null;
  if (hit?.id === "cigarettes" && /электронн|вейп|\bvape\b|vapor/i.test(q)) return null;
  return hit;
}

function normalizeTnvedQueryText(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function householdStemVariants(token) {
  const t = normalizeTnvedQueryText(token);
  if (t.length < 2) return [];
  const out = [t];
  if (t.endsWith("ец") && t.length >= 5) {
    out.push(`${t.slice(0, -2)}ц`);
  } else if (t.length >= 5) {
    out.push(t.slice(0, -1));
  }
  if (t.endsWith("ок") && t.length >= 5) {
    out.push(`${t.slice(0, -2)}к`);
  }
  if ((t.endsWith("ия") || t.endsWith("ие")) && t.length >= 5) {
    out.push(t.slice(0, -1));
  }
  if (t.length >= 8) out.push(t.slice(0, -2));
  const seen = new Set();
  const uniq = [];
  for (const v of out) {
    if (v.length < 2 || seen.has(v)) continue;
    seen.add(v);
    uniq.push(v);
  }
  return uniq;
}

export function tnvedSearchStems(query) {
  const q = normalizeTnvedQueryText(query);
  if (!q) return [];
  const words = q
    .replace(/[-_/\\,.;:()[\]{}+]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !TNVED_SEARCH_STOP.has(w));
  const tokens = words.length ? words : q.length >= 2 && !TNVED_SEARCH_STOP.has(q) ? [q] : [];
  const out = [];
  const seen = new Set();
  for (const t of tokens) {
    for (const v of householdStemVariants(t)) {
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function hasTokenBoundary(text, stem) {
  const hay = normalizeTnvedQueryText(text);
  const s = normalizeTnvedQueryText(stem);
  if (!hay || !s) return false;
  return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(s)}(?:$|[^a-zа-я0-9])`, "i").test(hay);
}

function hasTokenOrPrefix(text, stem) {
  const hay = normalizeTnvedQueryText(text);
  const s = normalizeTnvedQueryText(stem);
  if (!hay || !s) return false;
  if (hasTokenBoundary(hay, s)) return true;
  return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(s)}[a-zа-я0-9]*`, "i").test(hay);
}

function isFalseFriendPair(query, hitText) {
  const q = normalizeTnvedQueryText(query);
  const hit = normalizeTnvedQueryText(hitText);
  if (!q || !hit) return false;
  for (const { query: qq, block } of TNVED_FALSE_FRIEND_PAIRS) {
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

function notesStemMatchKind(notes, stem) {
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

export function scoreTnvedSearchHit(row, { stems, digits, phrase }) {
  const notes = String(row.notes || "")
    .toLowerCase()
    .replace(/ё/g, "е");
  const title = String(row.titleRu || "")
    .toLowerCase()
    .replace(/ё/g, "е");
  const hitText = `${notes}\n${title}`;
  const lead = notes.split(/\n+/)[0] || "";
  const full = String(phrase || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
  const queryForFriends = full || (stems || []).join(" ");
  const alias = resolveTnvedSearchAlias(phrase || queryForFriends);
  const aliasBlocked = Boolean(alias?.blockHit?.test(hitText));

  if (isFalseFriendPair(queryForFriends, hitText) || aliasBlocked) {
    let score = 0;
    if (digits && digits.length >= 2 && String(row.code || "").startsWith(digits)) {
      score += 100;
      if (row.code === digits) score += 50;
    }
    if (alias && String(row.code || "").startsWith(alias.codePrefix)) score += 120;
    if (row.isLeaf) score += 15;
    score += Number(row.level || 0);
    return score;
  }

  let score = 0;
  if (/[.!?]/.test(lead) && lead.length >= 24) score += 8;
  if (full.length >= 5 && notes.includes(full) && hasTokenOrPrefix(notes, full)) {
    score += 35;
  } else if (full.length >= 2 && full.length < 5 && /[\u4e00-\u9fff]/.test(full) && notes.includes(full)) {
    score += 35;
  }
  for (const s of stems || []) {
    if (!s) continue;
    if (s.length <= 4 ? hasTokenBoundary(title, s) : hasTokenOrPrefix(title, s)) score += 55;
    if (s.length <= 4 ? hasTokenBoundary(notes, s) : notesStemMatchKind(notes, s) === "token") {
      score += 18;
    }
  }
  if (digits && digits.length >= 2 && String(row.code || "").startsWith(digits)) {
    score += 100;
    if (row.code === digits) score += 50;
  }
  if (alias && String(row.code || "").startsWith(alias.codePrefix)) score += 120;
  if (row.isLeaf) score += 15;
  score += Number(row.level || 0);
  return score;
}

export function tnvedSearchRowHasWholeWordHit(row, { stems, digits, phrase, aliasPrefix }) {
  if (digits && digits.length >= 2 && String(row.code || "").startsWith(digits)) return true;
  if (aliasPrefix && String(row.code || "").startsWith(aliasPrefix)) return true;
  const title = String(row.titleRu || "");
  const notes = String(row.notes || "");
  const full = String(phrase || "").trim();
  if (full.length >= 2 && /[\u4e00-\u9fff]/.test(full) && notes.toLowerCase().includes(full.toLowerCase())) {
    return true;
  }
  if (full.length >= 4) {
    if (hasTokenOrPrefix(title, full) || hasTokenOrPrefix(notes, full)) return true;
  }
  for (const s of stems || []) {
    if (!s) continue;
    if (s.length <= 4 ? hasTokenBoundary(title, s) : hasTokenOrPrefix(title, s)) return true;
    if (s.length <= 4 ? hasTokenBoundary(notes, s) : notesStemMatchKind(notes, s) === "token") {
      return true;
    }
  }
  return false;
}

export function tnvedSearchWhere(q, { leafOnly = false, headingOnly = false } = {}) {
  const digits = String(q || "").replace(/\D/g, "");
  const codeOnly = digits.length >= 2 && /^[\d\s./-]+$/.test(String(q || "").trim());
  if (headingOnly && digits.length >= 2) {
    return {
      isActive: true,
      level: 4,
      code: { startsWith: digits.slice(0, 2) },
    };
  }
  const stemsRaw = codeOnly ? [digits] : tnvedSearchStems(q);
  const alias = codeOnly ? null : resolveTnvedSearchAlias(q);
  const stems = [...stemsRaw];
  if (alias?.expandStems) {
    for (const s of alias.expandStems) {
      if (s && !stems.includes(s)) stems.push(s);
    }
  }
  const or = [];
  if (digits.length >= 2) or.push({ code: { startsWith: digits } });
  if (alias?.codePrefix) or.push({ code: { startsWith: alias.codePrefix } });
  for (const stem of stems.length ? stems : [q]) {
    or.push({ titleRu: { contains: stem, mode: "insensitive" } });
    or.push({ notes: { contains: stem, mode: "insensitive" } });
  }
  if (!codeOnly && String(q || "").trim().length >= 4) {
    or.push({ notes: { contains: q, mode: "insensitive" } });
    or.push({ titleRu: { contains: q, mode: "insensitive" } });
  }
  return {
    isActive: true,
    OR: or,
    ...(leafOnly ? { isLeaf: true } : {}),
  };
}

/** Stems used for ranking — same expand as tnvedSearchWhere. */
export function tnvedSearchStemsForRank(q) {
  const digits = String(q || "").replace(/\D/g, "");
  const codeOnly = digits.length >= 2 && /^[\d\s./-]+$/.test(String(q || "").trim());
  if (codeOnly) return [digits];
  const stems = [...tnvedSearchStems(q)];
  const alias = resolveTnvedSearchAlias(q);
  if (alias?.expandStems) {
    for (const s of alias.expandStems) {
      if (s && !stems.includes(s)) stems.push(s);
    }
  }
  return stems;
}
