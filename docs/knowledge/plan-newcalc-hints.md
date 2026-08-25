# План: подсказки при заполнении «Новый просчёт»

Индекс: [`cabinets/client/README.md`](./cabinets/client/README.md) · [`calculation-fields.md`](./calculation-fields.md) · D27 / D32 / D33.  
Ветвь 1 (клиент). Без новых ролей, без LLM CTA, без hard-reject attrs.

## 1. Идея

На `/cabinet/new` клиент видит много полей без контекста «что писать и зачем». Нужны **короткие progressive tips** и labels в привычном UI кабинета — чтобы быстрее заполнить партию и attrs для брокера.

## 2. Анализ (as-is)

| Есть | Нет |
|------|-----|
| `HsHintCandidates` (heuristic top-3) | Labels у полей; один tip по этапу формы |
| Soft-warn STANDARD/PRO без attrs | Tip у сетки attrs до bottom-warn |
| SKU select / CSV / upload | Copy «когда полезно» у SKU/CSV/фото |
| Placeholders | Human copy для `hsHint`, ISO2 |

## 3. Структурирование

**Паттерн (D32):** contextual help = inline tip (1–2 строки) + существующий suggestion list / amber soft-warn. Не wizard, не Cmd+K, не второй toast.  
`StageTip` **не sticky** (не конкурирует с header/mobile nav VedShell). После soft-reject attrs — один amber banner, tip скрыт. Форма `max-w-2xl`; dropdown HS/manufacturer — `w-full` без `min-w`, `overflow-visible` на карточках позиций.

### E1 — stage tip + labels

Один tip сверху формы по состоянию: партия → HS → позиция → (attrs soft уже есть) → лимит D10.  
Labels как на Dashboard quick-calc (`text-xs font-semibold text-slate-500`).

### E2 — attrs / HS / helpers

- Quiet tip над сеткой attrs (STANDARD/PRO).
- Copy у `HsHintCandidates` / поля hsHint без жаргона.
- Одна строка у `SkuCatalogSelect` (если каталог есть) и у CSV/upload.

### E3 — hold

- Wizard / multi-step stepper
- LLM CTA / hard Zod reject attrs
- Domain/API changes

**Client HS autocomplete** вынесен в отдельный цикл: [`plan-client-tnved-search.md`](./plan-client-tnved-search.md) (этап 1 global). Больше не hold этого файла.

**Attr chips / 👍 черновик** — отдельный цикл: [`plan-llm-fill-hints.md`](./plan-llm-fill-hints.md) (не LLM CTA, heuristic session POST).

## 4. Реализация

| Фаза | Статус |
|------|--------|
| План | **done** |
| E1–E2 UI | **done** — `NewCalcHints` + labels/`StageTip` в `NewCalcPane`; copy HS/SKU/CSV |
| E3 | hold (wizard / LLM CTA); HS autocomplete → [`plan-client-tnved-search.md`](./plan-client-tnved-search.md) **срез 1 live** |

Файлы: `NewCalcPane.tsx`, `NewCalcHints.tsx` (FieldLabel + stage tip), опц. `HsHintCandidates` / `SkuCatalogSelect` / `ProductCsvImport`. KB: этот план + `calculation-fields.md` + client cabinets.

## 5. Проверка

- Ручной: пустая форма → tip партии; текст ≥8 симв. → HS + tip; STANDARD без attrs → amber; каталог → строка про эталон.
- `npm run test:ci` (UI-only; unit domain не обязателен).

## 6. Деплой

Merge → Vercel Hobby; migrate не требуется.

## Follow-up (2026-08-23) — «не видно онлайн»

Код E1–E2 был на `main`, но tip **почти нечитаем** (slate 11px на белой карточке) → воспринималось как «не работает».

Правки по D32 contextual help:
- `StageTip` → заметный sky callout + sticky
- attr chips: gate по title+description+name; idle/error copy вместо silent `null`
- Dashboard quick: тот же `StageTip`
- Broker work: tip, если нет `similarPrecedents`

