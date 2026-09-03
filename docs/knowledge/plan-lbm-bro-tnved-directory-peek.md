# План: справочник — freemium peek + ранжирование длинных описаний (C38)

**D33.** Live `/cabinet/tnved`. Не ломать C17 chrome / C18 каталог / C29c (wizard без 0 ₽).

Канон: [`plan-lbm-bro-tnved-dir.md`](./plan-lbm-bro-tnved-dir.md) · [`plan-lbm-bro-tnved-catalog.md`](./plan-lbm-bro-tnved-catalog.md) · product C29c.

## 1. Идея

1. **Freemium peek (как lab chrome):** первый полный просмотр ставки/риска в справочнике бесплатно; следующий другой код — «Нужна оплата» + CTA в `/cabinet/new` (оплата заявки, не gейт домена). Wizard EXPRESS/STANDARD/PRO **без** 0 ₽.
2. **Длинные описания:** меньше шума (цвет «красная» → нерка/смородина). Поиск остаётся Postgres FTS/`contains` + scoring — **без** `tnved.json` в браузере.

## 2. Лок

| Слой | Что |
|------|-----|
| Search | Слабые модификаторы (цвета) не расширяют SQL OR, если есть ≥1 сильный стем; штраф хиту, который матчит только weak; бонус за покрытие нескольких strong; code-prefix только при `digits≥4` или code-only (чинит «ThinkPad 14») |
| Freemium UI | `sessionStorage` `lbm.tnved.freePeekHs` — не `consumeFreeHs` из lab store; pill «Первый раз бесплатно» / locked card; CTA → wizard |
| Не трогать | D10 prices, create-pay, C36/C37, `loadTnved` |

## 3. Не делать

- Freemium 0 ₽ на `/cabinet/new` (C29c)
- Browser classify / `tnved.json`
- НДС 20%

## 4. Проверка

Unit: «Красная кружка керамика…» ceramic ≫ salmon; «ноутбуки … 14» не топит группу 14.  
Ручной: `/cabinet/tnved` → длинное описание → короткий топ; 2-й код → locked chrome.  
`vitest` morphology + hygiene.
