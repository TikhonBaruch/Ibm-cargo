# План: режим «Мультипозиция» на live `/cabinet/new` (C11)

**D33.** Продолжение [`plan-lbm-bro-newcalc-mock.md`](./plan-lbm-bro-newcalc-mock.md). Канон клика: lab [`client-wizard.tsx`](../../src/lbm-bro/components/client-wizard.tsx) `setMode("multi")` → `pickPack("m20")`. Chrome: [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md).

## 1. Идея

Клик **«Мультипозиция»** на live `/cabinet/new` собирает тот же экран, что lab `/client/new`: чип on, «Прикрепить файл», комментарий к партии, страна, dropzone invoice/CSV, карточки Старт/Стандарт/Профи, сайдбар с «Позиций» и ценой пакета. Модалка «Файл с позициями» при входе в режим.

**Domain D10 не менять.** Карточки макета (1 / 20 / 100 · 990 / 3990 / 6990) — hold. Live: EXPRESS 1 · STANDARD 3 · PRO 10 и `priceRub` из `/api/v1/tariffs`. Create по-прежнему `POST /api/v1/calculations`. Файл → `POST /api/v1/imports/products/preview` (CSV/XLSX/PDF **и JPG/PNG/WEBP**). Фото инвойса: vision extract-table через provider-mesh (Qwen/DeepSeek), не stub OCR. Фото товара (не таблица): файл остаётся прикреплённым (thumb + S3), текст → комментарий. Канон vision: [`plan-ocr-vision.md`](./plan-ocr-vision.md) OCR-A.

## 2. Клик (лок)

| Действие | UI | Domain |
|----------|----|--------|
| Мультипозиция | `packMode=multi`, баннер 0 ₽ скрыт, модалка, тариф STANDARD | `form.tariffCode = STANDARD` |
| Прикрепить файл | снова модалка | — |
| Старт | назад в одну позицию | EXPRESS (create 1 поз.) |
| Стандарт / Профи | остаёмся в multi | STANDARD / PRO |
| Файл ≥ 2 строк | quote + таблица имён, cap D10 | items[] |
| JPG/PNG инвойс | preview `imageBase64` → vision rows | те же items[] |
| JPG товара / 0–1 строка | thumb + «прикреплён», описание в комментарий | mediaUrl на item[0]; Далее всё ещё ≥ 2 имён |
| Далее | disabled пока < 2 имён | create cap `maxPositionsForTariff` |
| Одна позиция | C10 chrome | как C10 (default STANDARD) |

## 3. Не делать

Менять D8/D10/D11; 20/100 позиций в API; fake 3990/6990 как charge; голос; шаг «Бесплатно» как pay.

## 4. Проверка

Unit: маппинг пакета → live code; NewCalcPane содержит «Прикрепить файл» / `pack-modal`. `npm run test:ci`. Ручной: клик Мультипозиция = экран макета; CSV → строки; create живой.

Restore: git до C11; кнопка Мультипозиция снова no-op.
