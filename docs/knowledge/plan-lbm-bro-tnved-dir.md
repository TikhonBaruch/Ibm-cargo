# План: справочник ТН ВЭД live = chrome lab (C17)

**D33.** Идея: `/cabinet/tnved` должен выглядеть и вести себя как lab `/client/tnved`, **не подменяя** живой справочник Postgres и канон платежей LBM.

Канон: [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) C3/C16 · [`plan-tnved-opendata-card.md`](./plan-tnved-opendata-card.md) · НДС **22%** / сбор **ПП 1637** · D15 (финал — брокер).

## 1. Идея

Lab (`ClientTnved` + `tnved.json` в браузере) — референс chrome: две колонки, чипы, 96 групп, правая карточка с pill / крупным кодом / пошлиной / НДС / заметками / риском / CTA «Оформить заявку по этому коду».

Live (`TnvedDirectoryPane` + `GET /api/v1/tnved/search` + `GET /api/v1/tnved/:code`) уже ищет по Postgres, но правая колонка — тонкий title + одна meta-строка, без автовыбора хита и без прокидки кода в `/cabinet/new`.

C17 = **chrome и взаимодействие lab**, данные и ставки — **ibm-cargo**.

## 2. Анализ (lab vs live)

| Слой | Lab `/client/tnved` | Live `/cabinet/tnved` до C17 | C17 |
|------|---------------------|------------------------------|-----|
| Данные | `public/lbm-bro/data/tnved.json` | `GET /api/v1/tnved/*` | **без изменений** |
| Шапка | `{N} позиций · {source}` | copy без API path, без счётчика | честный «живой справочник · НДС 22% / ПП 1637»; **не** выдумывать N из json |
| Поиск / чипы / 96 групп | да | да | оставить |
| Автовыбор | query → `hits[0]` | только клик | query → первый хит (клик другого хита разрешён) |
| Правая карточка | pill, группа, `.tnved-code`, why, metric-row, notes, риск, CTA | код + title + одна строка ставок | chrome lab |
| НДС | **20%** (demo) | 22% в meta | **22%** в `.metric` |
| Freemium | `consumeFreeHs` / «Первый раз бесплатно» / «Оплатить и открыть код» | `DesignerStub` (null, C9) | **не копировать** гейт; карточка всегда читаемая; pill «Справочник» |
| CTA | `prepareWizard` → `/client/new` | `/cabinet/new` без query | «Оформить заявку по этому коду» → `/cabinet/new?hs=&desc=` |
| Empty | pill «Справочник» + «Выберите группу…» | «Карточка кода» | copy lab |

**Паттерн (D32):** тот же product-shell, reuse `.tnved-read` / `.metric-row` / `.pill` / `.alert-box` из `globals.css`. Не второй drawer (`TnvedCodeCard` остаётся для QC/admin).

## 3. Фазы

| ID | Что |
|----|-----|
| C17a | Правая колонка = layout lab: pill, группа (`TNVED_GROUPS` по префиксу), `.tnved-code`, title, why, `.metric-row` пошлина + **НДС 22%**, `.tnved-notes`, риск, CTA |
| C17b | Empty: pill «Справочник» + «Выберите группу или введите запрос» |
| C17c | Автовыбор первого хита при текстовом запросе |
| C17d | CTA префилл `/cabinet/new`: `description` + `items[0].attrs.hsHint` из query `hs`/`desc` |
| C17e | View-model в `src/lib/ved/tnved-directory-read.ts` + unit; hygiene; KB |

## 4. Не делать

- `tnved.json` / `loadTnved` / `classifyProduct` как правда live
- НДС 20%; «Первый раз бесплатно»; `consumeFreeHs`; «Оплатить и открыть код»
- Фейковый риск «Низкий»; фейковый счётчик позиций
- Менять D8/D10/D11; freemium-оплату справочника
- Подменять `TnvedCodeCard` / admin import

## 5. Проверка

`/cabinet/tnved`: поиск «ноутбук», чип, группа 84 — правая карточка как lab (крупный код, две метрики, notes, риск). НДС **22%**, не 20%. CTA открывает `/cabinet/new` с описанием и кодом. `npm run test:ci`.
