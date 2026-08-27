# Единая база знаний (knowledge)

Канонический индекс продуктовой и инженерной документации LBM Брокер.  
Агенты начинают с корневого [`AGENTS.md`](../../AGENTS.md); этот файл — карта всего `docs/knowledge/` и связанных контрактов.

**Не дублировать** длинные ADR и сценарии здесь — только навигация, роли документов и правила обновления.

## Зачем

Одна база знаний, чтобы:

1. Ownership (клиент / брокер / ядро) не разъезжался между UI, API и контейнерами.
2. Инварианты D8–D15 / D24 проверялись и в тексте, и в CI (`test:structure`, unit).
3. Параллельные PR по контейнерам опирались на общие envelopes (`docs/contracts/`).
4. As-is (`current-app.md`) не путали с vision (`product.md`, `growth.md`); фокус MVP частник — **D27**.

## Точки входа

| Кто | С чего начать |
|-----|----------------|
| AI-агент / новый контрибьютор | [`AGENTS.md`](../../AGENTS.md) → этот README → [`skeleton.md`](./skeleton.md) |
| Продукт / роли / тарифы / фокус MVP (D27) | [`product.md`](./product.md) |
| Целевой клиент / ценность / стратегия (D29) | [`target-client.md`](./target-client.md) |
| Статус кода прямо сейчас | [`current-app.md`](./current-app.md) |
| Что делать дальше (фазы / post-polish) | [`roadmap.md`](./roadmap.md) · **горизонт 1–5:** [`plan-global.md`](./plan-global.md) · [`plan-mvp-polish.md`](./plan-mvp-polish.md) · **P0 Track A:** [`plan-track-a-p0.md`](./plan-track-a-p0.md) · **техдолг:** [`plan-tech-debt.md`](./plan-tech-debt.md) · **цикл фичи:** [`feature-cycle.md`](./feature-cycle.md) |
| Решение «почему так» | [`decisions.md`](./decisions.md) (D1–D34) |
| Структура данных (товары / ТН ВЭД / история) | [`data-model.md`](./data-model.md) (D24) |
| Инкотермс / комментарии ICC (Growth, не MVP CTA) | [`incoterms.md`](./incoterms.md) |
| Таможенные платежи (НДС/сбор; акциз/утиль/НТМ = триггер) | [`customs-payments.md`](./customs-payments.md) · смета без доставки: [`plan-landed-without-freight.md`](./plan-landed-without-freight.md) · карточка ТН ВЭД из opendata: [`plan-tnved-opendata-card.md`](./plan-tnved-opendata-card.md) |
| Dual-path / notify / gateway | [`dual-path-parity.md`](./dual-path-parity.md) · [`runbook.md`](./runbook.md) |
| Цепочка шагов + live проверка | [`chain-verification.md`](./chain-verification.md) |
| Прецеденты + CSV import (Growth local) | [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) |
| OCR / PDF / vision (`imageBase64`) | [`plan-ocr-vision.md`](./plan-ocr-vision.md) |
| Конвейер расшифровки (схема логистов) | [`plan-ai-mesh.md`](./plan-ai-mesh.md) |
| Гладкий create / smoke S3 / compress | [`plan-smooth-create-path.md`](./plan-smooth-create-path.md) |
| Журнал AI-цепочки + online probes | [`plan-chain-run-log.md`](./plan-chain-run-log.md) |
| Параллельная ownership + multi-model (D35) | [`plan-parallel-ownership.md`](./plan-parallel-ownership.md) · [`../../src/lib/ved/PACKAGES.md`](../../src/lib/ved/PACKAGES.md) |
| Go-live MVP standalone (D27+D36) | [`plan-go-live-mvp.md`](./plan-go-live-mvp.md) · max без pay/logistics [`plan-max-standalone-mvp.md`](./plan-max-standalone-mvp.md) |
| Изоляция / full split (**D36**) | [`decisions.md`](./decisions.md) D36 · [`plan-full-split-ibm-cargo.md`](./plan-full-split-ibm-cargo.md) · [`plan-zero-llm-coupling.md`](./plan-zero-llm-coupling.md) |
| Backup taurus (**D37**) | [`plan-taurus-backup-core.md`](./plan-taurus-backup-core.md) — read-only, не трогать |
| Vision до classify (таймаут / gate) | [`plan-vision-before-classify.md`](./plan-vision-before-classify.md) |
| LLM на заполнении + удачные прецеденты | [`plan-llm-fill-hints.md`](./plan-llm-fill-hints.md) |
| Typeahead полей NewCalc | [`plan-field-suggest.md`](./plan-field-suggest.md) · precedents [`plan-precedent-suggest-service.md`](./plan-precedent-suggest-service.md) · fix [`plan-field-suggest-fix.md`](./plan-field-suggest-fix.md) |
| Глобальный горизонт (этапы 1–5) | [`plan-global.md`](./plan-global.md) |
| ADMIN ops (гейты / интеграции / SUPER hide + cabinet UX) | [`admin-ops.md`](./admin-ops.md) (D28) · [`cabinets/admin/`](./cabinets/admin/) · **схема:** [`cabinets/admin/schema.md`](./cabinets/admin/schema.md) |
| HTTP-контракты контейнеров | [`../contracts/`](../contracts/) + [`core-dialogues.md`](./core-dialogues.md) |

