# Источники: таможенные платежи (без KEY)

Инвентарь **2026-08-11**.  
Канон в единой KB Taurus: [`../../taurus/docs/knowledge/customs-payments.md`](../../taurus/docs/knowledge/customs-payments.md).

## Без платных ключей (делаем)

| Слой | Источник | Действие |
|------|----------|----------|
| НДС default | НК РФ, с 01.01.2026 **22%** | stub `/v1/duty` + Taurus heuristic |
| Таможенный сбор | ПП 1637 / 1638 | шкала в Taurus `customs-fees.ts` |
| Коды + пошлина | TWS / ЕЭК | Taurus local: `tws-csv` overlay (~12.6k `%`); llm `codes.jsonl` |
| Пояснения | ЕЭК PSN PDF + том VI | `tnved:fetch-psn` / `tnved:parse-psn` → text |

## Hold / KEY позже

| Слой | Почему |
|------|--------|
| Акциз по коду | НК + атрибуты товара; Alta/TKS KEY optional |
| НДС 10% bulk | перечни ПП 908 — парсер follow-up |
| Утильсбор | ПП 1291 / 81 |
| НТМ | коммерческие витрины / НПА |
| NSI СТНВЭДСТ | не анонимно |

См. также [`sources-tnved.md`](./sources-tnved.md), [`sources-incoterms.md`](./sources-incoterms.md).
