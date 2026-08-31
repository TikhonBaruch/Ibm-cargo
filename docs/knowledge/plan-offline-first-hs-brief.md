# Бриф: offline-first ТН ВЭД + DeepSeek только на miss (C35)

**Дата:** 2026-08-31. **D33.**  
**Статус:** **planned** — детальный план: [`plan-c35-offline-first-hs.md`](./plan-c35-offline-first-hs.md).  
**Код:** только на ветке impl после merge плана; не из этого брифа.

Канон: [`feature-cycle.md`](./feature-cycle.md) · [`plan-next-vector-c28.md`](./plan-next-vector-c28.md) · [`ai-pipeline.md`](./ai-pipeline.md) · [`plan-ai-chains-1-2-3.md`](./plan-ai-chains-1-2-3.md) · [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) · [`plan-classify-cascade-c23.md`](./plan-classify-cascade-c23.md) · [`plan-ai-mesh.md`](./plan-ai-mesh.md) · [`plan-global.md`](./plan-global.md) этап 2 · D27 / D35 / D36.

Связанный диалог: «проверить DeepSeek; параллельно — цепочки classify + сборка определений в БД, чтобы не звать ИИ на каждый запрос».

---

## 1. Проблема (одной фразой)

Сейчас определение HS умеет идти в DeepSeek/LLM на промахе, но **нет явной продуктовой цели и метрик**, что доля живых запросов закрывается **из БД/каталога** (precedent + cascade + corpus), а LLM — редкий fallback; параллельная работа «улучшить цепочки» и «наполнить структуру определений» не оформлена как отдельный цикл с критериями сдачи.

## 2. Цель цикла (после детального плана)

Сделать classify **offline-first**:

```text
запрос на HS
  → 1) БД-2 precedent (fingerprint / lexical / vector*)
  → 2) cascade-v1 (code → alias → token index)
  → 3) heuristic-v1 (+ lookup corpus при наличии)
  → 4) DeepSeek / chain classify  ТОЛЬКО при miss / низком conf / reclassify
  → брокер-QC → approve → write-back в БД-2
```

\* pgvector — уже в коде; на части окружений hold/ops.

**Не цель:** убрать брокера, сделать LLM CTA, параллелить два LLM на один create, scrape Alta/TKS.

## 3. Зачем сейчас

| Боль | Почему бриф |
|------|-------------|
| Каждый «сложный» create тянет ключи/latency/деньги модели | Пользователь явно хочет часть определений **внутри БД** |
| C31 закрыл fixtures/aliases, но **hit-rate vs LLM** не измеряется | Без метрик нельзя планировать фазы |
| Цепочки 1/2/3 и БД-2 живут в разных планах | Риск дублировать LLM-работу вместо наполнения прецедентов |
| Prod/Preview без ключей всё равно жив (fail-open) | Offline path уже «главный» на многих деплоях — нужно закрепить как продуктовый контур |

## 4. As-is (инвентарь — не переизобретать)

| Слой | Где | Engine / tag | Зовёт ли DeepSeek |
|------|-----|--------------|-------------------|
| Precedent БД-2 | `verified_determinations`, `tryPrecedentDraft` | `precedent-v1` / `precedent-v2` | **нет** |
| Cascade | `tnved-classify.ts`, aliases, token index | `cascade-v1` | **нет** |
| Heuristic | `containers/ai`, `ai-draft-rules.json` | `heuristic-v1` | **нет** |
| Lookup corpus | `containers/llm` codes.jsonl / `TnvedCode` | `llm-lookup-v1` | нет (lexical); да — если дальше pick LLM |
| Chain classify | `AI_CHAIN_ID` 2\|3, `provider-mesh` / `LLM_SERVICE_URL` | `llm-openai-v1` и др. | **да** (DeepSeek default в chain 2/3) |
| Write-back | broker approve → `recordVerifiedFromApprove` | — | нет |

**Цепочки DeepSeek (как есть):**

| ID | Env | Vision | Classify |
|----|-----|--------|----------|
| 2 (default) | `AI_CHAIN_ID=2` | Qwen-VL | DeepSeek → Qwen failover |
| 3 | `AI_CHAIN_ID=3` | DeepSeek vision | DeepSeek only |

Create: HS overlay часто через `AI_DRAIN` (не двойной DeepSeek на sync create). UI модель не вызывает (D27).

## 5. Два параллельных потока работ (для планирования)

Планировать **двумя ownership-пакетами**, которые можно вести параллельно агентами/PR, с общей метрикой hit-rate.

### Поток A — «Цепочки» (orch / mesh)

**Зона:** Core · `src/lib/ved/chains/` · `provider-mesh` · `AI_DRAIN` · compose `llm`/`ocr`.  
**Вопрос планирования:** когда **разрешено** звать DeepSeek и как логировать miss.

Черновик подзадач (уточнить в детальном плане):

| ID | Тема | Гипотеза done-when |
|----|------|-------------------|
| A1 | Явный gate «LLM only on miss» после precedent+cascade+heuristic | create/import: DeepSeek не вызывается, если conf ≥ порога offline |
| A2 | Метрики/журнал: `engine` + `llmEnrich` + `chainId` + reason miss | admin/ops или chain-run-log: доля `precedent*` / `cascade-v1` / `llm*` |
| A3 | Shadow 2∥3 (опционально) | не ломает create; compare soft-fail (см. plan-ai-chains «позже») |
| A4 | Keys/env checklist Preview+prod | Mode A keys; Mode B `LLM_SERVICE_URL`; fail-open без ключа = offline-only |