Cursor rules: канон `ved-*.mdc` здесь; IDE — `npm run sync:cursor-rules` → `.cursor/rules/` (папка gitignore). Не дублировать руками.

## Слои документов

```text
AGENTS.md                    # краткие правила агента
docs/knowledge/              # единая KB (этот каталог)
  README.md                  # индекс (этот файл)
  skeleton.md                # каркас папок, запреты, checklist
  decisions.md               # ADR-lite D1–D34
  product.md                 # vision + фокус MVP частник (D27)
  target-client.md           # persona / ценность / стратегия (D29)
  branches.md                # ownership трёх ветвей
  current-app.md             # as-is снимок + инвентарь интегрированных решений
  data-model.md              # D24: товары / ТН ВЭД / CalculationEvent
  calculation-fields.md      # поля заявки × роль × обязательность (+ attrs policy)
  incoterms.md               # комментарии ICC / источники базисов (Growth hold)
  customs-payments.md        # НДС 22% / сбор ПП 1637 / акциз·утиль hold; смета без доставки
  plan-landed-without-freight.md # инвойс → ТС → платежи без фрахта (не CIF)
  core-dialogues.md          # S1–S6 + матрица диалогов
  db-process.md              # очередность DB / инвентарь (D23/D24/D26)
  runbook.md                 # local / compose / vercel+sweb ops (+ notify F17)
  dual-path-parity.md        # F19 checklist Next ↔ containers/api (+ gateway)
  environments.md            # as-is карта сред (Mode A/B + Vercel)
  staging.md                 # Vercel Preview + prod smoke results
  roadmap.md                 # план работ + риски + статус фаз + post-polish очередь
  plan-mvp-polish.md         # поэтапный polish (без logistics/LLM/acquiring)
  plan-precedent-bulk.md     # БД-2 прецеденты + CSV/XLSX/PDF import (Growth local)
  plan-ocr-vision.md         # OCR P2: text PDF done; imageBase64 vision hold + спринты
  plan-ai-mesh.md            # конвейер mesh (срезы 1–5) + срез 0: OpenAI-compatible профили
  plan-parallel-ownership.md # D35: пакеты domain/orch/mesh + model≠container
  PACKAGES.md                # (в src/lib/ved/) logical ownership map
  plan-global.md             # горизонт: ТН ВЭД → базы/ИИ → mesh → фото/ссылка → полная сборка
  plan-track-a-p0.md         # P0: live topup / notify / demo ADMIN vs SUPER_ADMIN
  plan-tech-debt.md          # Аудит 2026-08-12: миграции / lint / tsc / WIP split
  plan-broker-qc-loop.md     # Broker QC loop: feedback / reclassify gate / row hints (2026-08-14)
  plan-broker-desc-fees.md   # Брокер: товарное описание + прочие сборы (F1/F2 live)
  plan-broker-empty-attrs.md # Брокер: заполнение только пустых attrs (live)
  plan-cabinets-d32.md       # Кабинеты D32: клиент → брокер → админ → супер (волны C/B/A/S)
  plan-consolidate-orders.md # D34: сборный заказ завода + сегменты клиента
  plan-admin-actors.md       # ADMIN: карточки клиентов / брокеров / заводов
  plan-admin-tnved-ui.md     # ADMIN: понятный импорт ТН ВЭД (форма/CSV)
  plan-newcalc-hints.md      # Client: progressive tips на «Новый просчёт»
  plan-shipping-db-integration.md # DB-интеграция D-SHIP: PrismaClient без моков
  plan-worker-shutdown.md    # stopWorker: clearInterval + дождаться in-flight logistics
  plan-api-sigterm.md        # api SIGTERM: server.close + prisma.$disconnect + exit 0
  plan-husky-precommit.md    # husky: lint + logistics/shipping gate before commit
  plan-vercel-services.md    # Vercel Services BFF; Root=.; post-hoist frontend.root=. (PR#5 app/ superseded)
  plan-ui-auth-stubs.md      # UI: RSC layout stubs + requirePathAccess (дыры без middleware)
  plan-preview-auth.md       # Preview NextAuth: чужой хост ibm-cargo.vercel.app; seed/DATABASE_URL; полные демо-email
  plan-llm-fill-hints.md     # Client: attr chips + 👍 на черновик HS; broker similar precedents
  plan-field-suggest.md      # Client: local typeahead имя/страна/материал/бренд/состав
  plan-precedent-suggest-service.md  # Precedent typeahead container + query guard
  plan-client-tnved-search.md # Client: combobox ТН ВЭД по справочнику (этап 1)
  plan-tnved-demo-corpus.md  # Демо-корпус TnvedCode: точные полные ряды (~50 листьев), не Track B
  plan-tnved-opendata-card.md # Открытые слои ТН ВЭД → одна карточка (ETL, не scrape)
  plan-tnved-collect.md      # Собрать все легальные слои (TWS fill, PDF ЕТТ, решения)
  plan-cabinet-feature-flags.md # Этап 1: скрыть завод/SKU (паттерн shipping)
  plan-public-surface-hygiene.md # Демо на /login оставить; SUPER-константы кодировать; robots не трогать
  plan-manufacturer-proposals.md # Производители: rename + propose + ADMIN approve
  plan-cabinets-ux-sprints.md    # UX Sprint 1–2: петли кабинетов (live)
  feature-cycle.md           # D33: идея → план → код → проверка → Hobby → KB
  ved-feature-cycle.mdc      # alwaysApply: без плана код не писать
  admin-ops.md               # D28: toggles / integrations / cabinet UX / tnved·orch·finance / hide SUPER
  design.md                  # индекс UX / дизайн-KB
  design-baseline.md         # D14, токены, shell, IA
  design-interactive.md      # интерактивный дизайн веб/мобилка
  design-parity.md           # реф ↔ live, UI backlog
  design-patterns.md         # D32: сначала общепризнанные UI-паттерны
  plan-lbm-bro-visual.md     # визуал lbm-bro: live chrome + lab /client
  plan-lbm-bro-honest-skin.md # C8–C9: скрыть инвойс/qty/вес; блок «Замысел дизайнера» off
  plan-lbm-bro-newcalc-mock.md # C10: точная копия шага «Что ввозите?»
  plan-lbm-bro-max-match.md  # C16: максимальный visual match live↔lab без ломки domain
  plan-lbm-bro-tnved-dir.md  # C17: /cabinet/tnved chrome lab, данные GET /api/v1/tnved
  plan-lbm-bro-tnved-catalog.md # C18: lab tnved.json → Postgres + поиск как в lab
  plan-lbm-bro-newcalc-multipack.md # C11: клик «Мультипозиция»
  plan-lbm-bro-newcalc-clarify.md # C12: панель уточнений на single /cabinet/new
  plan-lbm-bro-order-page.md      # C15: /cabinet/orders/[id] = lab 47892 page, не drawer
  containerization.md        # C1–C5, Compose vs Vercel, инвентарь as-is/будущее
  cabinets/                  # UI-инвентарь client/broker/admin + correctness + ux-saas + ui-guide
  …
docs/contracts/              # JSON Schema envelopes (машинные; + d-ocr.ai P2)
.cursor/rules/ved-*.mdc      # IDE copy via `npm run sync:cursor-rules` (gitignored)
```

