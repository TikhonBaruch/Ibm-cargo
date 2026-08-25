# План: сборный заказ завода + сегменты клиента (D34)

**Цикл D33:** идея → анализ → **этот план** → реализация → проверка → KB.  
**Не CTA D27:** ТН ВЭД → брокер-QC → PDF на `/cabinet/new` не заменяется.  
**Паттерны D32:** очередь (как брокер triage) · empty state с одним CTA · `StatusPill` · native select · `VedToast`.

## Идея

1. Кабинет производителя подтверждает **запросы на заказ** и собирает их в **сборный заказ** (пул к MOQ/объёму).
2. В кабинете клиента — раздел «Завод / сборный заказ» и **три сегмента импортёра** (не три `UserRole`).

## Анализ

| Канон | Как не ломаем |
|-------|----------------|
| D8 / D11 / D15 | Статусы сборки **не** на `Calculation`. Завод не пишет финальный HS / `TariffPlan.priceRub`. |
| D25 | Нет публичного signup производителя. Сегмент — поле `Company`, роль остаётся `CLIENT`. |
| D26 | Не второй FSM заявки. Отдельные сущности `SkuOrderRequest` / `SkuOrderPool`. |
| D27 | Не лендинг, не shipping UI, не live pay, не LLM «угадай код». |
| D29 | Было Ecosystem hold. Этот срез — явный product ask: подтверждение хвоста в сборку. Не маркетплейс, не buyer-groups, не оплата MOQ заводу. |
| D31 | Каталог SKU + спрос без ПДн остаются. Спрос ≠ CRM; подтверждение заказа — отдельный pane. |
| Dual-path | Writers в `src/lib/ved` **и** `containers/api`. UI extract без Prisma. |
| ПДн | Клиент **не** видит имена других покупателей в пуле (только свой запрос + агрегат qty). Завод видит **название/ИНН компании**-заказчика (B2B confirm), не email пользователей. |

## Три сегмента клиента

Не взрывать `UserRole`. Поле `Company.clientSegment`:

| Код | Смысл | UI v1 |
|-----|--------|--------|
| `SINGLE` (default) | Единичные заказы | Одна строка SKU + qty |
| `RETAIL_SMALL` | Мелкая розница | Copy: мелкий qty идёт в сборку к MOQ |
| `WHOLESALE` | Опт, много запросов | Несколько строк + CSV `sku,qty[,note]` |

Переключатель — в **Профиле** и баннер в разделе завода. Выбор не меняет тариф D10 и не открывает shipping.

## Поток v1 (сборный заказ)

```text
CLIENT выбирает PUBLISHED SKU + qty
  → SkuOrderRequest SUBMITTED
MANUFACTURER видит очередь запросов
  → принять в OPEN пул (создать при отсутствии) → POOLED
  → или отклонить (причина) → REJECTED
  → «Подтвердить сборку» → CONFIRMED
CLIENT видит свой статус + суммарный qty пула (без чужих компаний)
```

Клиент отменяет только `SUBMITTED`. Оплата тарифа / claim брокера / PDF — другой контур.

## Структура

### БД

- `Company.clientSegment` enum, default `SINGLE`.
- `SkuOrderPool`: завод, SKU, `OPEN|CONFIRMED|CLOSED|CANCELLED`, optional `targetQty` (MOQ), `confirmedAt`.
- `SkuOrderRequest`: клиент-компания → PUBLISHED SKU, qty, `SUBMITTED|REJECTED|POOLED|CANCELLED`, optional `poolId`, optional `calculationId` (hold UI).

### API (dual-path)

| Кто | Метод | Path |
|-----|-------|------|
| CLIENT | GET/POST | `/api/v1/factory/requests` |
| CLIENT | POST | `/api/v1/factory/requests/bulk` (WHOLESALE, ≤50) |
| CLIENT | POST | `/api/v1/factory/requests/:id/cancel` |
| CLIENT | PATCH | `/api/v1/company` + `clientSegment` |
| MANUFACTURER | GET | `/api/v1/manufacturer/order-requests` |
| MANUFACTURER | POST | `…/order-requests/:id/accept` · `/reject` |
| MANUFACTURER | GET/POST | `/api/v1/manufacturer/pools` |
| MANUFACTURER | POST | `…/pools/:id/confirm` · `/close` |

Все POST в `PROTECTED_V1_MUTATIONS`. Контракт: `docs/contracts/d-order.consolidate.json`.

### UI

- Производитель: nav **«Сборные заказы»** `/manufacturer/pools` — очередь запросов + пулы. Empty: «Пока нет запросов».
- Клиент: nav **«Завод»** `/cabinet/factory` — форма запроса + список. Профиль: три карточки сегмента.
- Не второй drawer/toast/shell.

## Фазы

| # | Сделать | Готово когда |
|---|---------|--------------|
| 1 | Этот план + ADR D34 | файл в KB |
| 2 | Prisma + domain + unit | инварианты qty/SKU/статусы/ПДн |
| 3 | Session API + `containers/api` + PROTECTED | dual-path |
| 4 | Panes + routes web/extract | D32 empty/loading/error |
| 5 | Seed запрос + KB cabinets | `test:ci` |

## Срез v1.1 (клиент: мост к просчёту)

Дожать кабинет клиента без нового nav и без оплаты MOQ:

| # | Сделать | Паттерн |
|---|---------|---------|
| 6 | Карточка SKU (нетто, MOQ, кратность) + прогресс OPEN пула **без** чужих компаний | combobox + read-only card |
| 7 | CTA «Просчитать ТН ВЭД» с запроса → `/cabinet/new?sku=&qty=&request=` | deep-link prefill |
| 8 | После create — `calculationId` на своём запросе | POST `…/link-calc` |
| 9 | KPI дашборда + badge «Завод» (SUBMITTED/POOLED/CONFIRMED без calc) | как unread заявок |
| 10 | CONFIRMED: copy «партия набрана → просчёт», не оплата заводу | empty/next-step |

Hold среза: XLSX опта, шаблон CSV, оплата MOQ, отгрузка, buyer-groups.

## Hold (не в v1 / v1.1)

Публичная витрина · signup завода · оплата MOQ · отгрузка сборной партии · buyer-groups / Telegram · чужие ПДн клиенту · замена `/cabinet/new`.

## Проверка

- Unit: accept только PUBLISHED; cancel только свой SUBMITTED; client view без чужих `company.name`.
- `npm run test:ci`.
- Ручной: `client@` → Завод → запрос; `manufacturer@` → принять → подтвердить сборку.
