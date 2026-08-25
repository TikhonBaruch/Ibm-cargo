# Источники корпуса ТН ВЭД и Пояснений

Инвентарь обновлён **2026-08-10**. Корпус: [`data/tnved/`](../data/tnved/).

## Эталон кодов и ставок (первоисточники)

Иерархия истины при merge в `normalize`:

| Приоритет | Источник | Пишет | URL / вход |
|-----------|----------|-------|------------|
| **1** | **НСИ ЕАЭС — СТНВЭДСТ** (код 043) | `code`, дерево, `titleRu`, базовая ввозная пошлина ЕТТ | [nsi.eaeunion.org](https://nsi.eaeunion.org/) · [opendata.eaeunion.org](https://opendata.eaeunion.org/) · API [apiodata](https://opendata.eaeunion.org/opendata/ru/api/apiodata) · Решение Коллегии № 113 |
| **2** | **ЕЭК ТН ВЭД + ЕТТ** | fallback дерева / titles; PDF archive; XLSX→tabular если есть | [catr/ett](https://eec.eaeunion.org/comission/department/catr/ett/) · Решение Совета № 80 |
| **3** | **TWS CSV (локальный drop-in)** | 10-значные листья + текст/разбор ввозной пошлины, пока NSI XML нет | `TWS_TNVED_*.csv` в корне llm или `TWS_TNVED_CSV=…` → `npm run tnved:parse-tws` |
| **4** | **ФТС открытые данные** | overlay: НДС, акциз, преференции (если dataset есть) | Реестр: [customs.gov.ru/opendata/list.csv](https://customs.gov.ru/opendata/list.csv) · `npm run tnved:fetch-fts`. Сейчас в list.csv **нет** полного классификатора ТН ВЭД/ЕТТ. |
| — | ЕЭК Пояснения (PSN) | только `notes.jsonl` | [catr/psn](https://eec.eaeunion.org/comission/department/catr/psn/) |

Поле `source` на записи: `eec-nsi` | `eec-ett` | `tws-csv` | `fts-opendata` | `inferred-parent` (PSN → notes).

### Runbook: ручной drop-in

Если OData/витрина требуют сессию:

1. Скачайте XML/JSON справочника СТНВЭДСТ с портала НСИ/opendata.
2. Положите как `data/tnved/raw/nsi-stnvedst/<YYYY-MM-DD>/catalog.xml` (или `.json`).
3. Dataset ФТС (CSV/XML) → `data/tnved/raw/fts-opendata/<date>/datasets/`.
4. Либо положите выгрузку листьев: `TWS_TNVED_….csv` в корень `Ibm-cargo/llm` и `npm run tnved:parse-tws`.
5. `npm run tnved:normalize && npm run tnved:export-import`.

Или задайте прямой URL: `NSI_XML_URL=… npm run tnved:fetch-nsi`.

СМЭВ (полноценный контур участника ВЭД) — future; сейчас REST/opendata + drop-in.

## Веб-зеркала (research 2026-08-08) — не scrape

**Решение: HTML/API-скреперы для этих площадок не нужны.** Коды+пошлина закрываем локальным парсером TWS CSV; пояснения — ЕЭК PSN; НДС/акциз/НТМ — ФТС/NSI/лицензия позже.

| Поле | [classifikators.ru/tnved](https://classifikators.ru/tnved) | [tnved.info/TnvedTree](https://tnved.info/TnvedTree/) | [alta.ru/tnved](https://www.alta.ru/tnved/) |
|------|-----------------------------------------------------------|------------------------------------------------------|---------------------------------------------|
| Дерево 2/4/6/8/10 | HTML-навигация | JSON `api.tnved.info/api/Tree/GetChildNodes` | HTML + поиск |
| Ввозная пошлина | нет | калькулятор `CalcCustomsPayments` (продукт) | да на карточке кода |
| НДС / акциз / НТМ | нет | через продукт/сессию | заявлено; детали в «Такса Онлайн» |
| Bulk dump | 2 PDF примечаний (не Excel классификатора) | нет; robots `Disallow: /API/` | API по договору |
| Актуальность | актуализация классификатора на сайте ~2022 | коммерческий продукт | активно обновляют ограничения |

Почему не scrape:
- **classifikators** — нет ставок; листья 10-значные часто 404; нет bulk Excel.
- **tnved.info** — дерево через API, но ToS/robots; тарифы за сессией.
- **alta.ru** — ToS/коммерция; bulk только по договору (`tnved:adapter-alta`).

Ручная QC-выборка по карточке Alta допустима; массовый HTML/API crawl в `data/tnved/` — нет.

## Не эталон

| Источник | Почему |
|----------|--------|
| Альта / ТКС / Консультант / tnved.info / classifikators | коммерция / ToS / зеркала; stubs только при ключе (`tnved:adapter-*`) |
| TWS CSV | удобный fill листьев+пошлины; provenance сторонний — ниже НСИ/ЕТТ |
| Сторонние Excel-агрегаторы | не первоисточник ЕЭК/ФТС |

## Инвентарь URL: что можно собрать

Легенда доступа: **OK** — бесплатный bulk / ETL готов; **PART** — индекс/UI/probe; **KEY** — ключ/договор; **GAP** — публично ожидается, файла нет; **NO** — не для корпуса (scrape запрещён политикой).

### ЕЭК — первоисточники

| URL | Что можно собрать | Доступ |
|-----|-------------------|--------|
| https://eec.eaeunion.org/comission/department/catr/psn/ | Оглавление + HTML/PDF пояснений по группам → `notes.jsonl` | **OK** (~219 notes; text via `tnved:parse-psn`) |
| https://eec.eaeunion.org/comission/department/catr/psn/doppsn.php | **ТОМ VI** (дополнения) | **OK** |
| https://eec.eaeunion.org/upload/files/catr/psn/psnNN.pdf | PDF пояснений по группам | **OK** |
| https://eec.eaeunion.org/upload/files/catr/psn/pravila.pdf | Правила интерпретации | **OK** |
| https://eec.eaeunion.org/comission/department/catr/ett/ | Индекс ЕТТ/ТН ВЭД, ссылки на PDF групп | **OK** (manifest ~101 PDF) |
| https://eec.eaeunion.org/comission/department/catr/ett/ru.2022/*.pdf | PDF групп + примечания к ЕТТ/ТН ВЭД | **PART** (архив; без OCR — не tabular) |
| Excel на catr/ett | Машиночитаемые код/ставка | **GAP** (на странице нет XLSX) |
| https://eec.eaeunion.org/comission/department/dep_tamoj_zak/klassifikatsiya-tovarov-v-sootvetstvii-s-tn-ved-eaes/resheniya-o-klassifikatsii-tovarov.php | Решения о классификации | **PART** (отдельный ETL не сделан) |

### НСИ / opendata ЕАЭС

| URL | Что можно собрать | Доступ |
|-----|-------------------|--------|
| https://nsi.eaeunion.org/ | SPA реестра НСИ | **PART** (UI) |
| https://nsi.eaeunion.org/portal?registryType=dictionary | Список справочников | **PART** |
| https://nsi.eaeunion.org/portal/api/registries/get-list-data | JSON: ~195 опубликованных паспортов | **OK** (метаданные реестра) |
| https://nsi.eaeunion.org/portal/043 | Паспорт «код 043» | **GAP** — открытый список не содержит СТНВЭДСТ; `043` ≠ ТН ВЭД |
| https://opendata.eaeunion.org/ · `/opendata/` | Витрина открытых данных (SPA) | **PART** |
| https://opendata.eaeunion.org/opendata/ru/api/apiodata | Документация API (HTML shell) | **PART** |
| https://opendata.eaeunion.org/odata/ | OData catalog (~34 entity sets) | **OK** (другие реестры) |
| https://opendata.eaeunion.org/odata/$metadata | Схема OData | **OK** |
| https://opendata.eaeunion.org/odata/Goodscollection_prod | Товары промреестра + поле `tnved` | **PART** (не классификатор/ставки) |
| http://opendata.eaeunion.org/odata/$metadata | Зеркало http | **OK** |
| https://portal.eaeunion.org/sites/odata/_api/ | Probe SharePoint-style | **GAP** (404) |
| СТНВЭДСТ XML/JSON (цель) | Полное дерево кодов + ввозные пошлины ЕТТ | **GAP** анонимно; drop-in `NSI_XML_URL` / `catalog.xml` |

### ФТС

| URL | Что можно собрать | Доступ |
|-----|-------------------|--------|
| https://customs.gov.ru/opendata/list.csv | Реестр открытых наборов (meta.csv) | **OK** (probe) |
| https://customs.gov.ru/opendata | HTML каталог | **PART** |
| https://customs.gov.ru/ | Портал | **PART** |
| https://data.customs.gov.ru/ · https://data.customs.ru/ | Витрины data | **GAP** (часто fetch fail) |
| https://edata.customs.ru/ | e-data | **PART** |
| https://tnved.customs.ru/ | ТН ВЭД ФТС | **GAP** (fail / не bulk) |
| Dataset ставок НДС/акциз/преф по ТН ВЭД | Overlay в `codes` | **GAP** в list.csv нет подходящего набора |

### Веб-зеркала (не scrape; QC / лицензия)

| URL | Что можно собрать | Доступ |
|-----|-------------------|--------|
| https://classifikators.ru/tnved | Дерево разделов/групп, текст, правила, единицы | **PART** (без ставок) |
| https://classifikators.ru/assets/downloads/tnved/*.pdf | 2 PDF примечаний к ЕТТ/ТН ВЭД | **OK** |
| https://tnved.info/TnvedTree/ | UI дерева | **PART** |
| https://api.tnved.info/api/Tree/GetChildNodes | JSON узлы (code, name, units) | **NO** bulk (robots `/API/`, продукт) |
| https://login.tnved.info | Auth продукта | **KEY** |
| https://www.alta.ru/tnved/ | UI классификатор | **PART** |
| https://www.alta.ru/tnved/code/{10digits}/ | Карточка: название, базовая пошлина, маркеры НДС/НТМ | **PART** UI-only |
| https://www.alta.ru/poyasnenia/PRED/ | Пояснения (HTML) | **NO** scrape |
| https://www.alta.ru/online-services/ | Описание REST API | **KEY** |
| https://www.alta.ru/taksa-online/ | Расчёт платежей | **KEY** / UI |
| http://www.tnved.online/ | Тест API Альта | **KEY** |

### ТКС (research + stub)

| URL | Что можно собрать | Доступ |
|-----|-------------------|--------|
| https://www.tks.ru/db/tnved/ | Хаб: дерево, goods, prim, АПУ, predecision | **PART** |
| https://www.tks.ru/db/tnved/tree/ | Lazy-дерево (POST CSRF): разделы→листы | **PART** UI |
| `POST …/tree/` `node_id` | JSON `{ID,CODE,TEXT}` | **NO** mass crawl |
| `POST …/tree/info/` `code` | HTML: пошлина, НДС, акциз, НТМ, ссылки на НПА | **PART** UI / **NO** scrape |
| https://www.tks.ru/db/tnved/prim/ · prim_2017/ | Пояснения по группам (HTML) | **PART** UI |
| https://www.tks.ru/db/tnved/goods/ | Примеры декларирования | **NO** (`robots` Disallow query) |
| https://www.tks.ru/db/tnved/apu/ | АПУ | **PART** |
| https://www.tks.ru/db/tnved/predecision/ | Решения о классификации | **PART** |
| https://www.tks.ru/tnvedapi/ | Коммерческий API | **KEY** |
| https://api1.tks.ru/tnved.json/json/`<key>`/… | ver / code.json / archive.zip (ставки, признаки) | **KEY** |
| https://api1.tks.ru/tree.json/json/`<key>`/… | Дерево + archive.zip | **KEY** |
| https://github.com/tkssoft/api.tks.ru-docs (TNVED.JSON.md, TREE.JSON.md) | Документация схемы | **OK** |
| https://calc.tks.ru/index/tnved | Калькулятор | **PART** UI |

### Локальный fill (не URL)

| Вход | Что собираем | Доступ |
|------|--------------|--------|
| `TWS_TNVED_*.csv` в корне llm | ~13k листьев + тариф → `tws-csv` | **OK** (уже в normalize) |

### Сводка корпуса

| Информационный слой | Бесплатно сейчас | Блокер |
|---------------------|------------------|--------|
| Пояснения HS | ЕЭК PSN (`notes.jsonl`, ~97 PDF) | — |
| 10-значные коды + названия | ФНС TNVED.ZIP + TWS CSV | эталон NSI XML |
| Пошлина (fill) | TWS → `tws-csv` в LBM **local** (~12.6k `%`) | НСИ СТНВЭДСТ |
| PDF ЕТТ по группам | ЕЭК catr/ett **101 PDF** (2026-08-17) | OCR вне скоупа |
| Решения о классификации | индекс HTML ЕЭК (413 ссылок) | PDF: старый DNS / 500 |
| НДС / акциз / НТМ | триггеры в LBM; НДС 22% + сбор | ФТС dataset или TKS/Alta KEY |
| Полный эталон СТНВЭДСТ | — | не в публичных 195 НСИ; KZ v4 403 |

Команды доп.: `tnved:fetch-classifications`, `tnved:fetch-kz`. LBM overlay: `tnved:compose` → local `tnved:load -- --full`.

Вне ТН ВЭД: smoke `http://127.0.0.1:4500|4700|…` — локальные сервисы матрицы; `$id` contracts `*.local` — схемы, не данные.

## Команды

```bash
npm run tnved:fetch-ett      # index + optional ETT_DOWNLOAD_PDF=1 / sheets
npm run tnved:parse-ett      # XLSX → raw/.../tabular.jsonl
npm run tnved:fetch-nsi      # НСИ/OData discovery + download
npm run tnved:fetch-fts      # ФТС opendata probe + datasets
npm run tnved:parse-tws      # локальный TWS CSV → raw/tws-tnved/.../codes.jsonl
npm run tnved:fetch-psn      # Пояснения (notes)
npm run tnved:parse-psn      # PDF→text (pdftotext) + том VI index
npm run tnved:normalize
npm run tnved:export-import

# эталонный прогон (коды/ставки; PSN отдельно для notes):
npm run tnved:corpus
```

Критерий полноты: `normalized/summary.json` — `codes >= 10000` или `leaves10 >= 5000`, иначе явный `gap` + `candidateLinks`.

Платежи без KEY: [`sources-payments.md`](./sources-payments.md).