| Слой | Документы | Роль |
|------|-----------|------|
| Решение | [`decisions.md`](./decisions.md) | Канон статусов, оплаты, UI, extract, **D24** данные, **D25** signup, **D26** orch, **D27** фокус частник, **D28** ADMIN ops, **D29** стратегия, **D32** UI-паттерны, **D33** цикл фичи, **D35** ownership, **D36** zero coupling taurus/nested `./llm`, **D37** taurus backup read-only |
| Продукт / vision | [`product.md`](./product.md), [`target-client.md`](./target-client.md), [`growth.md`](./growth.md) | Зачем продукт, тарифы, фокус MVP (D27), persona/ценность (D29), фаза E / P1b–P3 |
| Структура данных | [`data-model.md`](./data-model.md), [`calculation-fields.md`](./calculation-fields.md) | Товары (`attrs`), ТН ВЭД, `CalculationEvent`; матрица полей × роли |
| Справочники ВЭД (hold) | [`incoterms.md`](./incoterms.md), [`customs-payments.md`](./customs-payments.md) | Инкотермс; платежи (НДС/сбор канон, акциз/утиль hold) |
| Ownership | [`branches.md`](./branches.md), [`skeleton.md`](./skeleton.md), `ved-*.mdc` | Куда писать код; запреты; platform-gates |
| Диалоги | [`core-dialogues.md`](./core-dialogues.md), [`../contracts/`](../contracts/) | S1–S6, envelopes (D-ORCH, D-OCR stub) |
| DB-процесс | [`db-process.md`](./db-process.md) | Очередность записей, tx, инвентарь (D23/D24/D26) |
| Ops | [`runbook.md`](./runbook.md), [`deploy.md`](./deploy.md), [`environments.md`](./environments.md), [`staging.md`](./staging.md), [`roadmap.md`](./roadmap.md), [`feature-cycle.md`](./feature-cycle.md), [`plan-global.md`](./plan-global.md), [`plan-mvp-polish.md`](./plan-mvp-polish.md), [`plan-precedent-bulk.md`](./plan-precedent-bulk.md), [`plan-ocr-vision.md`](./plan-ocr-vision.md), [`plan-ai-mesh.md`](./plan-ai-mesh.md), [`plan-track-a-p0.md`](./plan-track-a-p0.md), [`plan-tech-debt.md`](./plan-tech-debt.md), [`plan-cabinets-d32.md`](./plan-cabinets-d32.md), [`admin-ops.md`](./admin-ops.md), [`dual-path-parity.md`](./dual-path-parity.md) | Env, smoke, dual-path F19, notify F17, цикл фичи, горизонт 1–5, MVP polish, precedent/CSV/PDF, OCR vision hold, конвейер расшифровки, Track A P0, tech-debt, кабинеты D32, ADMIN D28 |
| Инфра | [`containerization.md`](./containerization.md) (as-is + P1–P3), [`../containers.md`](../containers.md), [`../../containers/README.md`](../../containers/README.md), [`monorepo.md`](./monorepo.md), [`deploy.md`](./deploy.md), [`web-slim.md`](./web-slim.md), [`database.md`](./database.md), [`environments.md`](./environments.md) | Compose 14+ocr scaffold, приоритеты extract, Vercel, C5 |
| UX | [`design.md`](./design.md), [`design-baseline.md`](./design-baseline.md), [`design-interactive.md`](./design-interactive.md), [`design-parity.md`](./design-parity.md), [`design-patterns.md`](./design-patterns.md), [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md), [`cabinets/ux-saas.md`](./cabinets/ux-saas.md), [`cabinets/ui-guide.md`](./cabinets/ui-guide.md), [`../design/refs/`](../design/refs/), skills `ved-ui` / `ved-notify` | Baseline D14, **D32 паттерны**, live chrome lbm-bro, lab `/client`, toast, parity, удобство, **сравнение ролей** |
| Тесты | [`testing.md`](./testing.md), [`testing-branches.md`](./testing-branches.md) | unit / smoke / e2e + gaps |
| As-is / AI | [`current-app.md`](./current-app.md), [`ai-pipeline.md`](./ai-pipeline.md) | Что реально работает + интегрированные решения |
| Кабинеты по контейнерам | [`cabinets/`](./cabinets/) | Инвентарь UI + взаимодействия + correctness (client/broker/admin/shared) |

