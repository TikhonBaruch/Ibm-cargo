# Контейнер client (D17) — элементы UI

**Код:** `src/components/ved/ClientCabinet.tsx` + `src/components/ved/client/*`  
**Routes web:** `app/cabinet/*` · **Extract:** `containers/client/app/*` (:3003, `NEXT_PUBLIC_CLIENT_BASE`)  
**Flag:** `NEXT_PUBLIC_SHIPPING_UI` — UI «Перевозка» (default **off**)

## Nav (`getClientNav`)

| Элемент | Route | Информирование | Взаимодействие |
|---------|-------|----------------|----------------|
| Дашборд | `/` · `/cabinet` | KPI: активные, у брокера, **производитель**, непрочит. | Быстрый AI-просчёт, фото, pay, открытие заявки |
| Заявки | `/orders` | Таблица №/товар/тариф/сумма/брокер/`StatusPill` | Фильтры Все\|Готово\|У брокера\|Оплата; PDF при DONE |
| Новый просчёт | `/new` (header CTA) | Лимит D10; heuristic top-N + **combobox ТН ВЭД** (`HsCodeAutocomplete`, `leafOnly`); **stage tip** + labels; **attr chips**; **FieldSuggest** (имя/страна/материал/бренд/состав); success | Форма + позиции + attrs (состав/тип/цвет/возраст) + **строка производителя (hints + propose)** + опц. SKU + **HS directory + candidates** + **upload** + **CSV** · [`plan-client-tnved-search.md`](../../plan-client-tnved-search.md) · [`plan-newcalc-hints.md`](../../plan-newcalc-hints.md) · [`plan-llm-fill-hints.md`](../../plan-llm-fill-hints.md) · [`plan-field-suggest.md`](../../plan-field-suggest.md) · [`plan-manufacturer-proposals.md`](../../plan-manufacturer-proposals.md) |
| Производитель | `/factory` | Сборный заказ; badge; `ManufacturerSuggest` | qty + SKU + пул; CTA просчёт ТН ВЭД; CSV WHOLESALE · D34 |

\*Скрыто без `NEXT_PUBLIC_SHIPPING_UI=1`.

## Вложенные (не в side nav)

| Элемент | Где | Тип |
|---------|-----|-----|
| OrderDetail | dash/orders | HS, **смета без доставки**, attrs, preferred, timeline |
| «Оплатить тариф» / «Пополнить до тарифа и оплатить» | OrderDetail | деньги |
| OrderChat + 📎 + waitingOn | OrderDetail | диалог; poll 12с |
| EventsTimeline | OrderDetail | D24 история |
| KPI «Непрочитанных» | Dashboard + badge «Заявки»/«Поддержка» | `GET chat?scope=unread` (CALC+SUPPORT, waitingOn=CLIENT) |
| Deep-link заявки | `/orders?id=` | Support / openCalc синхронизирует URL |
| Return `?topup=1` / intentId | Balance | acquiring return |

## API (поверхность)

`me` · `calculations` (+pay/pdf/events/**attr-suggest**/feedback) · `brokers` · `tariffs` · **`catalog/skus`** (PUBLISHED) · **`factory/requests`** (D34) · `chat` (+support) · `uploads` (local compose / S3 Vercel) · **`imports/products/preview`** (CSV/XLSX/PDF) · **`tnved/search`** (CLIENT, combobox NewCalc) · `company` PATCH/topup · `shipping` (+quotes) при flag on

**Upload:** `POST /api/v1/uploads` → `{ url, storage: "local"|"s3" }`. Compose: volume `ved_uploads`; `GET /uploads/ved/[uuid]` — [`runbook.md`](../../runbook.md).  
**CSV/XLSX/PDF:** `POST /api/v1/imports/products/preview` → grid; create через обычный `POST /calculations` (UI: «Создать заявку из таблицы»).  
**ТН ВЭД:** `GET /api/v1/tnved/search?leafOnly=1` с NewCalc (`HsCodeAutocomplete`) пишет только `attrs.hsHint`, не `hsCodeFinal` (D15). Поиск: `titleRu` / `notes` / префикс кода. После выбора — ссылка «Карточка кода» (`VedDetailDrawer`, полное имя, предки, пошлина из `TnvedDutyRate` или «нет в источнике», НДС 22%). Local fill ставок = `tws-csv` (не НСИ). Демо-корпус = официальные имена ФНС + синонимы в `notes`. Heuristic top-N рядом. Не LLM-CTA (D27).

## Panes (файлы)

`DashboardPane` · `NewCalcPane` · `NewCalcHints` · `FieldSuggest` · `AttrSuggestChips` · `HsHintCandidates` · `HsCodeAutocomplete` (shared `ved/`) · `SkuCatalogSelect` · `FactoryPane` · `ProductCsvImport` · `BrokersPane` · `ShippingPane` · `BalancePane` · `SupportPane` · `CompanySettingsPane` · `OrderDetail` · `OrderResultFeedback` · `OrderChat`

## Взаимодействия → другие роли

См. [`../shared/interactions.md`](../shared/interactions.md) и [`interactions.md`](./interactions.md).
