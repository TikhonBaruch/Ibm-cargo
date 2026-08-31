# План: панель «Уточняем для точности кода» на live `/cabinet/new` (C12)

**D33.** Продолжение [`plan-lbm-bro-newcalc-mock.md`](./plan-lbm-bro-newcalc-mock.md) (C10) и [`plan-lbm-bro-newcalc-multipack.md`](./plan-lbm-bro-newcalc-multipack.md) (C11).  
Канон: lab [`clarify-field.tsx`](../../src/lbm-bro/components/clarify-field.tsx) + [`getClarificationQuestions`](../../src/lbm-bro/lib/clarify-ai.ts) `({ wizard, step: 1 })` + apply в [`client-wizard.tsx`](../../src/lbm-bro/components/client-wizard.tsx). Chrome: [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md). Поля: [`calculation-fields.md`](./calculation-fields.md).

## 1. Идея

На live **одной позиции** `/cabinet/new` после описания (и страны) показать fill-help панель **«Уточняем для точности кода»** — те же чипы, что lab на «носки»: состав / трикотаж·ткань / цвет, **Применить** / **Пока пропустить**.

**Не** на `/cabinet/tnved`. **Не** в режиме Мультипозиция (lab уже `packMode !== "multi"`). Heuristic **не** переписывать — reuse lab.

Create по-прежнему `POST /api/v1/calculations`. Domain D8 / D10 / D11 не менять. Инвойс/qty/вес остаются скрыты (`commercialInvoiceUiEnabled()` false).

## 2. Клик (лок)

| Действие | UI | Domain |
|----------|----|--------|
| Описание (напр. «носки») | debounce → `getClarificationQuestions({ wizard, step: 1 })` | — |
| Чипы | `ClarifyField` / `clarify-options` | — |
| Применить | в описание блок `Уточнения (ИИ):`; `attrs.composition` с ответа | create шлёт origin + composition |
| Пока пропустить | скрыть панель (`skipClarifications`) | create как сейчас (composition ← описание) |
| Страна (single) | select, default Китай / CN | `originCountry` ISO |
| Мультипозиция | без панели | как C11 |
| Далее | без изменений | `/api/v1/calculations` |

Wizard draft для вопросов: `{ desc, country, docs: [], packMode: "single", ...EMPTY_WIZARD }`.

## 3. Не делать

Переписывать heuristic; голос/mic; freemium pay; directory-only clarify; полный tariff-pick на single (карточки — C11 multi); required инвойс/qty/вес; LLM CTA (opt-in `NEXT_PUBLIC_AI_CLARIFY_URL` уже в lab).

Паттерн (D32): **progressive disclosure** / chip choice — reuse lab `ClarifyField` + `.amt-chips.clarify-chips`, не второй виджет.

## 4. Проверка

Unit: helper draft/apply/composition; «носки» → composition / knit-woven / color. Hygiene: NewCalcPane содержит `Уточняем для точности кода` / `ClarifyField` / `getClarificationQuestions`; C10/C11 локи (`Мультипозиция` / `pack-modal`, нет `tariff-mini` / CSV / HS-autocomplete) не ослаблять.  
`npm run test:ci`. Ручной: `/cabinet/new` «носки» → чипы; Применить пишет состав в описание; Пропустить прячет панель; create живой; multi без панели.

Restore: git до C12; страна на single снова скрыта; панели нет.