Смежные docs вне knowledge: [`../architecture.md`](../architecture.md), [`../containers.md`](../containers.md), [`../development.md`](../development.md), [`../README.md`](../README.md).

## Порядок чтения (типовые задачи)

| Задача | Порядок |
|--------|---------|
| Позиционирование / persona / ценность | [`product.md`](./product.md) (D27) → [`target-client.md`](./target-client.md) (D29) |
| Интерактивный дизайн (веб/мобилка) | [`design-interactive.md`](./design-interactive.md) → [`../design/refs/`](../design/refs/) |
| Сверка экрана с моком | [`design-parity.md`](./design-parity.md) → `cargo-broker-cabinets.html` |
| Новый UI-экран / компонент | **D32** [`design-patterns.md`](./design-patterns.md) → существующий паттерн, не с нуля |
| Новый визуал кабинетов (lbm-bro) | [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) → live `/cabinet` `/broker` `/admin`; lab `/client` референс |
| Mapping / claim брокера | core-dialogues S3 → contracts D-MAP/D-QUEUE → [`cabinets/broker/`](./cabinets/broker/) → design-parity |
| Новый статус / pay-правило | decisions D8/D11 → [`db-process.md`](./db-process.md) (D23) → unit invariants → testing-branches |
| Товары / ТН ВЭД / история событий | [`data-model.md`](./data-model.md) (D24) → contracts D-PRODUCT/D-TNVED/D-HISTORY → dual writers Next+api |
| Базис поставки / комментарии Инкотермс | [`incoterms.md`](./incoterms.md) → при logistics Growth: [`growth.md`](./growth.md) §Перевозка (UI hold D27) |
| Смета платежей / НДС / сборы | [`customs-payments.md`](./customs-payments.md) → `src/lib/ved/customs-fees.ts` |
| Смета без международной доставки | [`plan-landed-without-freight.md`](./plan-landed-without-freight.md) → `src/lib/ved/landed-cost.ts` |
| Extract / новый контейнер | containerization C* + D19 → contracts envelope → monorepo |
| Деплой | [`deploy.md`](./deploy.md) → Root Directory `.` + Framework Services; не `USE_DOMAIN_API` без cutover; не `ibm-cargo.vercel.app` |
| Поднять локально / выбрать режим | [`environments.md`](./environments.md) → [`../development.md`](../development.md) → [`runbook.md`](./runbook.md) |
| Что уже на prod / smoke | [`current-app.md`](./current-app.md) § интегрированные → [`staging.md`](./staging.md) → [`roadmap.md`](./roadmap.md) |
| Broker QC loop (feedback → broker) | [`plan-broker-qc-loop.md`](./plan-broker-qc-loop.md) · [`cabinets/broker/`](./cabinets/broker/) |
| Брокер: уточнить описание / доп. сборы | [`plan-broker-desc-fees.md`](./plan-broker-desc-fees.md) |
| Брокер: пустые attrs only | [`plan-broker-empty-attrs.md`](./plan-broker-empty-attrs.md) |
| Client: подсказки NewCalc | [`plan-newcalc-hints.md`](./plan-newcalc-hints.md) |
| Client: LLM/heuristic chips + 👍 черновик | [`plan-llm-fill-hints.md`](./plan-llm-fill-hints.md) |
| Client: typeahead полей (словарь) | [`plan-field-suggest.md`](./plan-field-suggest.md) |
| Client: поиск ТН ВЭД (combobox справочника) | [`plan-client-tnved-search.md`](./plan-client-tnved-search.md) · этап 1 [`plan-global.md`](./plan-global.md) |
| Корпус ТН ВЭД для демо (не Track B) | [`plan-tnved-demo-corpus.md`](./plan-tnved-demo-corpus.md) · `/admin/tnved` |
| ТН ВЭД: открытые слои → одна карточка | [`plan-tnved-opendata-card.md`](./plan-tnved-opendata-card.md) · ФНС TNVED.7z + ЕТТ/НСИ, не scrape |
| ТН ВЭД: собрать все легальные слои | [`plan-tnved-collect.md`](./plan-tnved-collect.md) · TWS fill local, не Alta |
| ТН ВЭД: каталог lab → Postgres (C18) | [`plan-lbm-bro-tnved-catalog.md`](./plan-lbm-bro-tnved-catalog.md) · `tnved:load -- --lab` |
| Флаги скрытия лишнего (завод / SKU) | [`plan-cabinet-feature-flags.md`](./plan-cabinet-feature-flags.md) · паттерн `shippingUiEnabled` |
| Производители: propose / approve | [`plan-manufacturer-proposals.md`](./plan-manufacturer-proposals.md) |
| UX Sprint 1–2 (петли кабинетов) | [`plan-cabinets-ux-sprints.md`](./plan-cabinets-ux-sprints.md) |
| Удобство кабинетов / SaaS-паттерны / очередь UX | [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) · **сводка UI (client/broker/admin):** [`cabinets/ui-guide.md`](./cabinets/ui-guide.md) |
| ADMIN ops / toggles / cabinet UX (drill-down, badge, users) | [`admin-ops.md`](./admin-ops.md) (D28) → [`cabinets/admin/`](./cabinets/admin/) · **схема взаимодействий:** [`cabinets/admin/schema.md`](./cabinets/admin/schema.md) |
| MVP polish по шагам | [`plan-mvp-polish.md`](./plan-mvp-polish.md) (матрица фич + этапы 0–4; без shipping/LLM/ЮKassa) |
| Dual-path / notify / gateway gate | [`dual-path-parity.md`](./dual-path-parity.md) → [`runbook.md`](./runbook.md) §Notify → `smoke:gateway` |
| Post-polish очередь (ops хвост → Growth) | [`roadmap.md`](./roadmap.md) §«Post-polish» · [`cabinets/shared/correctness.md`](./cabinets/shared/correctness.md) |
| Техдолг / hardening после аудита | [`plan-tech-debt.md`](./plan-tech-debt.md) → migrate sweb → lint/tsc → WIP split |
| Цикл любой фичи (**D33**, план до кода) | [`feature-cycle.md`](./feature-cycle.md) → dual-path → test:ci → smoke → Hobby → KB |
| Кабинеты (D32 волны клиент→брокер→админ→супер) | [`plan-cabinets-d32.md`](./plan-cabinets-d32.md) · [`cabinets/`](./cabinets/) |
| Конвейер расшифровки (схема логистов) | [`plan-ai-mesh.md`](./plan-ai-mesh.md) → [`ai-pipeline.md`](./ai-pipeline.md) · брокер навсегда; MVP D27 не ломать |
| Глобальный горизонт (поиск ТН ВЭД → mesh → фото/ссылка → сборка) | [`plan-global.md`](./plan-global.md) · этап 1 = поиск HS; скрытое возвращается после этапа 3 |
| Growth (LLM, 3PL, эквайринг, notify) | growth → ai-pipeline → не ломать envelopes D-DRAFT / D-LEDGER / D-EVENT / D-SHIP |

