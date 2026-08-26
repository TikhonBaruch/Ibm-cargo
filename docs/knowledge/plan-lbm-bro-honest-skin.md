# План: честные stub + скрыть инвойс/qty/вес (C8)

**D33.** Ветвь 1–2 + Admin chrome. Без смены бэкенда / dual-path writers.  
Канон визуала: [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md). Поля: [`calculation-fields.md`](./calculation-fields.md).

## 1. Идея

Live-кабинеты уже в chrome lbm-bro (C3–C7). Нужно:

1. **Правдивое ядро D27** — описание → ТН ВЭД → оплата тарифа → брокер → PDF. Цифры только live.
2. **Честные заглушки** — hold-модули занимают те же слоты, что в макете. Бейдж «Замысел дизайнера» **скрыт** (C9: `DesignerStub` → `null`, как C5).
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
| C8b | (история) вернуть визуал `DesignerStub`. Слот hold = плитка + note. |
| C8c | KB: этот план + секция C8 в `plan-lbm-bro-visual.md` + `calculation-fields.md`. |
| C9 | Скрыть блок «Замысел дизайнера»: `DesignerStub` → `null`; бейдж `.is-stub::after` выключен. Плитки hold остаются. Restore — комментарий в `designer-stub.tsx`. |

## 4. Проверка

Unit: cabinet-features + public-surface (`DesignerStub` → `null` + Restore visual в исходнике) + factorySkuSnapshotLine `includeWeight: false`.  
`npm run test:ci`. Ручной: `/cabinet` без блоков «Замысел дизайнера»; create без полей инвойса/qty/веса; тарифная цена на месте; смета без строки инвойса (итого = платежи).

Restore: `commercialInvoiceUiEnabled` → `true`; визуал stub — раскомментировать aside в `designer-stub.tsx`.
