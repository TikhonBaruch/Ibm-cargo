# План: ФТС предварительные решения → отдельный блок + сверка (FTS-PR)

**Статус:** done (load+reconcile+actualize на `newlsu_lbm` 2026-09-03) · код → PR · **Зона:** 3 Ядро (`src/lib/ved`, Prisma, scripts) · **D33**  
**Не:** `--full` TWS dump · правка `titleRu` · taurus DB (D37) · не путать с cabinet hardening [`plan-lbm-bro-prod-hardening-c39.md`](./plan-lbm-bro-prod-hardening-c39.md)

## Идея

Папка `/home/andrey/Загрузки/ТНВЭД-ФТС` — реестр **предварительных решений** ФТС (описание → 10-значный код), данные для сверки с `tnved_codes`. Внести **отдельным блоком** в Postgres LBM (`newlsu_lbm`), затем сверка и актуализация поискового слоя.

## Анализ

- Скан 103+ файлов: схема canon4; latest `CRU20260711` ≈ 3592 / 928 кодов.
- Все 928 кодов уже в main; дыр/inactive нет; ФТС **не** правит дерево.
- Редкие переклассификации внутри реестра (единицы); churn снимков не аддитивен.
- Канон: `.tmp-fts-scan/analysis-vs-main.md`.

## Структура

| Фаза | Что | Done when |
|------|-----|-----------|
| A | Prisma `TnvedFtsSnapshot` + `TnvedFtsDecision` | schema + migrate/db push |
| B | ETL `tnved:fts-pr --load` из папки (xls/xlsx, sha-dedupe) | строки в отдельном блоке; latest = `isCurrent` |
| C | `--reconcile` | отчёт: missing / inactive / reclass vs prior |
| D | `--actualize` | notes: why `ФТС предварительные решения` + токены поиска; **не** `titleRu` |
| E | unit + KB | test:ci затронутое · запись в README/data-model |

## Инварианты

1. Не мержить тексты ФТС в `titleRu`.
2. Layer E JSON (ЕЭК) не трогать — ФТС = отдельный слой.
3. Писать только в LBM `DATABASE_URL` (`newlsu_lbm`), не taurus.
4. Актуализация идемпотентна (повторный `--actualize` не дублирует why-строку).

## Команды

```bash
# DATABASE_URL из app/.env (sweb) или compose
npm run tnved:fts-pr -- --dir "/home/andrey/Загрузки/ТНВЭД-ФТС" --load
npm run tnved:fts-pr -- --reconcile --actualize
```

## Закрытие

Счётчики load + reconcile в `.tmp-fts-scan/fts-pr-load-report.json`; строка в `data-model.md` / README.

**Prod `newlsu_lbm` 2026-09-03:** load 99 снимков (4 sha-dup); current `CRU20260711.xls` 3592/928; missing/inactive **0**; notes overlay **928**; `titleRu` не меняли.
