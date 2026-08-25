# Manufacturer — взаимодействия

| Действие | Эффект у других |
|----------|-----------------|
| Создать / править SKU | Эталон в `manufacturer_skus`; клиент на `/cabinet/new` выбирает **PUBLISHED** (`manufacturerSkuId` + снимок attrs) |
| Опубликовать SKU | Статус PUBLISHED; появляется в `GET /v1/catalog/skus` и в форме `/cabinet/factory` |
| Смотреть спрос | Счётчики `CalculationItem.manufacturerSkuId` после клиентского create |
| Принять запрос в сборку | `SkuOrderRequest` → `POOLED` в OPEN `SkuOrderPool`; клиент видит свой статус + qty пула (без чужих компаний) |
| Отклонить запрос | `REJECTED` + причина; клиент видит причину |
| Подтвердить сборку | пул `CONFIRMED`; не меняет `Calculation.status` (D8) |
| ADMIN create role=MANUFACTURER | Компания `kind=MANUFACTURER` + пользователь; нет публичного signup |

## Входящие

| Источник | Эффект |
|----------|--------|
| Клиентский просчёт с `manufacturerSkuId` | +1 к спросу SKU |
| Approve → DONE | +1 `demandDoneCount` |
| Клиент `POST /factory/requests` | строка в очереди «Сборные заказы» |

## Нет в UI

- Очередь брокера / pay / PDF
- Email пользователей-заказчиков (только название/ИНН компании)
- Оплата MOQ / отгрузка сборной партии