**Не в A:** UI CTA «спросить ИИ»; новый Docker на вендора; nested `./llm` (D36).

### Поток B — «Структура определений в БД» (domain catalog / БД-2)

**Зона:** Core · `verified_determinations` · aliases / search-extras · cascade fixtures · ops seed.  
**Вопрос планирования:** как **нарастить** покрытие, чтобы A1 чаще срабатывал без модели.

Черновик подзадач:

| ID | Тема | Гипотеза done-when |
|----|------|-------------------|
| B1 | Ops: рост БД-2 после N approve; smoke precedent-csv | C31b закрыт числами (count + hit на повторном create) |
| B2 | Alias / invoice / must-cover packs под прод-запросы | fixture + critical queries зелёные; `tnved:load -- --search-extras` задокументирован |
| B3 | Нормализация «описание → fingerprint» (attrs, CN/RU) | меньше ложных miss при том же тексте иначе написанном |
| B4 | (Опц.) bulk seed из broker-approved CSV / lab | только approved pairs; не synthetic id (D15) |
| B5 | Vector path: когда включать на sweb/Preview | env + backfill; иначе lexical-only явно в KB |

**Не в B:** scrape чужих сайтов; wipe rates НСИ на sweb; финал HS без брокера.

## 6. Границы (жёстко)

| In | Out |
|----|-----|
| Offline path как **продуктовый** default | Параллельный multi-LLM router на один create (mesh срез 5 / D30 hold) |
| DeepSeek = fallback / reclassify / low-conf | LLM как клиентский CTA |
| Метрики hit-rate offline vs LLM | Замена брокера авто-DONE без ADR |
| Параллельные PR A∥B с общим brief | Правка nested taurus/`./llm` (D36) |
| Dual-path Next + `containers/api` при смене create | Shipping / ЮKassa / PWA в том же цикле |

## 7. Критерии успеха (черновик метрик — зафиксировать числа на планировании)

Планирование **обязано** выбрать пороги; ниже — стартовые кандидаты:

| Метрика | Кандидат | Источник |
|---------|----------|----------|
| Доля create с `llmEnrich` ∈ {precedent-v1, precedent-v2, cascade-v1} | ≥ 60% на must-cover / smoke corpus | fixture + smoke:csv / smoke:precedent |
| Доля create, дошедших до DeepSeek/LLM classify | ≤ 40% на том же корпусе; тренд вниз после B* | chain-run-log / aiDraft tags |
| Повтор идентичного approve-описания | 100% precedent hit без LLM | smoke:precedent-csv |
| Fail-open без `DEEPSEEK_API_KEY` | create → AI_READY без 500 | smoke:mvp |
| Dual-path | api create = Next по engine order | parity note |

Числа 60/40 — **не канон**, пока планирование не подтвердит на реальном fixture/prod sample.

## 8. Вопросы, которые должен закрыть детальный план (до кода)

1. Где считать hit-rate: только sync create, или sync + `AI_DRAIN` overlay отдельно?
2. Порог conf: единый для cascade vs heuristic vs «не звать LLM», или раздельные?
3. Reclassify брокера: всегда LLM (как сейчас) или сначала precedent skip — оставить?
4. Import CSV: тот же offline-first порядок, что create?
5. Нужен ли admin UI «покрытие БД-2» или достаточно ops SQL + smoke?
6. C35 base branch после merge C28 stack — `main` или tip вектора?
7. Входит ли A3 shadow 2∥3 в первый C35 PR или hold?
8. Precedent vector на Hobby/sweb: Must / Should / Won't этого цикла?

## 9. Планирование (закрыто 2026-08-31)

```text
[x] Ответить на §8 (1–8) — см. plan-c35 §2
[x] MoSCoW A/B — plan-c35 §3
[x] docs/knowledge/plan-c35-offline-first-hs.md
[x] plan-next-vector C35 → planned
[ ] Impl ветка cursor/c35-offline-first-impl-e1f0 — следующий цикл
```

## 10. Связь с вектором и горизонтом

| Документ | Роль |
|----------|------|
| [`plan-next-vector-c28.md`](./plan-next-vector-c28.md) | C35 в hold после C32; триггер = этот бриф углублён |
| [`plan-global.md`](./plan-global.md) этап 2 | «простые + векторные базы, ИИ: сначала онлайн, потом офлайн» → C35 = сдвиг к офлайну |
| C31 | fixtures/aliases — фундамент B; C31b ops ещё open |
| [`plan-ai-chains-1-2-3.md`](./plan-ai-chains-1-2-3.md) | A3 shadow 2∥3 |
| [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) | БД-2 write-back / vector |

## 11. Ownership (черновик)

| Поток | Ownership | Пакеты |
|-------|-----------|--------|
| A | Core (+ orch) | `chains`, `provider-mesh`, drain jobs |
| B | Core (+ Admin ops) | `verified-determinations`, classify aliases, tnved load |
| UI | Client only если нужен post-pay «почему код» без LLM | **не** обязателен в первом C35 |

Model ≠ container (D35): профили `AI_CHAIN_ID`, не `containers/deepseek`.
