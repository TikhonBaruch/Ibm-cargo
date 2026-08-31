# План: C35 offline-first HS + DeepSeek только на miss

**Дата:** 2026-08-31. **D33.**  
**Статус:** **implementing** — **C35a** на `main` (#33); **C35c** B1 (этот PR): ops count + smoke `skipReason`.  
Бриф: [`plan-offline-first-hs-brief.md`](./plan-offline-first-hs-brief.md).  
Канон: [`ai-pipeline.md`](./ai-pipeline.md) · [`plan-classify-cascade-c23.md`](./plan-classify-cascade-c23.md) · [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) · [`plan-ai-chains-1-2-3.md`](./plan-ai-chains-1-2-3.md) · D27 / D35 / D36.

**Код:** C35a [#33](https://github.com/TikhonBaruch/Ibm-cargo/pull/33). C35c branch `cursor/c35c-precedent-smoke-e1f0`. Morph hints [#34](https://github.com/TikhonBaruch/Ibm-cargo/pull/34) **merged** в `main`.

---

## 1. Идея

Закрепить продуктовый порядок: **БД/каталог → LLM**. DeepSeek / chain classify — fallback при miss / низком conf / broker reclassify. Параллельно нарастить покрытие БД-2 и aliases, чтобы offline hit-rate рос.

```text
create / import row
  → precedent (v1 lexical / v2 vector*)
  → cascade-v1
  → heuristic-v1 (+ lookup corpus)
  → [gate] LLM / DeepSeek только если offline miss или conf < порога
  → AI_DRAIN overlay: тот же gate (не звать модель, если sync уже offline-hit с достаточным conf)
  → broker approve → write-back БД-2
```

\* vector на sweb = Won't этого цикла (нет extension); код path остаётся fail-open.

---

## 2. Ответы на бриф §8 (зафиксировано)

| # | Вопрос | Решение |
|---|--------|---------|
| 1 | Hit-rate sync vs `AI_DRAIN` | **Считать раздельно:** `hit.sync` и `hit.drain`. KPI цикла = **sync** на must-cover corpus; drain — отдельный ops срез (сколько overlay реально звали LLM). |
| 2 | Пороги conf | **Раздельные:** cascade prefer ≥ `CASCADE_CONF_THRESHOLD` (0.55 as-is); heuristic как сейчас; **LLM skip**, если выбранный offline draft имеет `confidence ≥ LLM_SKIP_CONF` (**0.72** default, env `LLM_SKIP_CONF`). Не один порог на всё. |
| 3 | Reclassify брокера | **Оставить как сейчас: всегда LLM classify, skip precedent** (feedback брокера важнее кэша). Не менять в C35. |
| 4 | CSV import | **Тот же offline-first порядок**, что create (уже частично в `product-import.ts`); выровнять gate A1 dual-path. |
| 5 | Admin UI покрытия БД-2 | **Won't** в C35. Ops: SQL count + `smoke:precedent-csv` + поля в chain-run-log / aiDraft tags. |
| 6 | Base branch | **`main`** (C28 stack уже влит). |
| 7 | A3 shadow 2∥3 | **Hold** — не в первом impl PR. |
| 8 | Precedent vector sweb | **Won't** этого цикла (pgvector отсутствует на host). Compose/local = Should later; lexical/fingerprint = Must. |

---

## 3. MoSCoW потоков A / B

### Поток A — цепочки / gate (Core + orch)

| ID | Тема | MoSCoW | Done when |
|----|------|--------|-----------|
| **A1** | Gate LLM only on miss после precedent+cascade+heuristic | **Must** | unit: при offline conf ≥ `LLM_SKIP_CONF` enrich/`classifyForChain` **не** вызываются; dual-path api = Next |
| **A2** | Метрики: `engine` + `llmEnrich` + `chainId` + `skipReason` | **Must** | tag на draft/job: `offline-hit` \| `llm-miss` \| `llm-low-conf`; fixture/smoke считает доли |
| **A4** | Keys checklist fail-open | **Should** | KB + smoke:mvp без `DEEPSEEK_API_KEY` → AI_READY |
| **A3** | Shadow chain 2∥3 | **Won't** (C35) | hold plan-ai-chains |

### Поток B — структура определений (Core + ops)

| ID | Тема | MoSCoW | Done when |
|----|------|--------|-----------|
| **B1** | Рост БД-2 + smoke precedent | **Must** | после N approve: `ops:precedent-count` total↑; повторный create → `precedent-v1` + `skipReason=offline-hit:precedent-v1` (`smoke:precedent-csv`) |
| **B2** | Alias / critical queries | **Should** | уже сильно закрыто C31/#24/O4; держать fixture зелёным; новые aliases только по miss-логам |
| **B3** | Нормализация fingerprint (attrs / CN-RU) | **Should** | unit: эквивалентные описания → один fingerprint / lexical hit |
| **B4** | Bulk seed approved CSV | **Could** | только если B1 мало данных; D15 no synthetic |
| **B5** | Vector на sweb | **Won't** | KB явно: lexical-only на Hobby/sweb |

---

## 4. Фазы реализации (после merge плана)

```text
C35a  A1+A2 gate + skipReason + unit (Next) + dual-path api  ← **done on main (#33)**
C35b  Dual-path containers/api зеркало A1  ← **folded into C35a**
C35c  B1 smoke precedent + KB ops count recipe  ← **this PR**
C35d  B3 fingerprint normalize (если miss в fixture)
C35e  Метрики на must-cover corpus ≥ цели §5; A4 checklist
—— hold ——
A3 shadow · B4 bulk · B5 vector · admin UI
```

**Параллельный трек (не C35):** morph hints H1–H3 ([`plan-tnved-hint-chains-audit.md`](./plan-tnved-hint-chains-audit.md) §4) — [#34](https://github.com/TikhonBaruch/Ibm-cargo/pull/34) **merged**.

Ownership: A → Core/orch; B → Core; UI panes **не** трогать в Must.

---

## 5. Контракты / dual-path

| Поверхность | Изменение |
|-------------|-----------|
| Draft / enrich | `llmEnrich` остаётся; добавить опционально `skipReason` / сохранить в `aiDraft` JSON (fail-open если старый reader) |
| `AI_DRAIN` | Перед classify: если calc уже `llmEnrich` ∈ {precedent*, cascade-v1} и conf ≥ skip → **settle without provider call** |
| Import preview | Тот же порядок + gate |
| Reclassify | **без** изменений (LLM) |
| Envelope | при новом поле — `docs/contracts` + sync; иначе только domain tags |
| Dual-path | `containers/api` create/import = Next (parity note) |

Model ≠ container (D35). UI не зовёт matrix (D27).

---

## 6. Метрики успеха (канон цикла)

| Метрика | Цель | Как мерить |
|---------|------|------------|
| Sync offline hit (`precedent*` \| `cascade-v1`) на must-cover / classify-cascade fixture + smoke corpus | **≥ 60%** | unit/fixture tags + optional script |
| Sync дошедших до LLM classify | **≤ 40%** на том же корпусе | inverse |
| Identical re-create после approve | **100%** precedent, 0 LLM | `smoke:precedent-csv` |
| Без `DEEPSEEK_API_KEY` | create → AI_READY, не 500 | `smoke:mvp` |
| Dual-path | одинаковый skip/engine order | parity note + unit |

Пороги 60/40 — канон **этого** цикла; пересмотр только ADR/KB.

---

## 7. Проверка

```bash
npm run test:unit          # gate + fingerprint
npm run test:classify-cascade
npm run test:ci
TEST_API_URL=<host> npm run smoke:mvp
TEST_API_URL=<host> npm run smoke:precedent-csv   # precedent-v1 + skipReason + CSV
DATABASE_URL=<app-db> npm run ops:precedent-count # C35c B1 count↑
# dual-path: USE_DOMAIN_API=0 vs 1 create smoke узкий
```

---

## 8. Жёстко не делать

- LLM CTA в кабинете  
- Multi-LLM parallel на один create  
- Убрать брокера / auto-DONE без ADR  
- nested `./llm` / taurus DB (D36/D37)  
- scrape Alta/TKS  
- Admin UI покрытия БД-2  
- Shadow 2∥3 и pgvector на sweb в этом цикле  

---

## 9. Связь с KB

| Файл | Действие при impl |
|------|-------------------|
| Этот план | статусы фаз C35a–e |
| Бриф | status → **planned → implementing** |
| [`plan-next-vector-c28.md`](./plan-next-vector-c28.md) | C35 → planned |
| [`ai-pipeline.md`](./ai-pipeline.md) | gate LLM skip + skipReason |
| [`dual-path-parity.md`](./dual-path-parity.md) | строка create/import gate |
| [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) | §Ops count recipe |
| [`runbook.md`](./runbook.md) | ops:precedent-count |
| [`current-app.md`](./current-app.md) | после ship |

---

## 10. Следующий шаг человека / агента

**Статус очереди:** #31/#32/#33/#34 **merged**. C35c = этот PR.

1. Merge этот PR (C35c).  
2. Далее C35d/C35e по miss; H4/H5 optional после стабильности.

Не смешивать с Preview SSO ops / mobile #21 / ЮKassa.  
Agent cannot merge — нужен human.
