import type { CategoryId, ClarificationQuestion, ClarifyOption, HeuristicClarifyInput } from "./types";
import {
  ACCESSORY_MATERIAL,
  APPLIANCE_CONDITION,
  APPLIANCE_POWER,
  APPAREL_GARMENT,
  APPAREL_GENDER,
  AUTO_PART_TYPE,
  BABY_AGE,
  BABY_KIND,
  BAG_KIND,
  BAG_MATERIAL,
  CODE_SCOPE,
  COLOR,
  COMPOSITION,
  CONDITION,
  COSMETIC_FORM,
  COSMETIC_KIND,
  COSMETIC_VOLUME,
  ELECTRONICS_DEVICE,
  ELECTRONICS_SPECS,
  FOOD_CERT,
  FOOD_KIND,
  FOOD_ORIGIN,
  FOOD_PACKAGING,
  FOOTWEAR_PURPOSE,
  FOOTWEAR_SOLE,
  FOOTWEAR_UPPER,
  GENERIC_BRAND_KIND,
  GENERIC_KIND,
  HOME_DISHES,
  HOME_KIND,
  HOME_MATERIAL,
  HOME_TEXTILE,
  KNIT_WOVEN,
  LAPTOP_SIZE,
  MATERIAL,
  SPORTS_KIND,
  TEXTILE_DENSITY,
  TEXTILE_WIDTH,
  TOOL_KIND,
  TOY_AGE,
  TOY_MATERIAL,
  YES_NO_DOCS,
  withCustomOption,
} from "./options";
import {
  SPORTSWEAR_BRANDS,
  coreReady,
  detectApparelGender,
  detectAutoPartType,
  detectBrand,
  detectCategory,
  detectColor,
  detectComposition,
  detectCosmeticForm,
  detectCosmeticVolume,
  detectElectronicsDevice,
  detectElectronicsSpecs,
  detectFootwearSole,
  detectFootwearUpper,
  detectGarmentType,
  detectHomeKindHint,
  detectUnderwearOrSocks,
  hasAnyClarify,
} from "./detect";

type QBase = Pick<ClarificationQuestion, "id" | "text" | "required" | "hint">;

