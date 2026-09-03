# План: hardening prod после полной проверки (C39)

**D33.** Live `ibm-cargo-phi`. Цель — закрыть баги проверки 2026-09-03 **без регрессии** C36 / C37 / C37b / C38.

**Статус:** A–E ✓ на prod · F ✓ (PR) · FTS-PR — отдельный план.

Канон: [`feature-cycle.md`](./feature-cycle.md) · C36 [`plan-lbm-bro-newcalc-photo-first.md`](./plan-lbm-bro-newcalc-photo-first.md) · C37/C37b [`plan-lbm-bro-newcalc-invoice-photo.md`](./plan-lbm-bro-newcalc-invoice-photo.md) · C38 [`plan-lbm-bro-tnved-directory-peek.md`](./plan-lbm-bro-tnved-directory-peek.md).

---

## 0. Жёсткое правило (критично)

```text
baseline (не сломать) → одна фаза фикса → unit/hygiene → ручной smoke ранее собранного → следующая фаза
```

- **Не** смешивать все фиксы в одном непроверенном деплое.
- **Не** трогать D10 prices / C29c / pay-first / `tnved.json` / taurus.
- После **каждой** фазы — чеклист §6 «ранее собранное» должен быть зелёным (или осознанный rollback).

### 0.1 Baseline до любого diff (обязательно)

Зафиксировать «as-is зелёное» на prod (+ unit локально):

| # | Ранее собранное | Как проверить | Ожидание |
|---|-----------------|---------------|----------|
| B1 | Health / DB | `GET /health` | `ok`, `databaseUrl:true` |
| B2 | S3 upload | `POST /api/v1/uploads` (сессия client) | `storage:"s3"`, GET объекта 200 |
| B3 | C37b CSV/XLSX/PDF preview | `POST …/preview` sample files, STANDARD | 200, `rowCount=3`, `truncated` для 8 строк |
| B4 | C36 photo describe (если S3 ok) | `/cabinet/new` фото laptop sample | описание **не** сырой JSON; note «Описание заполнено…» **или** честный fail-open |
| B5 | Create+pay text (API) | EXPRESS текст «футболка хлопок» | calc DONE/AI_READY, HS≈6109, баланс −990 |
| B6 | PDF DONE | `GET …/calculations/:id/pdf` | 200 HTML «Отчёт» + код |
| B7 | C38 search «красная кружка…» | `GET /api/v1/tnved/search` | топ 6912 керамика, **не** нерка/лосось |
| B8 | C38 freemium chrome | `/cabinet/tnved` 1-й код → ставки; 2-й → lock/CTA | pill / «Оплатить и открыть код» |
| B9 | Unit якоря | vitest: product-import, morphology, hygiene, photo-first, pack, vision-describe, media-url | все green |

**Стоп:** если baseline уже красный (кроме известных багов ниже) — сначала triage, не новый фикс.

Записать результаты baseline в конец этого файла (§8) перед стартом кода.

---

## 1. Проблемы (из проверки) → гипотезы

| ID | Симптом | Гипотеза / зона | Риск регрессии |
|----|---------|-----------------|----------------|
| **P1** | Wizard «Создаём / Уточняем…», `POST /calculations` **status 0**, баланс не списан; API create напрямую ок | `ClientCabinet.createCalc`: `waitForAiEnrich` **до** `pay` при `payAfter`; долгий poll / abort `api()`; UI не fail-open | Высокий (весь `/cabinet/new`) |
| **P2** | Черновик кружки сначала `8471`, потом `6912` | heuristic first paint + late enrich; UI показывает ранний HS без пометки «уточняется» | Средний (доверие к коду) |
| **P3** | «ThinkPad 14» → бамбук `4421` выше `8471` | short digits / notes noise; возможно FTS-PR WIP; scoring не штрафует incidental `14` в notes | Средний (C38 ranking) |
| **P4** | Freemium peek не явен в UI | auto-`consumeFreePeek` на pick; pill только при `canReadRates`; 2-й код без lock copy | Низкий (C38 chrome only) |
| **P5** | Describe кладёт **сырой JSON** в textarea | mesh возвращает stringified JSON как `description`; `formatProductDescriptionForTnved` не unwrap JSON object string | Средний (C36 UX) |
| **P6** | WIP uncommitted / dirty deploy | процесс, не runtime | Процесс |

**S3 «EMPTY keys» в `vercel env pull`:** ложный сигнал CLI; Put/Get live ок. В C39 **не** перезаливать ключи без новой поломки upload.

---

## 2. Порядок фаз (одна за раз)

### Фаза A — P1 wizard create/pay hang (сначала)

**Идея:** при `payAfter` не блокировать оплату бесконечным enrich; показать промежуточный HS; таймаут/ошибка create → toast + `createPhase=idle`.

**Зона:** `ClientCabinet.tsx`, `NewCalcPane.tsx`, `ai-drain-client.ts` (только client-safe).

**Сделать:**
1. Порядок: `POST create` → optional short enrich wait (cap, напр. 15–30s) → **`pay`** → дальше poll enrich на шаге 3 без блокировки кнопки навсегда.
2. На abort/network error create: явный error toast, сброс phase (не залипать «Создаём…»).
3. Unit/structure: phase labels; не ломать `stayOnNew`.

**Не делать:** менять D11 pay-first server; менять тарифы.

**Gate после A:** B5 (API) + ручной UI text create→pay→код на экране ≤60s **или** честный error; B3/B7 без изменений.

### Фаза B — P5 vision describe JSON unwrap

**Идея:** если `description` выглядит как JSON `{"description":…,"attrs":…}` — распарсить до `formatProductDescriptionForTnved`.

