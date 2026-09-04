# План: port C36–C39 на текущий main (минимальное влияние)

**D33.** Дата: 2026-09-04.  
**Статус:** P0–P2+P4 ✓ · дальше P3 (preview truncate) · P5 opt.  
**Не:** merge/rebase [#67](https://github.com/TikhonBaruch/Ibm-cargo/pull/67) as-is · directory freemium peek из C38 · scoring/bamboo из #67 · смена default `AI_CHAIN` без отдельного решения.

**Контекст:** после сессии C36–C39 (#67 OPEN, CONFLICTING) на `main` собраны leaf-only, HS blur, related mask, card-enrich, C21 clarify, search FF/alias (#69–#84). Blind merge #67 ломает этот концепт. Port — только wizard/vision/pay-hang.

**Reference (read-only):** `origin/feat/c36-c39-cabinet-hardening` · старые планы C36/C37/C38/C39 на той ветке (на main их может не быть).

**Канон держать:** [`plan-tnved-directory-leaf-only.md`](./plan-tnved-directory-leaf-only.md) · [`plan-tnved-client-hs-blur.md`](./plan-tnved-client-hs-blur.md) · C21 clarify · search alias/FF.

---

## 0. Жёсткое правило

```text
одна фаза → unit → smoke регресса (directory/search/clarify) → следующая фаза
```

Не смешивать P0–P4 с handoff / directory / `tnved-query-match` scoring.

### Deny-list

| Не трогать | Почему |
|------------|--------|
| `TnvedDirectoryPane` freemium peek из #67 | конфликт с leaf-only + HS blur |
| `tnved-client-hs-mask` / related mask | privacy-концепт |
| `tnved.ts` / `tnved-query-match` scoring из #67 | FF/alias/bamboo уже на main |
| C21 clarify / hint-tree packs | собранный wizard |
| card-enrich | #84 |
| Default `AI_CHAIN` flip без env/ADR | D36 |

---

## 1. Фазы

| Фаза | Что | Зона | Gate |
|------|-----|------|------|
| **P0** | Create/pay: короткий enrich wait при `payAfter` (≤15s), затем pay | `ai-drain-client.ts`, `ClientCabinet.tsx` | text create→pay не висит минутами; баланс списывается; clarify ок |
| **P1** | `POST …/products/describe` + `coerceVisionDescribePayload` | NEW describe route + `product-vision-describe.ts`, access | unit unwrap; live describe → plain RU |
| **P2** | Photo-first single UI поверх текущего NewCalc + C21 | `NewCalcPane` (точечно) | фото → описание; clarify жив; нет 0 ₽ (C29c) |
| **P3** | Preview truncate / description→name (+ opt invoice vision) | preview, product-import, pdf-table | xlsx 3+trunc |
| **P4** | Draft HS «Уточняется» при enrich | NewCalc step 3 copy | badge при pending |
| **P5** | (opt) AI_CHAIN default — отдельно | env/registry | только после проверки Vercel env |

**#67:** не merge; закрыть/пометить superseded этим планом после зелёного P0–P4.

---

## 2. Регресс после каждой фазы

- `/cabinet/tnved`: leaf-only, HS blur после 3 цифр  
- Search «ноутбук» без бамбука в топе  
- C21 clarify на `/cabinet/new`  
- EXPRESS цена ≠ 0 ₽  

---

## 3. Журнал

| Когда | Фаза | Результат |
|-------|------|-----------|
| 2026-09-04 | План | KB + старт P0 |
| 2026-09-04 | P0 | `AI_ENRICH_BEFORE_PAY_MS=15s` · `createCalc` payAfter short wait · toast «код уточняется» · unit |
| 2026-09-04 | P1 | `product-vision-describe` + coerce · `POST …/describe` · access/proxy |
| 2026-09-04 | P2+P4 | photo-first single UI поверх C21 · draft «Уточняется» · structure tests |
| | P3 | |
| | P5 | |
