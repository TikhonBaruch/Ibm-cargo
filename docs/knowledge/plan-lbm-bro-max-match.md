# План: максимальный visual match live ↔ lab (C16)

**D33.** После сверки `/cabinet` (ibm-cargo) и `/client` (lbm-bro): дотянуть chrome клиента до макета, **не ломая** domain LBM.

Канон: [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) C3–C15 · D8/D10/D11 · НДС **22%** / ПП **1637**.

## 1. Идея

Live уже в суперприложении. Остались слои вёрстки, из‑за которых пара экранов «не то»: порядок полей `/new`, чипы списка заявок, поиск в шапке, copy плиток, developer-ноты на карточке/справочнике.

**Паттерн (D32):** тот же product-shell. Данные и CTA оплаты/PDF не подменять макетом.

## 2. Анализ (что можно / нельзя)

| Слой | Сейчас live | Макет lab | C16 |
|------|-------------|-----------|-----|
| Шапка `/new` | поиск скрыт | поиск есть | показать поиск; CTA «Новый просчёт» оставить |
| Шапка заявки | поиск есть | поиск скрыт | скрыть поиск на `/cabinet/orders/[id]` |
| `/new` single | фото → описание → страна | описание → страна → clarify → документы | тот же порядок; upload single = фото (функция) |
| Главная CTA | «Новый просчёт» | «Открыть мастер» | copy макета, href `/cabinet/new` |
| Список заявок | Все / Готово / У брокера / Оплата | Все / Оплата / ТН ВЭД / В работе / Готово | те же чипы + `liveFeedMatch` (D8) |
| Справочник subtitle | `GET /api/v1/tnved/search` | N позиций · источник | copy без API path; поиск live. Карточка chrome → C17 |
| Карточка: риск / 18000 / hold-тексты | developer notes | «Риск: Низкий», форма партии | chrome без жаргона; инвойс пустой (C8) |
| НДС / тариф / pay | 22% / D10 / D11 | 20% / Таможня / demo PDF | **не копировать** |
| Proto-bar, голос, freemium pay | нет | lab only | **не копировать** |

## 3. Фазы

| ID | Что |
|----|-----|
| C16a | Shell: search on `/new`, hide on order page; CTA всегда в шапке |
| C16b | Home copy + lookup без API path; svc-подписи как в макете |
| C16c | NewCalc single: порядок полей lab; clarify после страны |
| C16d | Orders: lab chips + поиск по №/товару; `OrderCover`; «Подробнее» не вместо Оплатить |
| C16e | OrderDetail + Tnved: убрать developer copy; пустой инвойс-слот |
| C16f | KB + hygiene + `test:ci` |

## 4. Не делать

Менять D8/D10/D11; фейковый 0 ₽ pay; НДС 20%; сбор 15 000; `tnved.json`; proto-bar; сплющивать admin nav; заменять WorkMapping.

## 5. Проверка

`/cabinet` и `/cabinet/new` визуально рядом с `/client` и `/client/new`. Список фильтров = макет, pay/PDF живые. Карточка: timeline + НДС 22%. `npm run test:ci`.
