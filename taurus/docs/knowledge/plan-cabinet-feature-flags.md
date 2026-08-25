# План: флаги скрытия лишнего (этап 1)

**Дата:** 2026-08-15.  
**Цикл D33.** План **до кода**. Этап 1 [`plan-global.md`](./plan-global.md).  
Паттерн D32: **не новый UI**, а тот же приём, что «Перевозка»: nav filter + redirect deep-link + не дергать API. Код panes **не удалять**.  
Канон флага: [`cabinet-features.ts`](../../src/lib/ved/cabinet-features.ts) · KB rule README §10 · [`current-app.md`](./current-app.md) · [`environments.md`](./environments.md).  
Не путать с platform-gates (`marketplaceEnabled` = список брокеров, не завод).

## Идея

На ближайшие сессии лицо продукта = **просчёт ТН ВЭД → брокер → PDF**. Завод, сборные, перевозка уже собраны — спрятать, чтобы не размывать демо. Когда этап 3 (mesh) живой, те же флаги = `1`, вторая сборка UI не нужна.

Скрыто ≠ вырезано: route, pane, dual-path API остаются. Как shipping.

## Анализ as-is

| Поверхность | Сейчас | Нужно на этапе 1 |
|-------------|--------|------------------|
| «Перевозка» | **скрыто** `shippingUiEnabled` (default off), redirect, API не с дашборда | оставить как есть |
| Клиент «Производитель» `/factory` | **в nav**, badge, KPI, CTA на дашборде, fetch `factory/requests` | скрыть |
| NewCalc: `ManufacturerSuggest` + SKU | **на каждой позиции** | скрыть |
| CSV / upload файла | на NewCalc | **оставить** (это описание партии, не vision) |
| Поле URL маркетплейса | нет | не добавлять; флаг-заготовка на этап 4 |
| Смета без фрахта | карточка client/broker/admin | **оставить** (это ценность кода, не «лишнее») |
| Кабинет `/manufacturer` | полный nav у роли MANUFACTURER | **оставить** (инвайт ADMIN, не CTA лендинга) |
| Админ «Производители» | в группе Операции | скрыть пункт nav; route жив |
| Брокер: снимок SKU / suggest в attrs | если данные есть | снимок оставить read-only; suggest прятать с тем же factory-флагом |
| `marketplaceEnabled` | пустой список брокеров | **не** использовать как factory-flag |

Тест `getClientNav` сейчас **требует** пункт «Производитель» — после плана инвертировать.

## Что интегрируем (готовые фичи)

| Фича | Как |
|------|-----|
| `shippingUiEnabled` | Образец: parse `1`/`true`, default `0`; фильтр nav; `paneRaw === "shipping"` → dashboard; не fetch |
| `getClientNav(..., env)` | Второй filter: `/factory`, если factory off |
| Redirect в `ClientCabinet` | Как shipping: `/cabinet/factory` → home |
| Не fetch | Убрать `factory` из boot keys, если flag off (меньше 401/шум) |
| `DashboardPane` `factoryHref?` | Уже optional: не передавать href и KPI |
| `NewCalcPane` | Условный рендер ManufacturerSuggest / SkuCatalogSelect |
| `VedEmptyState` | Не нужен: hidden route = redirect, не «скоро» |
| Env docs | Строка в `environments.md` / `runbook.md` / `current-app.md` (правило KB §10) |
| Unit | `cabinet-features.test.ts` — factory off по умолчанию, on при `NEXT_PUBLIC_FACTORY_UI=1` |
| Extract `containers/client` | Тот же `ClientCabinet` — один флаг |

DRY: маленький `envTruthy(env, keys, defaultOff)` в `cabinet-features.ts`, чтобы не копировать парсер на каждый флаг.

## Два флага, не восемь

Не плодить env на каждый пункт меню.

