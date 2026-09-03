# План: фото инвойса → строки в «Мультипозиция» (C37 / OCR-A live)

**D33.** Live `/cabinet/new` multi. Параллель single photo→describe (C36).  
Канон: lab OCR на фото · [`plan-ocr-vision.md`](./plan-ocr-vision.md) OCR-A · [`plan-lbm-bro-newcalc-multipack.md`](./plan-lbm-bro-newcalc-multipack.md) (C11) · D10.

**Статус:** реализовано (лок Q1A / Q2B / Q3A). Deploy — CLI `vercel --prod` до git-push.

## 1. Идея

Скан/фото таблицы инвойса (`JPG`/`PNG`/`WEBP`) в режиме **Мультипозиция** даёт те же `items[]`, что CSV/PDF preview: имена (+ qty/цена если модель увидела), cap D10, fail-open с текущим copy.

**Параллель single:** тот же DeepSeek vision (chain 3), in-process на Vercel — **без** обязательного `OCR_SERVICE_URL` / browser Tesseract. Не freemium; caps EXPRESS1 / STANDARD3 / PRO10.

## 2. As-is → to-be

| | Lab | Live multi (было) | Live multi (C37) |
|--|-----|-------------------|------------------|
| CSV/XLSX/PDF | browser / preview | `POST …/preview` | без изменений |
| Фото таблицы | Tesseract в браузере | reject `NEED_TABLE` | DeepSeek → preview |
| После чтения | editable lines | список имён | `HsLinesTable` editable |
| Single фото товара | — | DeepSeek `…/describe` | без изменений |

## 3. Лок (Q1A · Q2B · Q3A)

| Слой | Что |
|------|-----|
| UI | `previewPackFile` → `imageBase64`; busy «Читаем фото инвойса…»; ≥2 строк → editable name/qty/price; truncate note |
| API | `POST /api/v1/imports/products/preview` + `imageBase64`/`mimeType` (+ multipart image) |
| Domain | `extractTableFromVisionImage` → `sheetTableFromVisionItems` → `mapCsvToRows` / `classifyImportRows` |
| Caps | truncate до `maxPositionsForTariff` для vision **и** sheet/PDF (C37b: sheet over-max больше не 400) |
| Fail-open | пустые items → UI fail-copy; create не ломаем |

### Порядок смысла строки (как single C36)

`name` = тип/наименование позиции; `description` = состав/деталь если есть; qty/unitPrice опционально.

## 4. Не делать

- Browser Tesseract (lab-only path) как основной на Vercel  
- Лимиты 20/100 · fake 3990/6990  
- Clarify panel в multi  
- Менять D8/D11 pay-first  
- Обязательный Docker OCR на prod  

## 5. Файлы

- `src/lib/ved/import-vision-table.ts` + unit test  
- `app/api/v1/imports/products/preview/route.ts`  
- `src/components/ved/client/new-calc-pack.ts`  
- `src/components/ved/client/NewCalcPane.tsx` (`HsLinesTable`)

## 6. Проверка

Unit: vision→items formatter; image filename; DeepSeek key gate.  
Ручной: `/cabinet/new` → Мультипозиция → `invoice-positions.png` → editable ≥2 строк или честный fail.  
`npm run test:ci`.

## 7. Решения (закрыто)

**Q1.** Vision: **(A)** DeepSeek in-process как `describe`.  
**Q2.** После чтения: **(B)** редактируемая таблица qty/цена.  
**Q3.** Upload: **(A)** сразу `imageBase64` в preview.

## 8. Hotfix (C37b) — PDF/XLSX «не читает»

**Симптом (prod):** любой PDF/XLSX → «Не удалось вычитать позиции…», файл при этом «прикреплён».

| Причина | Фикс |
|---------|------|
| Sample/XLSX колонка `description` без `name` → `mapCsvToRows` = [] → 400 | `description` как name fallback |
| Text-layer PDF → много строк (шапка+позиции) > STANDARD max 3 → **400 Too many rows** | truncate как у vision |
| PDF без header: `1 Cotton T-shirt 800 3.10` одной ячейкой + шум Invoice/Seller | numbered-line split + фильтр шапки |
| UI: `packDocName \|\| packFail` всегда красный текст при имени файла | fail-copy только при `packFail` |
