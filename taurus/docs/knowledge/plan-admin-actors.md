# План: админ — карточки клиентов / брокеров / производителей

**Цикл D33:** идея → анализ → **этот план** → реализация → проверка → KB.  
**Паттерны D32:** `VedDetailDrawer` · form Save · `StatusPill` · `VedToast` · filter chips.  
**Не CTA D27:** админ не создаёт просчёт как основной flow.

## Идея

Админ видит и редактирует реквизиты трёх акторов платформы в существующих экранах `/admin/clients` и `/admin/brokers` (без нового CRM-shell и без трёх `UserRole`).

## Анализ

| Канон | Как не ломаем |
|-------|----------------|
| D25 | Signup публичный = CLIENT; завод только инвайт Users |
| D28 | Ops в `/admin`; audit без SUPER |
| D34 | Сегмент импортёра = `Company.clientSegment`, не отдельный кабинет |
| D15 | Тарифы / HS не из карточки брокера |
| Dual-path | Writers Next + `containers/api` |

## As-is → to-be

| Актор | As-is | To-be |
|-------|-------|--------|
| Импортёр | list + drawer + ADJUSTMENT | + PATCH реквизиты + `clientSegment` |
| Завод | фильтр в Clients, drawer calc-first | + stats SKU/пулы + PATCH реквизиты; calc secondary |
| Брокер | moderate + acceptingJobs | + drawer: specialization / languages / about |

## API

| Метод | Path | Кто |
|-------|------|-----|
| PATCH | `/api/v1/company/:id` | ADMIN — profile (+ segment только CLIENT) |
| GET | `/api/v1/company/:id` | + `kind`, `clientSegment`, `manufacturerStats?` |
| PATCH | `/api/v1/brokers` | + specialization / languages / about (рядом с status) |

`PROTECTED_V1_MUTATIONS`: `PATCH …/company/:id`.

## Фазы

| # | Сделать | Готово когда |
|---|---------|--------------|
| 1 | Этот план | файл в KB |
| 2 | Domain + unit | segment only CLIENT; empty patch ok |
| 3 | Session + dual-path | PATCH company/brokers |
| 4 | Drawers + list chips | D32 |
| 5 | cabinets + contract + `test:ci` | закрытие |

## Hold

Impersonation / segment preview · admin CRUD SKU · смена email · `segmentLockedByAdmin` · rating edit.

## Статус

**2026-08-15:** live — `PATCH /api/v1/company/:id`, broker profile fields, drawers, dual-path, `d-admin.actors.json`.
