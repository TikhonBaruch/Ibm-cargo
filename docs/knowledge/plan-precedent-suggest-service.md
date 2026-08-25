# План: precedent typeahead («Прецеденты из прошлых заявок»)

**Дата:** 2026-08-24. **D33.**  
Канон: [`feature-cycle.md`](./feature-cycle.md) · [`plan-field-suggest.md`](./plan-field-suggest.md) · [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) · [`design-patterns.md`](./design-patterns.md) · contract [`d-suggest.json`](../contracts/d-suggest.json).

## 1. Идея

Подсказки в полях NewCalc — не только статический словарь, но и **прецеденты из прошлых заявок компании** + broker-approved `verified_determinations`. Отдельный контейнер `containers/precedents`; UI через session BFF. Query guard блокирует SQL/script/musor до Prisma.

## 2. Анализ

| Было | Стало |
|------|-------|
| `field-suggest.ts` — client-only словарь | Словарь = fail-open хвост |
| Нет write-back в hints | Past calcs + verified_determinations read-only |
| Нет HTTP | `POST /api/v1/suggest/query` → opt-in `PRECEDENTS_SERVICE_URL` |

Hold: live LLM в инпутах; manufacturer directory API.

## 3. Структура

| Слой | Путь |
|------|------|
| Domain | `src/lib/ved/precedent-suggest/` — guard, search, schema |
| BFF | `app/api/v1/suggest/query/route.ts` |
| Container | `containers/precedents` — `:4800`, profile `scale`/`full` |
| UI | `FieldSuggest` — секция «Прецеденты из прошлых заявок» + «Справочник» |

**Query guard:** max 120 символов, min 2 meaningful chars, blocklist SQL/script. Prisma only — parameterized.

**Scope:** `companyId` пользователя для past calcs; verified_determinations — global read.

## 4. Реализация

| Срез | Статус |
|------|--------|
| Domain + guard unit | **done** |
| BFF + contract | **done** |
| Container precedents | **done** |
| FieldSuggest API wire | **done** |
| Compose + env | **done** |
| KB close | **done** (этот файл) |

## 5. Проверка

- Unit: `suggest-query-guard.test.ts` — normal RU text ok; `'; DROP` / `<script>` blocked.
- Ручной: NewCalc — ≥2 символа → dropdown с заголовком «Прецеденты…»; без сессии — 401; garbage query — пустой список, справочник остаётся.
- `npm run test:ci` после domain touch.

## 6. Деплой

Vercel: без `PRECEDENTS_SERVICE_URL` — in-process Prisma (Hobby ok). Compose scale: `precedents:4800`. Migrate не требуется (read existing tables).
