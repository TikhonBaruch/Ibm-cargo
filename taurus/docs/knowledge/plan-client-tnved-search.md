# План: поиск ТН ВЭД у клиента (NewCalc)

**Дата:** 2026-08-15.  
**Цикл D33.** План **до кода**. Этап 1 [`plan-global.md`](./plan-global.md).  
Канон UI: **D32** combobox — [`design-patterns.md`](./design-patterns.md). Не LLM-CTA (**D27**).  
Связано: [`plan-newcalc-hints.md`](./plan-newcalc-hints.md) (E3 hold снимается этим планом) · [`data-model.md`](./data-model.md) §2.1 · [`cabinets/client/`](./cabinets/client/).

**Паттерн:** combobox справочника (как брокер) + рядом heuristic-список. Не wizard, не Cmd+K, не второй dropdown.

## Идея

Клиент на `/cabinet/new` ищет код **в том же Postgres-справочнике**, что брокер и админ. Выбор пишет только `attrs.hsHint` (черновик для брокера), не `hsCodeFinal` (D15). Create без кода по-прежнему жив: heuristic draft после отправки.

Сейчас клиент **может** по роли вызвать `GET /api/v1/tnved/search`, но UI этого не делает. Строка в [`cabinets/client/README.md`](./cabinets/client/README.md) («клиент не вызывает `/tnved/*`») — политика UI, не запрет API; после этого плана строку обновить.

## Анализ as-is

| Слой | Статус |
|------|--------|
| `searchTnvedCodes` + dual-path `/api/v1/tnved/search` | live; роль CLIENT уже в allow |
| `GET /api/v1/tnved/:code` + ставки | live |
| Брокер `HsCodeAutocomplete` | live; debounce 250 мс; warn «кода нет»; `onHint` пошлина/НДС |
| Админ поиск в `TnvedImportPane` | live |
| Клиент `HsHintCandidates` | live; **правила** `rankHeuristicCandidates`, не БД |
| Клиент поле hsHint | свободный `<input>` |
| Seed справочника | 9 листьев — поиск «ноутбук/смартфон» сработает, «любая обувь» — часто пусто |

Два разных сигнала нельзя сливать в один список: heuristic = «похоже по правилам»; справочник = «так называется в ТН ВЭД». Клиенту нужны оба, с разным copy.

## Что интегрируем (готовые фичи)

Переиспользовать, не изобретать:

| Фича | Откуда | Как на клиенте |
|------|--------|----------------|
| Combobox HS | `HsCodeAutocomplete` | Тот же компонент; `className` = поле NewCalc (`rounded-xl …`) |
| Поиск API | `/api/v1/tnved/search` | Уже CLIENT; `leafOnly=1` — клиенту листья 10 знаков, не главы |
| Lookup ставки | `/api/v1/tnved/:code` + `onHint` | Опц. тихая строка «пошлина ~N%» под полем; не финальная смета |
| Heuristic top-N | `HsHintCandidates` | Оставить **над** combobox; клик по-прежнему заполняет hsHint |
| Labels / stage tip | `FieldLabel`, `StageTip` | Copy: «найти в справочнике» vs «черновик по правилам» |
| Empty / no-hits | паттерн `VedEmptyState`, **inline** | Не полноэкранный empty; одна CTA: фокус на описание партии |
| a11y-ориентир | `ManufacturerSuggest` (listbox) | Не копировать propose; при выносе autocomplete — `aria-expanded` / Escape |

`HsCodeAutocomplete` сейчас в `ved/broker/`. Клиент не импортирует из broker (ветвь 1). **Вынести** в `src/components/ved/HsCodeAutocomplete.tsx` (рядом с `LandedWithoutFreightCard`). Брокер `WorkMapping` меняет только import. Второй combobox не писать.

## Структура UI на NewCalc

Порядок блока ТН ВЭД (одна карточка формы, без нового экрана):

```text
описание партии
  → HsHintCandidates          # «Черновик по правилам» (как сейчас)
  → на каждой позиции:
       FieldLabel «Код ТН ВЭД (черновик)»
       HsCodeAutocomplete     # справочник, leafOnly
       тихий hint ставок      # срез 2
  → attrs / вес / …
```

Copy поля: «Найдите код по названию или цифрам. Финал подтвердит брокер.»  
Не: «ИИ подобрал», «гарантия кода», кнопка «Распознать».

Поведение:

- Пустой ввод — нет выпадашки (как у брокера, порог 2 символа).
- Есть хиты — список код + `titleRu`; Enter/клик → `hsHint`.
- Ноль хитов при ≥2 символах — amber-строка: «В справочнике нет. Уточните описание — брокер разберёт» + фокус не на LLM.
- Код вручную (цифры не из списка) — можно, soft-warn как у брокера.
- Create **не** требует hsHint (smoke / EXPRESS без справочника).

## Срезы (отдельные циклы, не один гигантский PR)

## Статус

| Срез | Статус |
|------|--------|
| 1 Combobox на NewCalc | **live** — `HsCodeAutocomplete` в `ved/`; клиент `leafOnly`; heuristic рядом |
| 2 Empty + ставка | hold |
| 3 Hold-темы | hold |

### Срез 1 — combobox на позиции (первый код)

1. Вынести `HsCodeAutocomplete` в `ved/`.
2. Проп `leafOnly?: boolean` (клиент `true`, брокер без изменения).
3. Заменить raw input hsHint в `NewCalcPane` на autocomplete.
4. Stage tip: если нет heuristic, но форма заполнена — «Найдите код в справочнике по названию товара».
5. KB: этот план + client README (клиент **вызывает** search) + `plan-newcalc-hints` E3.

Проверка: `npm run test:ci`; ручной `/cabinet/new` — «смартфон» / `8517` при seed; брокер WorkMapping без регрессии.

### Срез 2 — пустой результат + ставка

- Inline empty (title + why + одна CTA «к описанию»).
- `onHint`: одна строка пошлина/НДС; не подменять карточку сметы после create.
- Empty seed: честно «в демо мало кодов» не обещать полный классификатор.

### Срез 3 — hold (не в ближайших сессиях)

| Тема | Почему hold |
|------|-------------|
| Синонимы в БД | Нет поля; отдельный цикл справочника |
| Полный dump Track B | Админ-импорт уже есть; не блокер UI · демо-корпус: [`plan-tnved-demo-corpus.md`](./plan-tnved-demo-corpus.md) |
| Dashboard quick-create | Нет поля HS; не раздувать дашборд |
| CSV-колонка «найти HS» | `ProductCsvImport` — после среза 1, если понадобится |
| Автоподстановка из heuristic в combobox | Уже есть клик по кандидату → hsHint |
| LLM classify с формы | D27 |
| Флаги завода / SKU | Другая задача этапа 1 [`plan-global.md`](./plan-global.md) |
| Фото / ссылка | Этап 4 |

## Не делать

- Новый dropdown «только для клиента».
- Писать выбранный код в `hsCode` / `hsCodeFinal` с формы.
- Hard-reject create без HS.
- Смешивать heuristic и DB в одном `<ul>` без подписей.
- Toast на каждый кейstroke поиска.
- Cmd+K по справочнику.

## Готово (срез 1)

Клиент находит код по названию/цифрам из `TnvedCode`; подсказка остаётся `hsHint`; брокер и PDF как сейчас; heuristic-список не удалён; нет второго визуального языка.