## Инварианты (кратко)

Полный список: [`decisions.md`](./decisions.md), зеркало: [`ved-invariants.mdc`](./ved-invariants.mdc).

1. **D11** — нет `QUEUED` без оплаты.
2. **D15** — только реальные `CalculationItem`; запрет `id: "synthetic"`; shipping после `DONE`.
3. **D10** — EXPRESS ≤1 / STANDARD ≤3 / PRO ≤10.
4. **D16/D17/D20** — UI-контейнеры без `@prisma/client`.
5. **D6** — legacy CMS не лицо продукта.
6. **D24** — attrs на item; ТН ВЭД soft-lookup; `CalculationEvent` append-only ([`data-model.md`](./data-model.md)).
7. **D33** — без письменного плана код не писать; без записи в KB задачу не закрывать ([`feature-cycle.md`](./feature-cycle.md)).
8. **D36** — нулевая связка LBM с taurus/nested `./llm` ([`decisions.md`](./decisions.md) · [`plan-zero-llm-coupling.md`](./plan-zero-llm-coupling.md)).
9. **D37** — taurus-liart = backup ядра, read-only ([`plan-taurus-backup-core.md`](./plan-taurus-backup-core.md)).

CI: `npm run test:structure` требует наличие ключевых файлов KB (см. `scripts/verify-structure.cjs`).

