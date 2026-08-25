# План: понятный UI импорта ТН ВЭД (admin)

**Цикл D33:** идея → анализ → **этот план** → реализация → проверка → KB.  
**Паттерны D32:** filter chips (режим) · form card (как тарифы) · CSV preview table (как `ProductCsvImport`) · search list (как `HsCodeAutocomplete`) · `VedToast` · empty state.

## Идея

Заменить «голый JSON + API path» на узнаваемый SaaS-экран: добавить одну позицию формой, пакет через CSV с превью, JSON оставить для продвинутых.

## Анализ

| Источник | Что берём |
|----------|-----------|
| `ProductCsvImport` | file/paste → preview grid → CTA «Применить» |
| `TariffsPane` | карточка полей + «Сохранить» |
| `HsCodeAutocomplete` / Clients chips | поиск и переключение режимов |
| Stripe/GitHub catalog ops | single create + bulk CSV, без «сырого» API в copy |

**Не делаем:** полный Track B dump UI, дерево всех кодов, правку ставок в drawer.

## API

Без новых endpoints. `POST /tnved/import` + `GET /tnved/search`.  
Клиент собирает `items[]` из формы/CSV (`normalizeHsCode` / `level` / `parentCode` / optional `rate`).

## UI

| Режим | Поведение |
|-------|-----------|
| Одна позиция | code + titleRu + dutyPct + vatPct + isLeaf → Импортировать |
| CSV | колонки `code,titleRu[,dutyPct][,vatPct]` · paste/file · preview ≤500 · Импортировать |
| JSON | текущий textarea + человеческий lead и образец |

Сверху: поиск «уже в справочнике» (`/tnved/search`).

## Готово когда

Админ без знания API добавляет код формой или CSV; success/error toast; KB cabinets admin обновлён.

## Статус

**2026-08-15:** live — `TnvedImportPane` режимы single/CSV/JSON + поиск; helpers `buildTnvedImportItem` / `parseTnvedCsv`.
