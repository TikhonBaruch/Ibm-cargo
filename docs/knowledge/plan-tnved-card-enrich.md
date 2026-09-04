# План: отдельный раздел обогащения карточки ТН ВЭД (Card-Enrich)

**Дата:** 2026-09-04.  
**Цикл D33.** **Зона:** 3 Ядро (`src/lib/ved`, Prisma, scripts, dual-path card).  
**Канон:** [`plan-tnved-opendata-card.md`](./plan-tnved-opendata-card.md) · [`plan-tnved-fts-pr.md`](./plan-tnved-fts-pr.md) · [`customs-payments.md`](./customs-payments.md) · D15 · D24.

**Не:** scrape HTML CustomsOnline / Альта / TKS / tnved.info · wipe `tnved_codes` · правка `titleRu` · taurus DB (D37) · `--full` TWS на sweb.

## Идея

Коммерческие карточки (в т.ч. `ett_explain` на CustomsOnline) показывают 15+ полей «условия импорта/экспорта».  
Мы **не копируем** их HTML. Делаем **отдельный overlay-раздел** в LBM DB (как FTS-PR): машиночитаемые факты по коду, очищенные от скриптов/отсылок к донору, сверяемые с `tnved_codes`. Карточка `GET /v1/tnved/:code` показывает блок `cardEnrich` fail-open.

Цель среза 1: схема + санитайзер + кураторский pack (легальные слои) + load/reconcile + wiring в карточку. Полный bulk НТМ/сертификация — следующие срезы из официальных перечней.

## Анализ

| Наблюдение | Вывод |
|------------|--------|
| Поиск CO = 4 колонки; деталь `ett_explain` = полный список полей | Список полей — целевая **таксономия**, не источник ETL |
| CO `sit=tnved_rus_code_2022`, НДС-тексты с «20 %» | Устарело vs канон РФ **22%** с 01.01.2026 |
| Дерево LBM уже ~30k / ~13k листьев | Enrich **не** трогает дерево; только overlay |
| FTS-PR уже закрывает «предварительные решения» | Поле `preliminary_classification` → ссылка на `tnved_fts_*`, не дубль текстов CO |
| Layer G / paymentsHint / duty rate уже есть | Pack **проецирует** их в единый раздел + добавляет пустые слоты под будущие слои |

## Таксономия полей (`fieldKind`)

| kind | UI / смысл | Срез 1 источник | Статус |
|------|------------|-----------------|--------|
| `import_duty` | Ставка ввозной пошлины | `TnvedDutyRate` / pack | fill |
| `preferential_good` | Преференциальный товар (да/нет) | pack curated / later ЕЭК | stub |
| `temporary_import_duty` | Временная импортная пошлина | — | empty |
| `vat` | НДС | канон 22% · льготы hold | fill (22) |
| `excise` | Акциз | layer G `excisePossible` | trigger |
| `security_rate` | Ставка обеспечения | — | empty |
| `preferential_regime` | Преференциальный режим | pack / later | stub |
| `import_licensing` | Лицензирование импорта | layer G `ntmPossible` hint | trigger |
| `dual_use_import` | Двойное применение (импорт) | — | empty |
| `certification` | Сертификация | — | empty |
| `classification_confirm` | Подтверждение классификации | layer E decisions count | stub |
| `clearance_places` | Места оформления | — | empty |
| `export_licensing` | Лицензирование экспорта | — | empty |
| `dual_use_export` | Двойное применение (экспорт) | — | empty |
| `export_quota` | Квотирование экспорта | — | empty |
| `other_import` | Прочее (импорт) | — | empty |
| `other_export` | Прочее (экспорт) | — | empty |
| `preliminary_classification` | Предварительные решения | указатель на FTS-PR слой | pointer |

## Структура фаз

| Фаза | Что | Done when |
|------|-----|-----------|
| **A** | План KB + Prisma `TnvedEnrichSnapshot` / `TnvedEnrichFact` + migrate | schema в репо |
| **B** | Domain: kinds, `sanitizeEnrichText`, assemble `cardEnrich`, pack JSON | unit зелёный |
| **C** | CLI `tnved:card-enrich --load/--reconcile` | load pack → DB; reconcile vs `tnved_codes` |
| **D** | Wire `assembleTnvedCard` + dual-path api + contract bump | `cardEnrich` в GET :code |
| **E** | KB: README / data-model / opendata-card ссылка | закрытие цикла |

### Срез 2+ (hold, не этот PR)

- ETL преференций / временных ставок из ЕЭК.
- НДС 10% join ПП 908.
- Сертификация / лицензии / dual-use из официальных перечней (не CO).
- UI drawer секция «Условия» (D32) — после стабильного envelope.

## Инварианты

1. **Запрет scrape** CustomsOnline / Альта / TKS; донор только как **каталог полей** в этом плане.
2. Санитайзер удаляет `<script>`, `javascript:`, URL доноров (`customsonline`, `alta`, `tks`, `tnved.info`), HTML-теги.
3. Нет FK на `tnved_codes` (как FTS-PR) — reconcile отчётом, сироты допустимы.
4. Не менять `titleRu` / дерево / ставки ЕТТ этим пайплайном (ставки только **читаются** в pack builder).
5. НДС в enrich: **не** писать 20% из старых текстов; default 22%.
6. Писать только LBM `DATABASE_URL`, не taurus.

## Команды

```bash
npm run tnved:card-enrich -- --load
npm run tnved:card-enrich -- --reconcile
npm run test:unit -- src/lib/ved/__tests__/tnved-card-enrich.test.ts
```

**Срез 1 (2026-09-04):** schema + pack + sanitize + CLI + `cardEnrich` + dual-path + drawer «Условия» (filtered).  
**Статус:** restored on `feat/tnved-card-enrich` · не пишет `notes` · search ranking не тронут.  
**Не в этом срезе:** directory pane UI; ETL сертификации / НДС 10%.
