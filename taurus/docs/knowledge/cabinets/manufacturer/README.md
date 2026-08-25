# Контейнер manufacturer (D31/D34) — элементы UI

**Код:** `src/components/ved/ManufacturerCabinet.tsx` + `src/components/ved/manufacturer/*`  
**Routes:** `app/manufacturer/*` ≡ `containers/manufacturer/app/*` (:3004)

Отдельная ветвь: завод отдаёт эталон SKU и подтверждает хвост в **сборный заказ**. Не очередь брокера и не D8 просчёт.

## Nav (`getManufacturerNav`)

| Элемент | Route | Информирование | Взаимодействие |
|---------|-------|----------------|----------------|
| Дашборд | `/manufacturer` | SKU / published / запросы / открытые сборки | CTA в каталог |
| Каталог | `/catalog` | список артикулов, нетто, статус | Новый SKU; drawer редактор |
| Спрос | `/demand` | просчёты и PDF по SKU **без ПДн** | read-only |
| Сборные заказы | `/pools` | очередь `SUBMITTED` + пулы | принять / отклонить / подтвердить сборку |
| Превью | `/preview` | карточка как в просчёте клиента | выбор SKU; **nav label:** «Как видит клиент» |
| Профиль | `/profile` | реквизиты `Company.kind=MANUFACTURER` | PATCH company |

Header CTA: **Новый SKU** (на каталоге). Доступ: роль `MANUFACTURER`, инвайт ADMIN.

## Поля SKU (master-data)

Нетто / брутто / объём / Д×Ш×В изделия; состав + `features[]`; `packagings[]`; MOQ / инкотермс (цель пула).

## API

`/api/v1/manufacturer/dashboard` · `skus` · `skus/:id` · `company` · **`order-requests`** · **`pools`** (+ accept/reject/confirm/close)  
Dual-path: `src/lib/ved/manufacturer-sku.ts` + `sku-order.ts` · `containers/api/src/manufacturer-skus.js` + `sku-orders.js`.

## Нет в этом срезе

Публичная витрина, signup на `/register`, правка HS как истины (D15), оплата MOQ заводу, отгрузка сборной партии, CTA лендинга (D27), buyer-groups.
