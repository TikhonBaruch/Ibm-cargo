# Контейнер client (D17) — элементы UI

**Код:** `src/components/ved/ClientCabinet.tsx` + `src/components/ved/client/*`  
**Routes web:** `app/cabinet/*` · **Extract:** `containers/client/app/*` (:3003, `NEXT_PUBLIC_CLIENT_BASE`)  
**Flag:** `NEXT_PUBLIC_SHIPPING_UI` — UI «Перевозка» (default **off**)  
**UI lab:** референс суперприложения на `/client` (`src/lbm-bro`). Live лицо — этот контейнер (`LbmCabinetsShell`). План: [`plan-lbm-bro-visual.md`](../../plan-lbm-bro-visual.md).

## Nav (`getClientNav`)

| Элемент | Route | Информирование | Взаимодействие |
|---------|-------|----------------|----------------|
| Главная | `/` · `/cabinet` | Superapp как у дизайнера: greet, consult/ЧЗ-stub, faq/guide, lookup, лента covers/chips, svc | Плитки → `/new` `/orders` `/support` `/faq` `/guide` `/tnved` `/brokers` `/clearance`; shipping/factory — плитки, не сайдбар |
| Заявки | `/orders` | Карточки (`.cl-order`): обложка, pill, «следующий шаг» D8 | Фильтры Все\|Готово\|У брокера\|Оплата; PDF при DONE; `onOpen` / pay без смены FSM |
| Справочник ТН ВЭД | `/tnved` | Combobox live `GET /api/v1/tnved/search` + карточка кода | Не `tnved.json`; CTA → `/new` |
| Чат | `/support` | IM-шелл: тикеты поддержки + ссылки на чат брокера по заявке | Голос → stub; FAQ → `/faq` |
| Компания | `/profile` | `.field` реквизиты | Тумблеры уведомлений макета → stub |
| Новый просчёт | `/new` (header CTA) | Wizard chrome (товар→тариф→запуск, поля не прячутся); лимит D10; heuristic top-N + **combobox ТН ВЭД** (`HsCodeAutocomplete`, `leafOnly`); **stage tip** + labels; **attr chips**; **FieldSuggest**; `tariff-mini` D10 | Форма + позиции + attrs + **строка производителя** + опц. SKU + **HS directory** + **upload** + **CSV** · [`plan-client-tnved-search.md`](../../plan-client-tnved-search.md) |

Шапка live: поиск заявки/товара/брокера + колокол (события D8) + CTA «Новый просчёт». Title скрыт на главной и wizard.

## Вложенные (не в side nav)

| Элемент | Где | Тип |
|---------|-----|-----|
| FAQ / гайд / ТО | `/faq` `/guide` `/clearance` | copy D10; hold-заметки в исходниках, без бейджа |
| Баланс / брокеры / перевозка / производитель | `/balance` `/brokers` `/shipping` `/factory` | плитки главной или deep-link; shipping/factory live только при флаге, иначе stub; factory live = `.card` / `.field` / `table.data` |
| OrderDetail | dash/orders | HS, **смета без доставки**, attrs, preferred, timeline |
| «Оплатить тариф» / «Пополнить до тарифа и оплатить» | OrderDetail | деньги |
| OrderChat + 📎 + waitingOn | OrderDetail | `.chat-box` / `.bubble` / `.chat-row`; poll 12с |
| EventsTimeline | OrderDetail | D24 история |
| KPI «Непрочитанных» | badge «Чат» | `GET chat?scope=unread` (CALC+SUPPORT, waitingOn=CLIENT) |
| Deep-link заявки | `/orders?id=` | Support / openCalc синхронизирует URL |
| Return `?topup=1` / intentId | Balance | acquiring return |

## API (поверхность)

`me` · `calculations` (+pay/pdf/events/**attr-suggest**/feedback) · `brokers` · `tariffs` · **`catalog/skus`** (PUBLISHED) · **`factory/requests`** (D34) · `chat` (+support) · `uploads` (local compose / S3 Vercel) · **`imports/products/preview`** (CSV/XLSX/PDF) · **`tnved/search`** (CLIENT, combobox NewCalc) · `company` PATCH/topup · `shipping` (+quotes) при flag on

**Upload:** `POST /api/v1/uploads` → `{ url, storage: "local"|"s3" }`. Compose: volume `ved_uploads`; `GET /uploads/ved/[uuid]` — [`runbook.md`](../../runbook.md).  
**CSV/XLSX/PDF:** `POST /api/v1/imports/products/preview` → grid; create через обычный `POST /calculations` (UI: «Создать заявку из таблицы»).  
**ТН ВЭД:** `GET /api/v1/tnved/search?leafOnly=1` с NewCalc (`HsCodeAutocomplete`) пишет только `attrs.hsHint`, не `hsCodeFinal` (D15). Поиск: `titleRu` / `notes` / префикс кода. После выбора — ссылка «Карточка кода» (`VedDetailDrawer`, полное имя, предки, пошлина из `TnvedDutyRate` или «нет в источнике», НДС 22%). Local fill ставок = `tws-csv` (не НСИ). Демо-корпус = официальные имена ФНС + синонимы в `notes`. Heuristic top-N рядом. Не LLM-CTA (D27).

## Panes (файлы)

`DashboardPane` · `ClientSuperappHome` · `NewCalcPane` · `FaqPane` · `GuidePane` · `TnvedDirectoryPane` · `ClearancePane` · `HsCodeAutocomplete` (shared `ved/`) · `FactoryPane` · `BrokersPane` · `ShippingPane` · `BalancePane` · `SupportPane` · `CompanySettingsPane` · `OrderDetail` · `OrderChat`

## Взаимодействия → другие роли

См. [`../shared/interactions.md`](../shared/interactions.md) и [`interactions.md`](./interactions.md).
