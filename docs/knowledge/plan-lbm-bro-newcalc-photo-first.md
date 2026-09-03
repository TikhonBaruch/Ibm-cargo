# План: `/cabinet/new` = photo-first как live lbm-bro (C36)

**D33.** Live `/cabinet/new` ↔ эталон https://lbm-bro.vercel.app/client/new.  
База: C10–C12 · C29c (без фейкового 0 ₽) · [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md).

## 1. Идея

На **одной позиции** порядок полей как на live lab: **фото → наименование → страна → clarify → тарифные карточки**.  
Фото вызывает `POST /api/v1/imports/products/describe` (DeepSeek) и подставляет текст в описание.

## 2. Лок

| Блок | Live |
|------|------|
| Режим | «Одна позиция» / «Мультипозиция» (без «1 бесплатно» — C29c) |
| Фото | label «Фото товара»; copy «ИИ распознает… заполнит описание…» |
| Описание | placeholder «Или опишите сами… либо загрузите фото выше» |
| Страна + clarify | как C12 |
| Тариф | `tariff-pick` Старт/Стандарт/Профи на **обоих** режимах; single → `picked.liveCode` |
| Шаги | Товар / Оплата / Код (не «Бесплатно») |

## 3. Не делать

Freemium 0 ₽; voice/mic; смена D10 caps; fake free pay.

## 4. Проверка

Unit: hygiene строки photo-first + describe. `npm run test:ci`. Ручной: фото → описание; Далее → Оплата с ценой EXPRESS.

## 5. Hotfix — Vercel Request ID / crash на фото

**Симптом:** платформенная страница с `Request ID: <uuid>` (не JSON 4xx) при фото на `/cabinet/new`. Runtime log по UUID пустой: middleware 500/`FUNCTION_INVOCATION_*` без stdout.

| Причина | Фикс |
|---------|------|
| `describe`/`preview` зовут DeepSeek до 90s, а функция без `maxDuration` режется платформой | `export const maxDuration = 120` |
| `POST /uploads` читает весь `arrayBuffer` до проверки лимита → OOM на большом кадре | `file.size` до чтения; 413 |
| `GET /tnved/search` без catch → Prisma/timeout = crash page | fail-open JSON |
