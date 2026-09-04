/**
 * Fill-stage product attr suggestions (D32 chips, not a wizard).
 * Heuristic always; optional classify overlay for hsHint is fail-open at the API layer.
 */
import { z } from "zod";
import { fillEmptyProductAttrs, type ProductAttrs } from "./product-description";
import { isPlantDairyQuery, isPointerDeviceQuery, isForkliftMachineQuery } from "./tnved-query-match";
import { hintTreeQuestions, matchHintPack } from "./tnved-hint-trees";

export const attrSuggestInputSchema = z.object({
  title: z.string().trim().max(300).optional(),
  description: z.string().trim().max(5000).optional(),
  name: z.string().trim().max(300).optional(),
  country: z.string().trim().max(80).optional(),
  existing: z.record(z.unknown()).optional(),
});

export type AttrSuggestInput = z.infer<typeof attrSuggestInputSchema>;

export type AttrSuggestResult = {
  engine: "heuristic-v1" | "mixed";
  attrs: ProductAttrs;
  notes: string[];
};

type CatalogRule = {
  id: string;
  test: RegExp;
  attrs: ProductAttrs;
  notes: string[];
};

/**
 * Catalog RULES fill rich chips when no C21 pack should own the fork.
 * F5 apparel residuals (hosiery / outerwear / dresses / gloves-scarves / tie-belt /
 * underwear-sleep / suits) intentionally have no RULE — pack bridge → clarify-only.
 */