function choiceQ(
  base: QBase,
  options: ClarifyOption[],
  opts?: { allowCustom?: boolean }
): ClarificationQuestion {
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

export function questionsForCategory(desc: string, category: CategoryId): ClarificationQuestion[] {
  const qs: ClarificationQuestion[] = [];
  const short = desc.trim().length < 28;

  if (category === "footwear") {
    if (!detectFootwearUpper(desc)) {
      qs.push(
        choiceQ(
          {
            id: "upper",
            required: false,
            text: "Из чего верх кроссовок/обуви?",
            hint: "Материал верха влияет на код ТН ВЭД.",
          },
          FOOTWEAR_UPPER
        )
      );
    }
    if (!detectFootwearSole(desc)) {
      qs.push(
        choiceQ(
          {
            id: "sole",
            required: false,
            text: "Из чего подошва?",
            hint: "Резина, EVA или PU — разные позиции классификатора.",
          },
          FOOTWEAR_SOLE
        )
      );
    }
    if (short) {
      qs.push(
        choiceQ(
          {
            id: "purpose",
            required: false,
            text: "Какая это обувь по назначению?",
          },
          FOOTWEAR_PURPOSE
        )
      );
    }
    if (short && !detectBrand(desc)) {
      qs.push(
        textQ({
          id: "brand",
          required: false,
          text: "Бренд, если знаете",
          hint: "Nike, Adidas, без бренда — напишите «нет».",
        })
      );
    }
    return qs;
  }

  if (category === "apparel") {
    if (!detectComposition(desc)) {
      qs.push(
        choiceQ(
          {
            id: "composition",
            required: false,
            text: "Какой состав ткани?",
            hint: "Можно выбрать примерный состав.",
          },
          COMPOSITION,
          { allowCustom: true }
        )
      );
    }
    if (!hasAnyClarify(desc, ["трикотаж", "вязан", "ткан", "knit", "woven"])) {
      qs.push(
        choiceQ(
          {
            id: "knit-woven",
            required: false,
            text: "Это трикотаж (тянущийся) или ткань (рубашечная/джинсовая)?",
            hint: "Трикотаж — футболки и худи; ткань — джинсы и рубашки.",
          },
          KNIT_WOVEN
        )
      );
    }
    if (!detectColor(desc)) {
      qs.push(
        choiceQ(
          {
            id: "color",
            required: false,
            text: "Какой основной цвет?",
          },
          COLOR,
          { allowCustom: true }
        )
      );
    }
    if (!detectApparelGender(desc) && short && !detectUnderwearOrSocks(desc)) {
      qs.push(
        choiceQ(
          {
            id: "gender",
            required: false,
            text: "Для кого одежда?",
            hint: "Пол и возраст влияют на код в группах 61–62.",
          },
          APPAREL_GENDER
        )
      );
    }
    if (!detectGarmentType(desc) && short) {
      qs.push(
        choiceQ(
          {
            id: "garment",
            required: false,
            text: "Что это за изделие?",
            hint: "Верх, низ, верхняя одежда или бельё.",
          },
          APPAREL_GARMENT
        )
      );
    }
    if (short && !detectBrand(desc)) {
      qs.push(
        textQ({
          id: "brand",
          required: false,
          text: "Бренд, если известен",
          hint: "Можно «нет» или «no name».",
        })
      );
    }
    return qs;
  }

  if (category === "textiles") {
    if (!detectComposition(desc)) {
      qs.push(
        choiceQ(
          {
            id: "composition",
            required: false,
            text: "Состав ткани",
            hint: "Выберите основной состав или укажите свой.",
          },
          COMPOSITION,
          { allowCustom: true }
        )
      );
    }
    if (!hasAnyClarify(desc, ["г/м", "г/м2", "плотн", "gsm"])) {
      qs.push(
        choiceQ(
          {
            id: "density",
            required: false,
            text: "Какая плотность (г/м²)?",
            hint: "Для хлопка часто 80–200 г/м².",
          },
          TEXTILE_DENSITY
        )
      );
    }
    if (!hasAnyClarify(desc, ["ширин", "см"])) {
      qs.push(
        choiceQ(
          {
            id: "width",
            required: false,
            text: "Ширина рулона",
            hint: "Типичные значения для ткани в рулоне.",
          },
          TEXTILE_WIDTH,
          { allowCustom: true }
        )
      );
    }
    return qs;
  }

  if (category === "electronics") {
    if (!detectElectronicsDevice(desc)) {
      qs.push(
        choiceQ(
          {
            id: "device",
            required: false,
            text: "Что за устройство или аксессуар?",
            hint: "Ноутбук, телефон, наушники, зарядка, кабель…",
          },
          ELECTRONICS_DEVICE,
          { allowCustom: true }
        )
      );
    }
    if (short && !detectBrand(desc)) {
      qs.push(
        textQ({
          id: "brand-model",
          required: false,
          text: "Укажите бренд и модель",
          hint: "Lenovo ThinkPad T480, iPhone 13, Xiaomi Redmi…",
        })
      );
    }
    if (!detectElectronicsSpecs(desc)) {
      qs.push(
        choiceQ(
          {
            id: "specs",
            required: false,
            text: "Какие ключевые характеристики?",
            hint: "Выберите типичный вариант или укажите свой.",
          },
          ELECTRONICS_SPECS,
          { allowCustom: true }
        )
      );
    }
    if (
      hasAnyClarify(desc, ["ноут", "laptop", "notebook", "macbook"]) &&
      !hasAnyClarify(desc, ["диагон", "дюйм", "кг"])
    ) {
      qs.push(
        choiceQ(
          {
            id: "display-weight",
            required: false,
            text: "Диагональ экрана и вес",
            hint: "Важно для кода «до 10 кг».",
          },
          LAPTOP_SIZE,
          { allowCustom: true }
        )
      );
    }
    if (
      hasAnyClarify(desc, ["телефон", "смартфон", "iphone"]) &&
      !hasAnyClarify(desc, ["нов", "б/у", "used"])
    ) {
      qs.push(
        choiceQ(
          {
            id: "condition",
            required: false,
            text: "Новые или б/у, с зарядкой в комплекте?",
          },
          CONDITION
        )
      );
    }
    return qs;
  }

  if (category === "appliances") {
    qs.push(
      choiceQ(
        {
          id: "power",
          required: false,
          text: "Мощность и объём/размер",
          hint: "Ориентир по шильдику на технике.",
        },
        APPLIANCE_POWER,
        { allowCustom: true }
      )
    );
    if (!hasAnyClarify(desc, ["нов", "б/у"])) {
      qs.push(
        choiceQ(
          {
            id: "condition",
            required: false,
            text: "Техника новая или б/у?",
            hint: "Для таможни это разные режимы.",
          },
          APPLIANCE_CONDITION
        )
      );
    }
    return qs;
  }

  if (category === "auto") {
    if (!detectAutoPartType(desc)) {
      qs.push(
        choiceQ(
          {
            id: "part-type",
            required: false,
            text: "Какая группа запчасти?",
            hint: "Фильтр, тормоза, подвеска, кузов, двигатель…",
          },
          AUTO_PART_TYPE,
          { allowCustom: true }
        )
      );
    }
    if (short) {
      qs.push(
        textQ({
          id: "vehicle",
          required: false,
          text: "Для какого авто (марка / модель / год)?",
          hint: "Toyota Camry 2018 или «универсальные».",
        })
      );
    }
    qs.push(
      textQ({
        id: "part",
        required: false,
        text: "Точное название детали и материал, если знаете",
        hint: "Амортизатор, пластиковый бампер, колодки.",
      })
    );
    return qs;
  }

  if (category === "cosmetics") {
    if (
      !hasAnyClarify(desc, [
        "шампун",
        "крем",
        "духи",
        "парфюм",
        "помад",
        "тушь",
        "декоратив",
        "мыл",
        "лосьон",
      ])
    ) {
      qs.push(
        choiceQ(
          {
            id: "kind",
            required: false,
            text: "Что именно: крем, шампунь, духи, декоративная косметика?",
            hint: "От вида зависит код и ограничения.",
          },
          COSMETIC_KIND
        )
      );
    }
    if (!detectCosmeticForm(desc)) {
      qs.push(
        choiceQ(
          {
            id: "form",
            required: false,
            text: "Форма: жидкость, крем, твёрдое или аэрозоль?",
          },
          COSMETIC_FORM
        )
      );
    }
    if (!detectCosmeticVolume(desc)) {
      qs.push(
        choiceQ(
          {
            id: "volume-range",
            required: false,
            text: "Примерный объём одной упаковки",
            hint: "Для духов и жидкостей важен объём.",
          },
          COSMETIC_VOLUME
        )
      );
    }
    return qs;
  }

  if (category === "bags") {
    if (!hasAnyClarify(desc, ["кож", "текстил", "ткан", "полиэстер", "нейлон", "пластик"])) {
      qs.push(
        choiceQ(
          {
            id: "material",
            required: false,
            text: "Материал сумки/рюкзака снаружи",
          },
          BAG_MATERIAL,
          { allowCustom: true }
        )
      );
    }
    qs.push(
      choiceQ(
        {
          id: "kind",
          required: false,
          text: "Это рюкзак, шоппер, чемодан или кошелёк?",
        },
        BAG_KIND
      )
    );
    return qs;
  }

  if (category === "accessories") {
    qs.push(
      choiceQ(
        {
          id: "material",
          required: false,
          text: "Основной материал",
          hint: "Металл, пластик, текстиль, кожа, стекло.",
        },
        ACCESSORY_MATERIAL,
        { allowCustom: true }
      )
    );
    if (!detectBrand(desc) && short) {
      qs.push(
        textQ({
          id: "brand",
          required: false,
          text: "Бренд, если есть",
          hint: "Можно «без бренда».",
        })
      );
    }
    return qs;
  }

  if (category === "toys") {
    qs.push(
      choiceQ(
        {
          id: "material",
          required: false,
          text: "Из чего игрушка?",
          hint: "Пластик, плюш, дерево или с электроникой.",
        },
        TOY_MATERIAL
      )
    );
    qs.push(
      choiceQ(
        {
          id: "age",
          required: false,
          text: "Для какого возраста?",
        },
        TOY_AGE,
        { allowCustom: true }
      )
    );
    return qs;
  }

  if (category === "sports") {
    qs.push(
      choiceQ(
        {
          id: "kind",
          required: false,
          text: "Какой спортивный инвентарь?",
          hint: "Мяч, гантели, коврик, ракетка…",
        },
        SPORTS_KIND,
        { allowCustom: true }
      )
    );
    return qs;
  }

  if (category === "home") {
    if (!detectHomeKindHint(desc)) {
      qs.push(
        choiceQ(
          {
            id: "kind",
            required: false,
            text: "Что именно: посуда, текстиль для дома, мебель, свет?",
          },
          HOME_KIND
        )
      );
    }
    if (hasAnyClarify(desc, ["посуд", "тарел", "кастр", "сковор", "кружк", "бокал", "столов"])) {
      qs.push(
        choiceQ(
          {
            id: "dishes-material",
            required: false,
            text: "Материал посуды",
          },
          HOME_DISHES,
          { allowCustom: true }
        )
      );
    } else if (
      hasAnyClarify(desc, ["подуш", "одеял", "постель", "простын", "штор", "покрывал", "салфет"])
    ) {
      qs.push(
        choiceQ(
          {
            id: "textile-material",
            required: false,
            text: "Состав текстиля для дома",
          },
          HOME_TEXTILE,
          { allowCustom: true }
        )
      );
    } else {
      qs.push(
        choiceQ(
          {
            id: "material",
            required: false,
            text: "Материал изделия",
          },
          HOME_MATERIAL,
          { allowCustom: true }
        )
      );
    }
    return qs;
  }

  if (category === "tools") {
    qs.push(
      choiceQ(
        {
          id: "kind",
          required: false,
          text: "Ручной или электроинструмент?",
          hint: "Мощность можно указать в «Другое».",
        },
        TOOL_KIND,
        { allowCustom: true }
      )
    );
    return qs;
  }

  if (category === "food") {
    qs.push(
      choiceQ(
        {
          id: "kind",
          required: false,
          text: "Что за продукт?",
          hint: "Чай, кофе, снеки, БАД…",
        },
        FOOD_KIND,
        { allowCustom: true }
      )
    );
    qs.push(
      choiceQ(
        {
          id: "packaging",
          required: false,
          text: "Как упаковано?",
          hint: "Розница, опт или заморозка.",
        },
        FOOD_PACKAGING
      )
    );
    qs.push(
      choiceQ(
        {
          id: "origin",
          required: false,
          text: "Страна происхождения продукта",
        },
        FOOD_ORIGIN,
        { allowCustom: true }
      )
    );
    qs.push(
      choiceQ(
        {
          id: "cert",
          required: false,
          text: "Есть ли сертификаты / срок годности на момент ввоза?",
        },
        FOOD_CERT
      )
    );
    return qs;
  }

  if (category === "baby") {
    qs.push(
      choiceQ(
        {
          id: "kind",
          required: false,
          text: "Что именно для детей?",
        },
        BABY_KIND
      )
    );
    qs.push(
      choiceQ(
        {
          id: "age",
          required: false,
          text: "Возраст ребёнка / размер",
        },
        BABY_AGE,
        { allowCustom: true }
      )
    );
    return qs;
  }

  if (hasAnyClarify(desc, SPORTSWEAR_BRANDS) && desc.trim().split(/\s+/).length <= 3) {
    qs.push(
      choiceQ(
        {
          id: "kind",
          required: false,
          text: "Это одежда, обувь или аксессуар этого бренда?",
        },
        GENERIC_BRAND_KIND
      )
    );
  } else {
    qs.push(
      choiceQ(
        {
          id: "kind",
          required: false,
          text: "Уточните, что это за товар (название и вид)",
          hint: "Как на инвойсе: одежда, обувь, ткань, запчасть…",
        },
        GENERIC_KIND,
        { allowCustom: true }
      )
    );
  }
  qs.push(
    choiceQ(
      {
        id: "material",
        required: false,
        text: "Из какого материала основная часть?",
      },
      MATERIAL,
      { allowCustom: true }
    )
  );
  return qs;
}

/** Max 3; docs Q last among ≤2 attribute Qs when present. */
export function truncateClarifyQuestions(qs: ClarificationQuestion[]): ClarificationQuestion[] {
  const docsQ = qs.find((q) => q.id === "docs");
  const trimmed = docsQ
    ? [...qs.filter((q) => q.id !== "docs").slice(0, 2), docsQ]
    : qs.slice(0, 3);
  return trimmed.map(normalizeQuestion);
}

/**
 * Heuristic clarify questions (no LLM).
 * NewCalc: step 1 only, no docs Q. Lab wizard: docs + optional step 2 price.
 */
export function heuristicClarificationQuestions(
  input: HeuristicClarifyInput
): ClarificationQuestion[] {
  const step = input.step ?? 1;
  const qs: ClarificationQuestion[] = [];
  const desc = (input.desc || "").trim();

  if (step === 1) {
    if (!desc) return [];
    const category = detectCategory(desc);
    qs.push(...questionsForCategory(desc, category));

    if (input.includeDocsQuestion && !input.hasDocs && coreReady(desc, category)) {
      qs.push(
        choiceQ(
          {
            id: "docs",
            required: false,
            text: "Есть фото или инвойс, чтобы уточнить точнее?",
            hint: "Документы не обязательны, но помогают с кодом.",
          },
          YES_NO_DOCS
        )
      );
    }
  }

  if (step === 2 && input.includePriceQuestions) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price <= 0) {
      qs.push(
        textQ({
          id: "price",
          required: true,
          text: "Уточните таможенную стоимость партии (в $)",
          hint: "Это значение используется для расчёта пошлины и НДС",
        })
      );
    } else if (price < 5000) {
      qs.push(
        textQ({
          id: "price-low",
          required: false,
          text: "Стоимость кажется невысокой — всё ли учтено в сумме партии?",
          hint: "Можно уточнить: объём/количество, что входит в стоимость",
        })
      );
    }

    if (input.tariff === "Код") {
      qs.push(
        choiceQ(
          {
            id: "code-scope",
            required: false,
            text: "Тариф «Код» не считает пошлину. Этого описания достаточно для ТН ВЭД?",
            hint: "Если нужен расчёт платежей — позже можно взять «Таможню».",
          },
          CODE_SCOPE
        )
      );
    }
  }

  return truncateClarifyQuestions(qs);
}

/** NewCalc / cabinet: ≤3 attribute questions, no docs/price. */
export function newCalcClarifyQuestions(desc: string): ClarificationQuestion[] {
  return heuristicClarificationQuestions({
    desc,
    step: 1,
    includeDocsQuestion: false,
    includePriceQuestions: false,
  });
}
