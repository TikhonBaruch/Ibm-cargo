# План: OCR-A — фото инвойса → строки мультипозиции

**D33.** Дата: 2026-09-04.  
**Статус:** **done** 2026-09-04. Production `ibm-cargo-phi` — PR #86 + SW hotfix #87.  
**База:** `origin/main` @ `6dbbb0e` (PR #85). **Не** `cursor/tnved-broker-handoff`. **Не** `cursor/tnved-invoice-enrich-e1f0`.

**Канон:** [`plan-lbm-bro-c36-c39-port.md`](./plan-lbm-bro-c36-c39-port.md) (deny-list) · [`plan-ocr-vision.md`](./plan-ocr-vision.md) · [`plan-lbm-bro-newcalc-multipack.md`](./plan-lbm-bro-newcalc-multipack.md) · D30 / D36 · [`PACKAGES.md`](../../src/lib/ved/PACKAGES.md).

C36 P3 закрыт **без** invoice-photo vision. OCR-B (фото товара → описание) уже live через `describe`. Этот план — только OCR-A.

---

## 0. Реестр рисков (gate до кода)

Проверка 2026-09-04 по дереву `main` (#85). Код не писать, если нарушено «как не делать».

### 0.1 Go / no-go

| | |
|--|--|
| **Go** | Новая ветка от `origin/main`; table-extract **рядом** с `product-vision-describe.ts`, prompt SKU не трогать; preview остаётся Next-only; CSV пустой = 400; `addPhoto` / C21 / directory вне diff |
| **No-go** | Merge/cherry-pick `534152d` / `import-vision.ts`; старт с handoff-ветки; вызов `describeForChain` as-is на фото инвойса; только `OCR_SERVICE_URL` без mesh; вернуть `ProductCsvImport` в `NewCalcPane` |

### 0.2 Что уже безопасно (не ломается само)

| Факт | Следствие |
|------|-----------|
| `POST /imports/*` → `mustStayOnNext` | Dual-path в `containers/api` **не** нужен (шаг 4b feature-cycle — N/A) |
| Preview уже в `PROTECTED_V1_MUTATIONS` | Новой мутации нет; 4c уже закрыт |
| `maxDuration = 120` на preview и describe | Не менять Hobby kill ради vision |
| CSV/XLSX/PDF → `mapCsvToRows` + `classifyImportRows` + D10 truncate | OCR-A = вход `SheetTable`, не новый classify |
| `addPhoto` ≠ `addPackFile`; `clarifyEnabled = !isPack` | C21 на мульти и так выключен |
| Hygiene: `NewCalcPane` **не** содержит `ProductCsvImport` | UI только pack dropzone + `new-calc-pack.ts` |
| Handoff / directory / HS blur / alias — другие файлы | Нет файлового overlap с #69–#84 и `154e6d8` |

### 0.3 Высокий риск (ломает продукт или это костыль)

| ID | Риск | Почему сейчас | Как не сделать |
|----|------|---------------|----------------|
| R1 | Cherry-pick старой enrich `534152d` | Ветка на C21–C31 без leaf-only / blur / #85 photo-first | Идеи, не коммит |
| R2 | Второй vision-клиент (`import-vision.ts`) | На main уже `describeForChain` + `provider-mesh` | Новый helper **table JSON**, тот же transport |
| R3 | `describeForChain` as-is на инвойсе | Prompt DeepSeek: «Опиши товар… description/attrs». Тихо получится 1 SKU, не таблица | **Не** менять SKU prompt. Отдельный `extractInvoiceTableForChain` |
| R4 | Только `OCR_SERVICE_URL` / `extract-table` | D30/старый OCR-план. На Vercel сервиса OCR нет; photo-first живёт mesh. Compose заработает, прод — снова тишина | Mesh на Vercel (как describe); `extract-table` только если задан `OCR_SERVICE_URL` |
| R5 | Пустая таблица после vision = 400 | `No product rows found` → UI «Нужен CSV/Excel» | CSV без строк = **400** (регресс). Картинка без строк = **200** + `kind`/`notes`, UI fail-open |
| R6 | Смешать с handoff PR | Текущий worktree сидел на `cursor/tnved-broker-handoff` | Эта ветка `feat/ocr-a-invoice-preview` от `main` |

### 0.4 Средний риск (соседний поток)

| ID | Риск | Митигация |
|----|------|-----------|
| R7 | `NewCalcPane.tsx` — photo-first P2 в том же файле | Diff только `addPackFile` / pack copy / thumb. Не трогать `addPhoto`, `ClarifyField`, pay |
| R8 | `< MIN_PACK` обнуляет items и `packFail` | 0–1 строка с фото: файл **остаётся** прикреплённым, текст в комментарий; «Далее» по-прежнему ≥2 |
| R9 | Timeout 90s vision + cascade в 120s preview | Таймаут extract = `visionDescribeTimeoutMs` (90s default). На Vercel без `LLM_SERVICE_URL` classify = cascade (локально). STANDARD cap 3, PRO 10 |
| R10 | `pdfBase64`/`imageBase64` zod max ~4e6 vs UI «до 12 МБ» | Как у PDF: `compressImageForUpload` **до** preview. Не поднимать лимит JSON |
| R11 | Multipart `else` = CSV | `ProductCsvImport` шлёт csv/xlsx/pdf. JPG в JSON path. Image в multipart — определить по mime/имени, не парсить как CSV |
| R12 | Mesh + cabinet в одном PR (`PACKAGES.md`) | Как #85: один продуктовый путь допустим, если diff узкий. Иначе A+B затем C |
| R13 | iPhone HEIC с `capture=environment` | Сжимать в JPEG через существующий helper; неподдерживаемый mime → fail-open, не 500 |
| R14 | S3 GET `AccessDenied` при `mediaUrl` | Preview как PDF: **`imageBase64` с клиента** (после compress). `mediaUrl` — опциональный fallback с `isAllowedMediaUrl` |

### 0.5 Низкий риск при deny-list

Search, directory leaf-only, HS blur, related mask, card-enrich, C29c цена, C21 packs — не в changeset. Unit `new-calc-pack.test.ts` не проверяет `isSheetFile`; сломать MIN_PACK/цену можно только правкой chrome.

### 0.6 Не проверяется без live

Качество JSON с реальных фото инвойса; укладка vision+10 cascade в 120s на PRO; валидность `DEEPSEEK_*` на Vercel (ключи уже ставили 2026-09-01).

### 0.7 Регресс после каждой фазы

`/cabinet/tnved` leaf-only + blur · search «ноутбук» без бамбука · C21 на `/cabinet/new` single · EXPRESS ≠ 0 ₽ · CSV/XLSX preview · photo-first одна позиция.

---

## 1. Идея

Мультипозиция: JPG/PNG/WEBP инвойса или packing list → те же `items[]`, что CSV. Не фейковый OCR и не «нужен Excel», если vision пустой — файл остаётся, пользователь видит честный fail-open.

Поток (как PDF, не как OCR-B):

```text
drop JPG → compress → POST preview { imageBase64, mimeType, tariffCode }
  → extractInvoiceTableForChain → SheetTable → mapCsvToRows → D10 cap → classifyImportRows
  → ≥2 строк: пакет; 0–1: thumb + notes в комментарий; MIN_PACK gate без изменений
```

OCR-B (`addPhoto` → `POST …/describe`) **не** расширять под таблицу.

---

## 2. Зона и контракт

| | |
|--|--|
| Ветвь | 1 Client UI + ядро mesh/preview (Next-only) |
| HTTP | тот же `POST /api/v1/imports/products/preview` (session CLIENT, уже protected) |
| Dual-path | не зеркалить в `containers/api` |
| Новый path | не нужен |

Тело JSON (добавка к существующему zod): `imageBase64` (max как `pdfBase64`), `mimeType` `image/jpeg|png|webp`. Опционально `mediaUrl` allowlist — второй вход, не вместо base64.

Ответ при vision без строк: **200** `{ rowCount: 0, rows: [], vision: { attempted: true, engine? }, notes }` — не 400. CSV/XLSX/PDF без строк — по-прежнему 400.

---

## 3. Не делать (deny-list)

Из C36, плюс:

- `TnvedDirectoryPane` / `tnved-client-hs-mask` / `tnved-query-match` / C21 packs / card-enrich
- Default `AI_CHAIN` flip
- Handoff ТН ВЭД (`scripts/tnved-handoff-*`, `handoff/`)
- SKU prompt в `describeWithProviderDeepseek` / `describeWithProviderQwen`
- `ProductCsvImport` обратно в `NewCalcPane` (hygiene test)
- Fake OCR / подстановка демо-строк
- Деплой feature-ветки в Production в обход PR в `main`

---

## 4. Фазы

Одна фаза → unit → регресс directory/search/clarify → следующая.

| Фаза | Что | Зона | Gate |
|------|-----|------|------|
| **A** | `extractInvoiceTableForChain`: mesh table-prompt **или** OCR `extract-table` если `OCR_SERVICE_URL`; items[] → `SheetTable`; без ключа → `null` | mesh (`product-vision-describe.ts` рядом **или** `invoice-vision-table.ts`) | unit JSON→rows; `visionConfiguredForChain` false → null; SKU describe tests зелёные |
| **B** | Preview: image json/multipart; пустая vision → 200; CSV empty → 400; D10 truncate как сейчас | `preview/route.ts` | unit/route-level если есть; не ломать `product-import.test.ts` |
| **C** | `isSheetFile` + image; compress; blob thumb; `addPackFile` fail-open 0–1 | `new-calc-pack.ts`, точечно `NewCalcPane` | hygiene (ClarifyField, нет ProductCsvImport, нет 0 ₽); MIN_PACK=2 |
| **D** | `test:ci` + ручной CSV / фото инвойса / фото товара в multi / single photo-first | — | регресс §0.7 |
| **E** | KB close (этот файл done + dual-path/current-app/ocr-vision) → PR → Preview → Production | docs | не деплоить с handoff |

Фазы A+B можно одним PR без UI; C — следующим. Или один PR, если diff < ~C36 P3.

---

## 5. Тесты

- Domain: fixture JSON `{ items: [...] }` → `mapCsvToRows` не пустой; пустой/битый JSON → null
- Preview: image без строк ≠ 400; csv без name-колонки = 400
- Pack: image filename больше не `NEED_TABLE`; `.csv` путь без изменений
- Hygiene: `public-surface-hygiene` (C21 strings, не `ProductCsvImport`)
- `test:ci`

Ручной: `/cabinet/new` мульти + JPG таблицы; мульти + фото одного товара; single photo-first; CSV; directory/search/clarify; цена EXPRESS.

---

## 6. Журнал

| Когда | Что |
|-------|-----|
| 2026-09-04 | Риски §0 + план; ветка `feat/ocr-a-invoice-preview` от `main`. Кода нет |
| 2026-09-04 | **A** `invoice-vision-table.ts` + mesh table prompt (SKU describe не тронут) · unit JSON→rows / no-key→null |
| 2026-09-04 | **B** preview `imageBase64` / multipart image; пустая картинка 200; CSV empty 400 |
| 2026-09-04 | **C** pack JPG + compress + blob thumb; 0–1 строк fail-open, файл прикреплён; MIN_PACK=2 |
| 2026-09-04 | **D** unit OCR-A + NewCalc hygiene C10–C12 ✓. `test:ci` целиком: на main уже красные C17 `heading=1` и Cov-P12 (не этот diff) |
| 2026-09-04 | **E** commit + PR в `main`; Preview после checks; Production после merge |
| 2026-09-04 | **hotfix** SW cache-first отдавал старый pack-reader; lab `filesToDocs` выкидывал строки с фото (`kind !== "photo"`) |