const RULES: CatalogRule[] = [
  {
    id: "footwear",
    test: /кроссов|кед[аы]?|sneakers?|обув|ботин|туфл|running shoes/i,
    attrs: {
      material: "текстиль / резина (уточните верх и подошву)",
      composition: "верх: текстиль; подошва: резина/пластмасса",
      purpose: "обувь",
      extra: { footwearType: "спортивная / повседневная (уточните)" },
      hsHint: "6404 11 000 0",
    },
    notes: ["Для обуви важны материал верха и подошвы — не путать с одеждой гл. 61/62."],
  },
  {
    id: "cap",
    test: /кепк|бейсболк|фуражк|baseball\s*cap|棒球帽/i,
    attrs: {
      material: "текстиль",
      composition: "уточните ткань / трикотаж",
      purpose: "головной убор с козырьком",
      extra: { garmentType: "кепка / бейсболка" },
      hsHint: "6505 00 300 0",
    },
    notes: ["Кепка / фуражка с козырьком → 6505 00 30."],
  },
  {
    id: "hat",
    test: /шапк|берет|панам|beanie|головн\s*убор/i,
    attrs: {
      material: "текстиль",
      composition: "уточните ткань / трикотаж",
      purpose: "головной убор",
      extra: { garmentType: "шапка" },
      hsHint: "6505 00 900 0",
    },
    notes: ["Шапка без козырька → 6505 00 90; кепка — соседняя подпозиция."],
  },
  {
    id: "milk",
    test: /молок|сливк|сгущен|сгущён|кефир|йогурт|yogurt|milk\b|奶粉|纯牛奶/i,
    attrs: {
      purpose: "молочный продукт",
      composition: "уточните: питьевое / сухое / сгущённое / кисломолочное",
      extra: { foodKind: "молоко" },
      hsHint: "0401",
    },
    notes: ["Питьевое молоко 0401; сухое 0402 10; сгущёнка 0402 99; йогурт/кефир 0403."],
  },
  {
    /**
     * P4 clarify-only: do not leave silent generic purpose on «огурец».
     * Form (свежий / рассол / консервы) → C21 produce-fresh chips on NewCalc.
     */
    id: "produce",
    test: /огурец|огурц|помидор|томат|картофел|картошк|морков|капуст|баклажан|кабачок|тыква|свекл|корнишон|cucumber|tomato|potato|carrot|gherkin|pickle|黄瓜|番茄|土豆/i,
    attrs: {
      purpose: "овощи / fresh produce",
      composition: "уточните вид: свежие / временно консервированные / готовые консервы",
      extra: { foodKind: "овощи", clarifyPack: "produce-fresh" },
      hsHint: "0707",
    },
    notes: [
      "clarify-only: на /cabinet/new выберите форму (свежий 0707 / рассол 0711 / маринад·консервы 2001).",
      "Не одежда (61) и не молочка (04) — pack produce-fresh.",
    ],
  },
  {
    id: "tee",
    test: /майк|футболк|t-?shirt|tee\b|поло\b/i,
    attrs: {
      material: "трикотаж",
      composition: "хлопок (уточните %)",
      purpose: "предмет одежды, верх",
      extra: {
        garmentType: "майка / футболка",
        ageGroup: "взрослый (уточните, если детский)",
        color: "уточните цвет",
      },
      hsHint: "6109 10 000 0",
    },
    notes: ["Для ТН ВЭД важны состав, трикотаж/ткань, возраст и пол."],
  },
  {
    id: "jeans",
    test: /джинс|брюк/i,
    attrs: {
      material: "текстиль",
      composition: "уточните волокна и % (часто хлопок)",
      purpose: "предмет одежды",
      extra: { garmentType: "брюки / джинсы" },
      hsHint: "6203 42 310 0",
    },
    notes: ["Брюки/джинсы тканые — типично 6203; трикотаж — глава 61."],
  },
  {
    // Generic apparel without a fake jeans hsHint (coverage P0).
    id: "apparel",
    test: /одежд|cotton|apparel/i,
    attrs: {
      material: "текстиль",
      composition: "уточните волокна и %",
      purpose: "предмет одежды",
      extra: {
        garmentType: "одежда",
        ageGroup: "уточните: взрослый / детский",
        color: "уточните цвет",
      },
    },
    notes: ["Глава 61/62 зависит от трикотажа vs ткани — уточните тип изделия."],
  },
  {
    id: "laptop",
    // «компьютер» as whole token only — not «компьютерная мышь».
    test: /ноутбук|laptop|notebook|macbook|(?:^|[^a-zа-я0-9])компьютер(?:$|[^а-яa-z0-9])/i,
    attrs: {
      purpose: "портативная вычислительная машина",
      material: "пластик / металл",
      extra: { deviceType: "ноутбук" },
      hsHint: "8471 30 000 0",
    },
    notes: ["Для электроники важны назначение и бренд/модель."],
  },
  {
    id: "phone",
    test: /телефон|смартфон|iphone|android|mobile phone/i,
    attrs: {
      purpose: "аппарат связи",
      extra: { deviceType: "смартфон" },
      hsHint: "8517 13 000 0",
    },
    notes: ["Укажите бренд и модель, если есть."],
  },
  {
    id: "forklift",
    test: /(?:электро)?погрузчик|штабел[её]р|ричтрак|forklift|reach\s*truck|stacker/i,
    attrs: {
      material: "сталь / металлоконструкция",
      composition: "уточните АКБ (Li-ion / Pb) или ДВС — встроенный источник не меняет код машины",
      purpose: "складской погрузчик / тележка с подъёмом",
      hsHint: "8427 10 100 0",
      extra: { powerSource: "electric | ICE (уточните)", vehicleKind: "forklift" },
    },
    notes: [
      "Погрузчики — 8427; возможен утильсбор (ПП 81).",
      "Отдельный тяговый АКБ — 8507 (экосбор РОП), не код машины.",
    ],
  },
  {
    id: "traction-battery",
    test: /(?:тягов[а-яa-z]*\s*аккумулятор)|(?:аккумулятор|акб|батарея).{0,40}(?:для|к)\s*(?:погруз|штабел|ричтрак|forklift)|(?:li-?ion|литий[-\s]?ион).{0,24}(?:аккумулятор|акб|батарея)|(?:аккумулятор|акб|батарея).{0,24}(?:li-?ion|литий[-\s]?ион|lifepo4)/i,
    attrs: {
      material: "элементы / корпус",
      composition: "литий-ион / Pb / NiMH (уточните химию)",
      purpose: "тяговый / сменный аккумулятор",
      hsHint: "8507 60 000 0",
      extra: { powerSource: "battery-pack", vehicleKind: "battery-only" },
    },
    notes: [
      "Отдельные АКБ — 8507; экосбор РОП, не утильсбор ТС.",
      "Погрузчик в сборе — 8427.",
    ],
  },
];

