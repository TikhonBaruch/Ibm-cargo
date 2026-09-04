# План: починить `test:ci` (Cov-P12 + typecheck/vitest noise)

**D33.** Дата: 2026-09-04.  
**Статус:** **done** 2026-09-04. `npm run test:ci` зелёный.  
**База:** `origin/main` @ `40790f7`. **Не** `feat/newcalc-directory-hints`.  
**Канон:** [`plan-hint-coverage-expansion.md`](./plan-hint-coverage-expansion.md) §Cov-P12 · [`plan-hint-gap-probe-run.md`](./plan-hint-gap-probe-run.md) · [`testing-branches.md`](./testing-branches.md).

## 1. Идея

Вернуть `npm run test:ci` как зелёный гейт **без** смены классификации, packs, кабинета и OCR. Падают не продукт, а контракт теста и слишком широкий include.

## 2. Анализ (безболезненно)

| Красное | Причина | Чинить так | Не чинить так |
|---------|---------|------------|----------------|
| P12 «сок апельсиновый» → 2202 vs 2009 | Словарь P12 устарел; P11 и cascade-fixture уже **2202** | `searchPrefix`: `2009` → `2202` | Менять cascade / aliases на 2009 |
| P12 «халат» → 6107 21 vs `610\|6210` | Ассерт делает `replace(/\D/g)` → сравнивает с `6106210` | Matcher: split по `\|` | Менять pack 6107 |
| `layer: "ENRICH"` | Overlay есть, в union нет | Добавить `"ENRICH"` в тип | Удалять слой |
| pdf-lib / `.next/dev` | `include` `**/*.ts` + `.next/dev/types` тянет `app/node_modules` | exclude `**/node_modules/**`, `.next/dev`; убрать `.next/dev` из include | Патчить pdf-lib |
| `probe-search-false-friends.ts` | import `.mjs` без types | `@ts-expect-error` на этот import | Исключать все `scripts/` |
| Vitest `app/node_modules/tsconfig-paths` | exclude только `node_modules`, не вложенный | `**/node_modules/**` | xfail |

Продуктовый UX не меняется. Dual-path / API / migrate не нужны.

## 3. Фазы

| # | Что |
|---|-----|
| A | P12: `hsPrefixMatches` (альтернативы через `\|`) + juice `2202` |
| B | `TnvedCardSource.layer` += `ENRICH` |
| C | `tsconfig.json` + `vitest.config.ts` exclude; `@ts-expect-error` на mjs import |
| D | KB + `npm run test:ci` |

## 4. Проверка

- `npx vitest run src/lib/ved/__tests__/hint-coverage-p12.test.ts`
- `npm run typecheck`
- `npm run test:ci` целиком зелёный
- Не регрессируют P11 «сок»=2202 и P15 «халат»=6107

## 5. Деплой

Merge в `main` → Vercel Hobby `ibm-cargo` (prod `ibm-cargo-phi`). Runtime кабинета не меняется. **Не** taurus-liart (D37). Preview не обязателен: нет UI.

Restore: git revert этого PR.
