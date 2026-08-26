# План: честные stub + скрыть инвойс/qty/вес (C8)

**D33.** Ветвь 1–2 + Admin chrome. Без смены бэкенда / dual-path writers.  
Канон визуала: [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md). Поля: [`calculation-fields.md`](./calculation-fields.md).

## 1. Идея

Live-кабинеты уже в chrome lbm-bro (C3–C7). Нужно:

1. **Правдивое ядро D27** — описание → ТН ВЭД → оплата тарифа → брокер → PDF. Цифры только live.
2. **Честные заглушки** — hold-модули занимают те же слоты, что в макете; бейдж «Замысел дизайнера» снова виден (откат C5 `return null`).
3. **Временно скрыть** стоимость партии (инвойс), количество и вес. API поля остаются optional. Цена **тарифа** и пошлина/НДС — оставить (ядро сметы).

Цель сходства: визуал слотов ~95% за счёт stub; достоверность продукта ~80–85% (ядро живое, hold не притворяется).

## 2. Анализ

| Было | Проблема |
|------|----------|
| `DesignerStub` → `null` (C5) | Сетка суперприложения «дырявая», ЧЗ/ТО/freemium нечитаемы |
| Форма create + quick-calc шлёт `shipmentValue: 18000` | Фейковый инвойс в БД |
| qty / unitPrice / netWeightKg в UI | Коммерческий блок макета «Таможня», не нужен во временном режиме |

Не делать: выдуманные KPI админа; бэкенд required; смена D10/D11; показ manufacturer/operator demo.

## 3. Фазы

| ID | Что |
|----|-----|
| C8a | `commercialInvoiceUiEnabled()` = `false` (restore: `true`). Скрыть инвойс/qty/вес на client/broker/admin UI; default create без `18000`. |
| C8b | Вернуть визуал `DesignerStub`. Слот hold = плитка + note. Не fake GMV. |
| C8c | KB: этот план + секция C8 в `plan-lbm-bro-visual.md` + `calculation-fields.md`. |

## 4. Проверка

Unit: cabinet-features + public-surface (stub badge снова в исходнике как live return, не `return null`) + factorySkuSnapshotLine `includeWeight: false`.  
`npm run test:ci`. Ручной: `/cabinet` — слоты ЧЗ/ТО/сопровождение видны как stub; create без полей инвойса/qty/веса; тарифная цена на месте; смета без строки инвойса (итого = платежи).

Restore: `commercialInvoiceUiEnabled` → `true`; при необходимости снова спрятать бейдж — отдельный ADR.
