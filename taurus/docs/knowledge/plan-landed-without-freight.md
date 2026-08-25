# План: смета белого ввоза без доставки

**Дата:** 2026-08-15.  
**Цикл D33.** ADR: D27 (не shipping CTA) · платежи: [`customs-payments.md`](./customs-payments.md).  
**Идея:** ориентир себестоимости партии **без международной логистики** (как бот Фомичева/VINLOG, но без 190 $/м³ и 40/60).

## Анализ

Бот считает landed cost: товар + агент 3,5% + фрахт + пошлина/НДС/сбор + оформление 2273 CNY.  
LBM MVP уже считает **пошлину + НДС 22% + сбор ПП 1637**. Доставка — hold.

Без доставки остаётся: **инвойс → ТС в ₽ → платежи → итог без фрахта**.  
Не копируем чужие коммерческие ставки (агент 3,5%, 2273 CNY).

**Упрощение ТС:** без фрахта до границы ТС = инвойс (FOB). В UI — дисклеймер.

## Структура

1. Domain `src/lib/ved/landed-cost.ts`: валюта USD/CNY/EUR, курс настроек, запас **+2%**, `goodsRub`, итог = товар + платежи, цена за штуку.
2. `computePayments` принимает готовый `customsValueRub` (не только USD×курс).
3. Create (Next + `containers/api`): парсинг инвойса, ТС с буфером, снимок в `aiDraft.landedWithoutFreight`.
4. UI: валюта на «Новый просчёт»; разбивка как строки инвойса (D32) у клиента и брокера; PDF.
5. ADMIN: курсы CNY/EUR и `%` запаса (дефолт 2). Live ЦБ — follow-up.

**Не входит:** фрахт, плотность 300 кг/м³, агент, оформление 2273, shipping UI.

## Проверка

Unit на парсер / CNY / буфер / `customsValueRub`.  
`npm run test:ci`. Ручной: партия в CNY → ТС ≠ «как USD».

## KB

Этот файл + [`customs-payments.md`](./customs-payments.md) · [`calculation-fields.md`](./calculation-fields.md) · [`cabinets/client/interactions.md`](./cabinets/client/interactions.md) · индекс README.