## Честный статус extract (C1–C5)

Источник: [`containerization.md`](./containerization.md). Провайдеры growth: [`growth.md`](./growth.md).

| ID | Статус | Комментарий |
|----|--------|-------------|
| C1 | dual | Compose `USE_DOMAIN_API=1`; Vercel = Prisma-in-Next |
| C2 | done | Admin Next (D20) |
| C3 | heuristic-v1 | Draft; optional OpenAI via `containers/llm` + `OPENAI_API_KEY` (D21) |
| C4 | opt-in real | stub default; ЮKassa / Resend|SMTP / demo-3pl по env ([`growth.md`](./growth.md)) |
| C5 | scaffold + smoke | [`web-slim.md`](./web-slim.md); `npm run smoke:gateway`; cutover отложен (D22) |

UI baseline: tag **`ved-ui-cabinets-baseline`** · ADR **D14** · [`design.md`](./design.md) → [`design-baseline.md`](./design-baseline.md).

## Правила обновления KB

1. **Новое продуктовое решение** → новый или уточнённый ADR в `decisions.md` (не размазывать по чатам).
2. **Смена ownership / папок** → `branches.md` + `skeleton.md` + при необходимости `ved-ownership.mdc` и `.cursor/rules/`.
3. **Смена HTTP shape контейнера** → соответствующий `docs/contracts/d-*.json` (+ bump `x-contractVersion` при breaking).
4. **Закрытие C\* / смена dual-path** → `containerization.md` + `current-app.md` + при cutover — ADR.
5. **Новый / будущий контейнер** → [`containers/README.md`](../../containers/README.md) + [`../containers.md`](../containers.md) + секция инвентаря в `containerization.md` (as-is или «предполагаемое будущее»).
6. **Vision ≠ as-is** — модули вроде OCR/Risk в `product.md` не считать *продуктово* готовыми, пока нет wire в domain; **scaffold** (`containers/ocr` + `d-ocr.ai.json`) фиксировать в `current-app` / `growth` / contracts, не как go-live.
7. **Новый opt-in provider / smoke** → `growth.md` + `testing-branches.md` (+ `ai-pipeline.md` для LLM). Precedent/import → `plan-precedent-bulk.md`. OCR/vision → `plan-ocr-vision.md`.
8. **Закрытие фазы / merge на prod** → обновить [`current-app.md`](./current-app.md) (инвентарь), [`roadmap.md`](./roadmap.md), [`staging.md`](./staging.md) (smoke).
9. **Новая доменная структура данных** → [`data-model.md`](./data-model.md) + ADR + contracts + dual-path (`src/lib/ved` и `containers/api` при C1).
10. **Cabinet UI feature flag** (скрыть surface без удаления кода) → `src/lib/ved/cabinet-features.ts` + строка в [`current-app.md`](./current-app.md) § интегрированные + env в [`environments.md`](./environments.md) / [`runbook.md`](./runbook.md); go-live — [`roadmap.md`](./roadmap.md).
11. **Фокус MVP частник (D27)** — при **любой** правке, коррекции или **новом составлении / пересборке** единой библиотеки (`docs/knowledge/*`, индекс README, AGENTS-навигация по продукту) явно сверяться с [`product.md`](./product.md) §«Фокус MVP» и ADR **D27**: deliverable = ТН ВЭД → брокер-QC → PDF; не смешивать в текущий скоуп «доставку под ключ», live-эквайринг и LLM-сопоставление без кода (см. [`plan-mvp-polish.md`](./plan-mvp-polish.md)). Копирайт лендинга/кабинетов под D27 — только по явному запросу на UI.
12. **Стратегия persona / сеть (D29)** — производитель, master-data габаритов, консолидация, buyer closed-groups — канон [`target-client.md`](./target-client.md); **не** подменять CTA D27. Кабинет производителя **v1 live (D31)** `/manufacturer` · сборный заказ **D34** [`plan-consolidate-orders.md`](./plan-consolidate-orders.md) · [`cabinets/manufacturer/`](./cabinets/manufacturer/).
13. **Platform settings / ADMIN ops (D28)** — marketplace / acceptingJobs / maintenance / **payments / llm / notify / mockTopup** → `platform-gates.ts` + dual-path `containers/api` + [`admin-ops.md`](./admin-ops.md) + [`cabinets/admin/`](./cabinets/admin/) + строка в [`cabinets/shared/correctness.md`](./cabinets/shared/correctness.md). Закрытие ops UX (tnved / orch retry / finance CSV / acceptingJobs admin) → ADR D28 + `current-app` + `roadmap` §Post-polish. URL/keys интеграций — только env, не ADMIN UI.
14. Не коммитить секреты; host БД — в [`database.md`](./database.md), пароли только в `.env`. SUPER credentials — не в публичных демо-строках (D6/D28).
15. **Цикл фичи (D33)** — идея → анализ → **план в `docs/knowledge/`** → реализация → проверка → анализ → правка → деплой Hobby → KB. Без плана не начинать `src/` / `app/` / `containers/`. PR без KB не закрывать ([`feature-cycle.md`](./feature-cycle.md)).
16. **Параллельная ownership / multi-model (D35)** — пакеты в [`PACKAGES.md`](../../src/lib/ved/PACKAGES.md); `containers/{llm,ocr}` LBM-owned; модель ≠ контейнер ([`plan-parallel-ownership.md`](./plan-parallel-ownership.md)).
17. **Изоляция / full split (D36, always)** — nested `./llm` **нет в git**; matrix = HTTP only; `containers/{llm,ocr}` LBM-owned ([`plan-full-split-ibm-cargo.md`](./plan-full-split-ibm-cargo.md)).

## Машинные проверки

| Команда | Что подтверждает |
|---------|------------------|
| `npm run test:structure` | Файлы KB, ownership, forbidden, surfaces |
| `npm run test:contracts` | envelopes + examples в `docs/contracts/` |
| `npm run test:unit` | Инварианты domain |
| `npm run test:ci` | unit → structure → contracts → verify |

Live (running app + seed): `smoke:full` / `mvp` / `payments` / `broker` / `chat` / `sla` / `shipping` / `gateway` / `chain-llm` / `precedent-csv` — см. [`testing-branches.md`](./testing-branches.md), результаты prod — [`staging.md`](./staging.md).