| Флаг | Env | Default | Что прячет | Когда `=1` |
|------|-----|---------|------------|------------|
| `shippingUiEnabled` | `NEXT_PUBLIC_SHIPPING_UI` | **off** | nav/pane перевозка | этап 5 / 3PL |
| `factoryUiEnabled` | `NEXT_PUBLIC_FACTORY_UI` | **off** | клиент завод + NewCalc производитель/SKU + admin nav «Производители» + broker ManufacturerSuggest | конец этапа 3 / этап 5 |
| `ingestExtraUiEnabled` | `NEXT_PUBLIC_INGEST_UI` | **off** | будущие: URL страницы, vision-CTA «распознать фото» | этап 4 |

**Не отдельный флаг (оставить видимым):**

- Смета без фрахта — ядро D27 рядом с кодом (в [`plan-global.md`](./plan-global.md) она в скобках «скрыть»; здесь сознательно **не** прячем: иначе демо ТН ВЭД без платежей).
- CSV и обычный upload файла — вход в просчёт, не этап 4.
- Баланс, брокеры, чат, PDF, админ ТН ВЭД / заявки / тарифы.
- Кабинет завода для роли MANUFACTURER — иначе инвайт ведёт в пустоту. Прячем **клиентский** завод, не партнёрский кабинет.

Ключи только **env**, не ADMIN UI (D28: без URL/keys в настройках). Hobby: в Vercel не ставить `=1` на prod, как shipping.

## Поведение UI

```text
factory off
  клиент nav без «Производитель»
  /cabinet/factory → дашборд
  дашборд без KPI/ссылки завода
  NewCalc: имя позиции + HS + attrs, без combobox завода/SKU
  не вызывать GET /factory/requests
  админ: пункт «Производители» скрыт; /admin/manufacturers по прямому URL работает
  брокер: FactorySkuSnapshot если item уже с SKU; ManufacturerSuggest скрыт
```

Copy нигде не обещает «раздел скоро». Пункта просто нет.

## Срезы

### Срез 1 — factory flag (первый код)

1. `envTruthy` + `factoryUiEnabled` в `cabinet-features.ts`.
2. `getClientNav` / redirect / boot fetch / Dashboard props / NewCalc условный блок / admin `getAdminNav` filter / broker attrs suggest.
3. Поправить тест, что «Производитель» **нет** по умолчанию.
4. KB: current-app, environments, runbook, client/admin README, plan-global пункт 5.

Проверка: `test:ci`; ручной `/cabinet` без пункта завода; `/cabinet/factory` → дашборд; `/cabinet/new` без строки производителя; `NEXT_PUBLIC_FACTORY_UI=1` возвращает как сейчас.

### Срез 2 — ingest-заготовка

- `ingestExtraUiEnabled` + комментарий: URL-поле и кнопка vision **не добавлять**, пока этап 4.
- Если на дашборде «+ фото» читается как OCR — переименовать в «файл для брокера» или прятать за этим флагом. Решение в срезе: **copy**, не вырезать input на NewCalc.

### Срез 3 — hold

| Тема | Почему |
|------|--------|
| Флаг в `/admin/settings` | D28; дубль с env Hobby |
| Ломать API завода | Скрываем UI; dual-path жив |
| Редирект `/manufacturer` | Роль должна работать |
| `marketplaceEnabled` как factory | Другой смысл |
| Прятать смету без фрахта | Ломает демо кода+платежей |
| Прятать CSV | Нужен для нескольких позиций ТН ВЭД |
| Восемь env на каждый pane | Неподдерживаемо |

## Не делать

- Удалять `FactoryPane` / manufacturer routes / shipping.
- Второй сайдбар «только ТН ВЭД».
- Wizard «режим демо».
- Включать shipping «чтобы проверить флаги».

## Готово (срез 1)

Клиент видит дашборд / заявки / новый просчёт / брокеры / баланс / поддержку / профиль. Завод и SKU не светятся. Перевозка по-прежнему off. `FACTORY_UI=1` возвращает скрытое без нового UI.