**Зона:** `product-vision-describe.ts` (+ mesh parse если дубль), unit `product-vision-describe.test.ts`.

**Gate после B:** B4 — laptop photo → человекочитаемый текст; B5 без фото всё ещё ок; hygiene photo-first.

### Фаза C — P2 ранняя/поздняя классификация в UI

**Идея:** пока `llmEnrichPending` / drain — бейдж «черновик, уточняется»; не обещать финальный код; после enrich обновить HS на шаге 3 / карточке.

**Зона:** `NewCalcPane` step 3 + возможно `OrderDetail` (минимально).

**Gate после C:** кружка/ноутбук: UI не «врёт» финалом на heuristic 0.58; B6 PDF после DONE.

### Фаза D — P3 ThinkPad 14 / short-digit noise

**Идея:**
- не давать score-бонус / SQL-вес коротким digit stems (`len<4`) из смешанного текста;
- бонус multi-strong product stems (`ноутбук`/`thinkpad`/`laptop`);
- unit: `ноутбуки Lenovo ThinkPad 14` → `8471` ≫ `4421`.

**Зона:** `tnved-query-match.ts`, `tnved.ts` scoring/OR, morphology tests.

**Не делать:** ломать C38 «красная» (ceramic ≫ salmon) — регресс-тест обязателен.

**Gate после D:** B7 + ThinkPad query + футболка.

### Фаза E — P4 freemium peek chrome

**Идея:** явный pill «1-й просмотр ставки бесплатно» / «использован»; на 2-м коде — blur/lock + «Оплатить и открыть код»; не автоглотать peek без показа ставок.

**Зона:** только `TnvedDirectoryPane.tsx` + hygiene strings.

**Gate после E:** B8; wizard цены без 0 ₽ (C29c).

### Фаза F — процесс P6 (после зелёных A–E)

Коммит/PR по запросу; не смешивать с `.tmp-fts-scan/`; KB closeout в этом файле §8.

---

## 3. Не ломать (явный deny-list)

| Держать | Почему |
|---------|--------|
| C37b truncate sheet/PDF + `description`→name | иначе снова «не читает xlsx/pdf» |
| C38 weak color demotion | шум «красная» |
| C29c no 0 ₽ на `/cabinet/new` | freemium только directory peek |
| S3 allowlist / uploads | photo-first |
| Pay-after-create server invariants D11 | очередь после оплаты |
| НДС 22% / ПП 1637 copy | live directory |

---

## 4. Тесты

| Фаза | Unit | Ручной |
|------|------|--------|
| A | create-phase / enrich wait timeout (если выносим helper) | text create UI |
| B | JSON unwrap → plain RU text | photo laptop |
| C | (structure) enriching copy | кружка HS badge |
| D | ThinkPad 14; красная кружка | search API |
| E | hygiene freemium strings | 2 кода peek |

Минимум перед деплоем фазы: затронутые vitest + §6 smoke.

---

## 5. Деплой

- После зелёного gate фазы: `vercel --prod` (как сейчас) **или** commit+push по запросу.
- Не деплоить A+B+C+D+E одним комком без промежуточных smoke.

---

## 6. Чеклист «ранее собранное» (после каждой фазы)

Копия B1–B9. Дополнительно:

- [ ] Multi preview XLSX/PDF sample всё ещё 3 строки + truncate  
- [ ] «Красная кружка…» всё ещё керамика в топе  
- [ ] EXPRESS цена 990 на `/new` (не 0)  
- [ ] Upload S3 200  

---

## 7. Решения (лок до старта)

| Q | Решение |
|---|---------|
| Q1 порядок | **A → B → C → D → E → F** (hang и JSON раньше ranking) |
| Q2 pay vs enrich | **pay не ждать полный enrich** (короткий cap, затем poll на UI) |
| Q3 S3 keys | **не трогать**, пока Put/Get зелёные |
| Q4 FTS-PR WIP | **не включать** в C39, если ломает B7; отдельный план |

---

## 8. Журнал baseline / фаз

_Заполнять при выполнении._

| Когда | Что | Результат |
|-------|-----|-----------|
| _(2026-09-03)_ | Baseline B1–B9 | B1 health ok · B2 upload s3 200 (GET curl 200) · B3 csv/xlsx/pdf 3+truncate · B4 describe laptop plain RU (не JSON) · B5 #47829 EXPRESS 6109 DONE · B6 PDF Отчёт 200 · B7 керамика, no salmon · B8 pill не на empty DOM (P4) · B9 88/88 |
| | Фаза A | `AI_ENRICH_BEFORE_PAY_MS=15s` + payAfter short wait · dpl_F1ats… · UI create «Поло» #47830 DONE |
| | Фаза B | `coerceVisionDescribePayload` · dpl_FbTCjn… · B4 laptop plain RU · B3 xlsx 3+trunc · B7 керамика |
| | Фаза C | draft HS «Уточняется» + heroKicker(aiEnriching) · dpl_iabue9… |
| | Фаза D | ThinkPad 14 → 8471 ≫ 4421 · prose/FTS demote · dpl_3ybfB5… · B7 керамика ok |
| | Фаза E | freemium pill + lock CTA · peek после показа ставок · dpl_Haryfb… · B7/ThinkPad/B3 ok |
| | Фаза F | commit/PR C36–C39 без `.tmp-fts-scan/` и без FTS-PR WIP (отдельный [`plan-tnved-fts-pr.md`](./plan-tnved-fts-pr.md)) |

**Closeout:** A–E на prod; код в git через F; FTS-PR не в этом PR.
