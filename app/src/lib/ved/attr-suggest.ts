/**
 * Fill-stage product attr suggestions (D32 chips, not a wizard).
 * Heuristic always; optional classify overlay for hsHint is fail-open at the API layer.
 */
import { z } from "zod";
import { fillEmptyProductAttrs, type ProductAttrs } from "./product-description";

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

const RULES: CatalogRule[] = [
  {
    id: "socks",
    test: /носк|гольф|чулк|подслед|socks?|hosiery/i,
    attrs: {
      material: "трикотаж",
      composition: "хлопок (уточните %)",
      purpose: "чулочно-носочные изделия",
      extra: {
        garmentType: "носки",
        ageGroup: "уточните: взрослый / детский",
        color: "уточните цвет",
      },
      hsHint: "6115 95 000 0",
    },
    notes: ["Для носков важны состав волокон, трикотаж и возраст."],
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
    id: "apparel",
    test: /одежд|куртк|брюк|плать|джинс|текстил|хлопок|cotton|apparel/i,
    attrs: {
      material: "текстиль",
      composition: "уточните волокна и %",
      purpose: "предмет одежды",
      extra: {
        garmentType: "одежда",
        ageGroup: "уточните: взрослый / детский",
        color: "уточните цвет",
      },
      hsHint: "6203 42 310 0",
    },
    notes: ["Глава 61/62 зависит от трикотажа vs ткани."],
  },
  {
    id: "laptop",
    test: /ноутбук|laptop|notebook|macbook|компьютер/i,
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
];

function blob(input: AttrSuggestInput): string {
  return `${input.name || ""} ${input.title || ""} ${input.description || ""}`.trim();
}

export function heuristicAttrSuggest(input: AttrSuggestInput): AttrSuggestResult {
  const text = blob(input);
  if (text.length < 3) {
    return { engine: "heuristic-v1", attrs: {}, notes: [] };
  }
  const rule = RULES.find((r) => r.test.test(text));
  if (!rule) {
    return {
      engine: "heuristic-v1",
      attrs: { purpose: "уточните назначение товара" },
      notes: ["Добавьте состав, материал или тип — так точнее черновик ТН ВЭД."],
    };
  }
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
