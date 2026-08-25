/** Mirror of src/lib/ved/attr-suggest.ts — fill-stage chips, heuristic only. */

const RULES = [
  {
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
    test: /одежд|куртк|брюк|плать|джинс|текстил|хлопок|cotton|apparel/i,
    attrs: {
      material: "текстиль",
      composition: "уточните волокна и %",
      purpose: "предмет одежды",
      extra: { garmentType: "одежда", ageGroup: "уточните: взрослый / детский", color: "уточните цвет" },
      hsHint: "6203 42 310 0",
    },
    notes: ["Глава 61/62 зависит от трикотажа vs ткани."],
  },
  {
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
    test: /телефон|смартфон|iphone|android|mobile phone/i,
    attrs: {
      purpose: "аппарат связи",
      extra: { deviceType: "смартфон" },
      hsHint: "8517 13 000 0",
    },
    notes: ["Укажите бренд и модель, если есть."],
  },
];

function isEmpty(v) {
  return v === undefined || v === null || (typeof v === "string" && !v.trim());
}

export function suggestProductAttrs(body = {}) {
  const text = `${body.name || ""} ${body.title || ""} ${body.description || ""}`.trim();
  if (text.length < 3) return { engine: "heuristic-v1", attrs: {}, notes: [] };
  const existing = body.existing && typeof body.existing === "object" ? body.existing : {};
  const rule = RULES.find((r) => r.test.test(text));
  if (!rule) {
    return {
      engine: "heuristic-v1",
      attrs: existing.purpose ? {} : { purpose: "уточните назначение товара" },
      notes: ["Добавьте состав, материал или тип — так точнее черновик ТН ВЭД."],
    };
  }
  const attrs = {};
  for (const key of ["material", "composition", "purpose", "hsHint"]) {
    if (isEmpty(existing[key]) && rule.attrs[key]) attrs[key] = rule.attrs[key];
  }
  const extra = {};
  for (const [k, v] of Object.entries(rule.attrs.extra || {})) {
    if (isEmpty(existing.extra?.[k]) && v) extra[k] = v;
  }
  if (Object.keys(extra).length) attrs.extra = extra;
  return { engine: "heuristic-v1", attrs, notes: rule.notes };
}
