# План: собрать все легальные слои ТН ВЭД для определения кода

**Дата:** 2026-08-17.  
**Цикл D33.** План **до** выгрузки и кода.  
Канон: [`plan-tnved-opendata-card.md`](./plan-tnved-opendata-card.md) · [`ai-pipeline.md`](./ai-pipeline.md) · [`customs-payments.md`](./customs-payments.md). (Источники корпуса — LBM `scripts/data/tnved` / `containers/llm/data`; внешняя матрица не в этом репо, D36.)

## Идея

Закрыть **все бесплатные официальные слои**, которые помогают определить 10-значный код и смету. Не покупать Альту. Не скрейпить Таксу / TKS / tnved.info.

Цель не «модель 99%», а **полный пакет доказательств** для lookup + брокера: дерево, названия, пояснения, пошлина (если машиночитаема), решения о классификации, триггеры НТМ.

## Анализ (as-is 2026-08-17)

| Слой | Источник | На диске / в продукте |
|------|----------|------------------------|
| A дерево | ФНС `tnved.zip` | 30 051 узлов / 13 293 листьев (local Postgres) |
| B пошлина ЕТТ | НСИ СТНВЭДСТ / KZ JSON | **нет** (анонимный NSI GAP; KZ v3 = ссылка) |
| B fill | TWS CSV (сторонний) | parse 13 306 листьев / 12 622 со ставкой (2026-08-08); сырой CSV мог исчезнуть |
| C НДС/сбор | НК + ПП 1637 | в коде |
| D пояснения | ЕЭК PSN PDF | 191 PDF распарсены → `notes.jsonl` |
| E решения | страница ЕЭК | ETL не сделан |
| F НДС 10% | ПП 908 | hold |
| G акциз/утиль/НТМ | префиксы НПА | триггер, не ставка |
| PDF ЕТТ | catr/ett (~101 файл) | индекс есть, **PDF не скачаны** |

## Не делать

- HTML/API crawl alta.ru / tks.ru / tnved.info / classifikators.
- Грузить дамп в **prod** (`sweb`). Только local Postgres.
- Обещать 99% на черновике AI. Пакет = вход для QC / прецедента.
- Класть сырые ZIP/PDF в git.

## Структура фаз

### Фаза 0 — инвентарь

Что лежит в `scripts/data/tnved/` и `containers/llm/data/tnved/` (jsonl, TWS, PDF). Поиск TWS CSV в `~/Backups`, если пропал с диска.

### Фаза 1 — повторный fetch официального

| Команда / URL | Зачем |
|---------------|--------|
| `npm run tnved:fetch` (LBM) | ФНС zip, checksum |
| `tnved:fetch-nsi` / `fetch-fts` (llm) | повторный probe СТНВЭДСТ и list.csv |
| `ETT_DOWNLOAD_PDF=1 tnved:fetch-ett` | PDF групп ЕТТ + правила (юридический текст) |
| `tnved:fetch-psn` если нет PDF | пояснения |
| страница решений ЕЭК | индекс HTML + ссылки PDF → `classification-decisions` raw |
| data.egov.kz dataset | есть ли v4 JSON со `stavka` |

Rate-limit ~300 мс. Не CI.

### Фаза 2 — нормализация и overlay пошлины

1. `llm`: `tnved:parse-tws` (если CSV найден) → `tnved:normalize`.
2. `lbm`: `tnved:normalize` → `tnved:compose`.
3. Overlay `dutyPct` из llm `codes.jsonl` (`source: tws-csv`) на листья ФНС → `TnvedDutyRate.source = tws-csv` (не выдавать за НСИ).
4. `tnved:load -- --full` **только** `DATABASE_URL=local`.

Нет TWS и нет NSI → ставка на карточке остаётся `null`.

### Фаза 3 — индекс решений (слой E, минимальный)

Сохранить официальную HTML-таблицу ЕЭК + список PDF. Не парсить TKS predecision. Join к листьям — follow-up, если в таблице есть 10-значный код.

### Фаза 4 — проверка и KB

- `corpus-status.json`: nodes/leaves, `ettRates` (tws count или null), `classificationDecisions`, pdf counts.
- KB: этот план + as-is в `plan-tnved-opendata-card.md` + llm `sources-tnved.md`.
- Unit не обязателен, если нет нового runtime-парсера; если overlay в `compose` — узкий test на merge duty.

## Критерий «собрали всё возможное»

