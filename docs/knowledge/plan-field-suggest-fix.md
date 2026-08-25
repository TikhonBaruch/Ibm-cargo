# План: починка typeahead описание / страна (NewCalc)

**Дата:** 2026-08-24. **D33** (bugfix).  
Канон: [`plan-field-suggest.md`](./plan-field-suggest.md) · [`design-patterns.md`](./design-patterns.md).

## 1. Идея

На `/cabinet/new` при наборе в **описании партии** и **стране происхождения / отправления** снова показывать локальные подсказки (D32 combobox). Производитель — stub (свободный ввод, без directory UX).

## 2. Анализ

| Симптом | Причина |
|---------|---------|
| «Китай» / «кит» в стране происхождения не даёт нормальный ввод | `maxLength={2}` + `toUpperCase` на каждый символ → ввод обрезается до «КИ» |
| Описание партии без выпадашки | `textarea` без `FieldSuggest` |
| Manufacturer «не ищет» | out of scope → stub |

## 3. План → сделано

1. `originCountry`: ISO-2 только на pick / `resolveBlur` (`resolveOriginCountryCode`).
2. `partyDescription` + `shipCountry` словари; `FieldSuggest` multiline.
3. `ManufacturerSuggest` → stub (free text).
4. Unit + KB.

## 4. Статус

| Срез | Статус |
|------|--------|
| План | **done** |
| Fix | **done** |
| KB | **done** |
