# План: husky pre-commit — lint + logistics gate

Индекс: [`testing.md`](./testing.md) · [`plan-tech-debt.md`](./plan-tech-debt.md) §lint.  
Ветвь 3. D33.

## 1. Идея

Не дать закоммитить правки, ломающие **логистику / shipping** (D15 / D-SHIP): pre-commit гоняет линтер и unit-тесты logistics/shipping. Без `--no-verify` commit не пройдёт.

## 2. Анализ

| Есть | Нет |
|------|-----|
| Vitest (Jest-compatible API) | Jest как второй runner |
| `logistics.test.ts`, `shipping.test.ts` | husky / pre-commit |
| `eslint` + flat config | рабочий `npm run lint` (`next lint` FAIL на Next 16) |

## 3. Структурирование

### E1 — scripts

- `lint:logistics` — ESLint на logistics/shipping/graceful-shutdown + shipping route + тесты
- `test:logistics` — vitest: `logistics` + `shipping` + `api-sigterm.smoke` (без DB integration)
- `prepare`: `husky`

### E2 — husky

`.husky/pre-commit` → `npm run lint:logistics && npm run test:logistics`

### Hold

Полный `eslint .` / `test:ci` на каждый commit (медленно); второй runner Jest; DB `test:integration` в hook.

## 4. Реализация

| Фаза | Статус |
|------|--------|
| План | **done** |
| E1–E2 | **done** |
| Hold | hold |

## 5. Проверка

`npm run lint:logistics && npm run test:logistics` · пробный `git commit` (без `--no-verify`).

## 6. Деплой

Только tooling + KB. После `npm install` husky ставит hook через `prepare`.
