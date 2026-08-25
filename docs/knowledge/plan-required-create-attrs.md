# Plan: обязательные attrs при create (страна / производитель / состав)

**D33 · 2026-08-23 · статус: done**

## Цель

На create клиент обязан заполнить по каждой позиции с названием:

1. **Страна происхождения** (`originCountry`, ISO-2)
2. **Производитель** (`manufacturerName`)
3. **Состав** (`composition`)

Для точности LLM/брокера (после rich-проб).

## Срез (сделано)

| Слой | Изменение |
|------|-----------|
| `product-description.ts` | `hasRequiredCreateAttrs` / `missingRequiredCreateAttrs` |
| `POST /api/v1/calculations` | refine: named items → все три attrs (SKU — после hydrate) |
| `createAndDraftCalculation` + `containers/api` | hard-reject после hydrate |
| `NewCalcPane` | поля * + disable CTA; manufacturer всегда |
| `DashboardPane` quick | те же три поля |
| `ClientCabinet` quickCreate | прокинуть attrs |
| CSV / catalog SKU | map composition + manufacturerName |
| Unit | `product-description-required` |
| KB | `calculation-fields.md` §1/§3 |

## Не в срезе

Обязательный фото/hsHint; broker fill остаётся для пустых прочих полей.

## Follow-up (2026-08-23)

`POST /api/v1/calculations`: `ZodError` (в т.ч. missing attrs) → **400** + `issues[0].message`, не 500 со stringify issues. Domain throw `Обязательн…` тоже 400.

**UI soft gate:** CTA не disabled из‑за пустых attrs; по клику — toast + подсветка полей. API по-прежнему hard-reject.