- Дерево ФНС актуально (checksum).
- PSN notes на месте.
- PDF ЕТТ скачаны **или** явный fail в meta (сайт отдал 0).
- NSI/KZ/FTS пробы записаны (даже GAP).
- TWS ставки наложены **или** в status «CSV не найден».
- Индекс решений ЕЭК лежит в raw.
- Prod БД не тронута.

## Hold после этой сборки

Alta/TKS KEY · полный join решений к листьям · НДС 10% парсер ПП 908 · OCR всех PDF ЕТТ в tabular · mesh/distributor.

## Результат 2026-08-17

| Слой | Итог |
|------|------|
| A ФНС | 30 051 узлов / 13 293 листьев (уже было) |
| B TWS fill | **13 239** rate-рядов, **12 622** с `%` в **local** Postgres (`source=tws-csv`). Не НСИ. Prod не тронут. |
| B НСИ / KZ | GAP: СТНВЭДСТ не в публичном списке; KZ API v4 **403** |
| C НДС/сбор | без изменений |
| D PSN | 96 групп с текстом; 97 PDF |
| E решения | индекс HTML: 413 ссылок / 24 PDF-URL; скачать PDF не удалось (старый `eurasiancommission.org` DNS, `docs.eaeunion.org` 500) |
| G триггеры | акциз 633 / утиль 662 / НТМ 2108 листьев |
| PDF ЕТТ | **101/101** скачаны (~34 МБ), XLSX на странице нет |

Повтор: `npm run tnved:compose` затем `env -u DATABASE_URL DATABASE_URL=postgresql://lbm:lbm@127.0.0.1:5432/lbm npm run tnved:load -- --full`.

## Проверка 2026-08-18 (D33 шаги 5–8)

**Канон:** пакет доказательств для lookup + брокера, не «модель 99%». Финал кода — `hsCodeFinal` (D15).  
**Зона:** ветвь 3 (ядро `src/lib/ved/tnved*`, CLI `scripts/tnved-*`) + KB. UI карточки — тот же drawer (D32), без нового кабинета.

### Результат проверки

| Проверка | Итог |
|----------|------|
| `npm run test:ci` | **PASS** — 347 unit, structure, 20 contracts, verify |
| Overlay TWS | unit `tnved-tws` / `tnved-card`: MIXED→COMBINED; fill `tws-csv` если нет НСИ |
| Local Postgres | 30 051 код; **13 239** rate / **12 622** с `%`; `source=tws-csv` |
| Prod / sweb | **не** загружали (`loadedProd: false`) |
| Сырые PDF/JSONL | gitignored; в git только `manifest.json` + `corpus-status.json` |

Fail-open в unit: `verifiedDetermination` стучится в `.env` БД (`lbm` auth fail) и **не** валит create — ожидаемо, не блокер CI.

### Анализ: что закрыто / что нет

Закрыто для **local**: дерево ФНС, PSN, триггеры G, fill пошлины TWS, PDF ЕТТ на диске, индекс решений.  
Не закрыто: эталон НСИ СТНВЭДСТ, KZ v4 (403), PDF решений (мёртвые URL), НДС 10%, join решений к листьям, OCR ЕТТ→tabular.

TWS — **сторонний fill**, не выдавать в UI как «ЕТТ ЕЭК». Карточка уже пишет `rate.source`.

### Hobby (бесплатный Vercel) — что деплоить

| Можно в git → Preview | Нельзя |
|------------------------|--------|
| Код overlay + тесты + CLI + KB | `codes.jsonl`, TWS CSV, 101 PDF ЕТТ, PSN PDF |
| Контракт карточки / dual-path Next | `tnved:load --full` на sweb (общая prod DB) |
| Demo-pack ≤500 | `WEB_SURFACE=slim`; второй `DATABASE_URL`; Cron чаще daily |
| Preview = тот же sweb, что prod | писать 13k ставок в preview «для проверки» |

Build на Hobby: `prisma generate` only, **без** migrate. Полный dump ТН ВЭД — **не** MVP CTA (D27). Merge в `main` этого среза **не** тащит кабинет завода / миграции D31–D34 (отдельный PR).

После push ветки: Vercel Preview. Prod https://ibm-cargo.vercel.app — только после merge в `main`. Smoke против preview: `TEST_API_URL=<preview> npm run smoke:mvp` (не грузить корпус).

**Деплой 2026-08-18:** [PR #7](https://github.com/TikhonBaruch/Ibm-cargo/pull/7). Preview падал на `npm run build`: TS `layer: "D"` при типе `"A"|"B"|"C"` (`tnved.ts:204`). Локальный Next типы пропускал; Vercel — нет. Правка слоёв A–G запушена (`d9e5619`). В `main` не мержили; TWS на sweb не грузили.