function blob(input: AttrSuggestInput): string {
  return `${input.name || ""} ${input.title || ""} ${input.description || ""}`.trim();
}

/** Bare ambiguous tokens — stay generic (no C21 pack bridge). */
const BARE_AMBIGUOUS_RE =
  /^(?:провод|камера|фильтр|свеча|перец)$/i;

function clarifyOnlyFromHintPack(text: string): AttrSuggestResult | null {
  if (BARE_AMBIGUOUS_RE.test(text.trim())) return null;
  const pack = matchHintPack(text);
  if (!pack) return null;
  const questions = hintTreeQuestions(text);
  const opts = questions[0]?.options || [];
  const lower = text.toLowerCase();
  let best = opts[0];
  let bestScore = -1;
  for (const o of opts) {
    let score = 0;
    for (const t of o.triggers || []) {
      if (t && lower.includes(t.toLowerCase())) score += Math.min(t.length, 12);
    }
    if (o.value && lower.includes(String(o.value).toLowerCase())) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  const heading = best?.hsHeading;
  return {
    engine: "heuristic-v1",
    attrs: {
      purpose: "уточните тип товара — см. подсказки семейства",
      extra: { clarifyPack: pack.id },
      ...(heading ? { hsHint: heading } : {}),
    },
    notes: [
      `clarify-only: на /cabinet/new выберите вариант pack «${pack.id}».`,
      "Не silent generic при наличии C21 hint-tree.",
    ],
  };
}

function applyRule(rule: CatalogRule, input: AttrSuggestInput): AttrSuggestResult {
  const existing = (input.existing || {}) as ProductAttrs;
  const merged = fillEmptyProductAttrs(existing, rule.attrs) || {};
  const next: ProductAttrs = {};
  for (const key of ["material", "composition", "purpose", "hsHint"] as const) {
    if (!existing[key] && merged[key]) next[key] = merged[key];
  }
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged.extra || {})) {
    if (!existing.extra?.[k] && v) extra[k] = v;
  }
  if (Object.keys(extra).length) next.extra = extra;
  return { engine: "heuristic-v1", attrs: next, notes: rule.notes };
}

export function heuristicAttrSuggest(input: AttrSuggestInput): AttrSuggestResult {
  const text = blob(input);
  if (text.length < 3) {
    return { engine: "heuristic-v1", attrs: {}, notes: [] };
  }
  const plantDairy = isPlantDairyQuery(text);
  const pointer = isPointerDeviceQuery(text);
  const rule = RULES.find((r) => {
    if (!r.test.test(text)) return false;
    if (plantDairy && r.id === "milk") return false;
    if (pointer && r.id === "laptop") return false;
    // Clar-DB: machine vs «АКБ для погрузчика» (substring «погрузчик» in both).
    if (r.id === "forklift" && !isForkliftMachineQuery(text)) return false;
    if (r.id === "traction-battery" && isForkliftMachineQuery(text)) return false;
    return true;
  });
  if (rule) return applyRule(rule, input);
  // F5 / P4: when no rich RULE, C21 pack → clarify-only chips (NewCalc tree is SoT).
  const fromPack = clarifyOnlyFromHintPack(text);
  if (fromPack) return fromPack;
  return {
    engine: "heuristic-v1",
    attrs: { purpose: "уточните назначение товара" },
    notes: ["Добавьте состав, материал или тип — так точнее черновик ТН ВЭД."],
  };
}

export function suggestProductAttrs(input: AttrSuggestInput): AttrSuggestResult {
  const parsed = attrSuggestInputSchema.parse(input);
  return heuristicAttrSuggest(parsed);
}

export function attrSuggestHasChips(result: AttrSuggestResult): boolean {
  const a = result.attrs;
  return Boolean(
    a.material ||
      a.composition ||
      a.purpose ||
      a.hsHint ||
      (a.extra && Object.keys(a.extra).length)
  );
}

/** P4: produce (and similar) — chips exist but form fork is C21 clarify, not silent generic. */
export function attrSuggestIsClarifyOnly(result: AttrSuggestResult): boolean {
  if (result.attrs.extra?.clarifyPack) return true;
  return result.notes.some((n) => /clarify-only/i.test(n));
}
