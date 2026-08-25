# План: техдолг и hardening (аудит 2026-08-12)

Пошаговое закрытие находок аудита ветки `cursor/admin-ops-harden`.  
Индекс: [`README.md`](./README.md) · очередь: [`roadmap.md`](./roadmap.md) §Post-polish.  
Не меняет D27 CTA (shipping / slim / LLM-as-matcher hold).

Связано: [`feature-cycle.md`](./feature-cycle.md) этап **M2** · [`roadmap.md`](./roadmap.md) §«Ближайший план».

## Вердикт аудита (снимок)

| Проверка | Результат |
|----------|-----------|
| `npm run test:ci` | **PASS** — 245 unit + structure + 15 contracts |
| `npx tsc --noEmit` | **FAIL** — ~35 ошибок в 4 тестовых файлах (вне CI) |
| `npm run lint` | **PASS** — `eslint app src` (Next 16 has no `next lint`) |
| `prisma migrate status` (host `.env` → sweb) | pending: `verified_determinations`, `precedent_embeddings` |
| `ops:track-a` | NEED Resend/SMTP + payments/ЮKassa; D27 holds OK |
| Dirty tree | ~150 путей (~+3485/−713) на ветке |

Подробный UI-отчёт аудита (локально у оператора): Cursor canvas `tech-debt-audit` — не канон KB.

## Шаги (порядок)

| # | Шаг | Sev | Статус | Критерий done |
|---|-----|-----|--------|----------------|
| **1** | Миграции БД-2 на целевых БД | P0 | **done** (2026-08-12 sweb) | `verified_determinations` есть; unit fail-open без `prisma:error`; sweb = lexical only (нет pgvector) |
| **2** | Починить `npm run lint` под Next 16 | P0 | **done** | `npm run lint` exit 0 (`eslint app src`) |
| **3** | tsc в CI + починить test-файлы | P1 | **done** (2026-08-25) | `npm run typecheck` (`tsc --noEmit`) green; в `test:ci`; `EnvBag` + test mocks; exclude `llm/`/`containers/` |
| **4** | Нарезать WIP на PR / Preview deploy | P1 | **done** Preview READY (2026-08-12) | [PR #1](https://github.com/TikhonBaruch/Ibm-cargo/pull/1) · Preview: Vercel Preview of Ibm-cargo · чеклист [`staging.md`](./staging.md) |
| **5** | Dual-path docs + `customs-fees` канон | P1 | **done** (2026-08-25) | `dual-path-parity.md` + reclassify/imports; TS canon + JS mirrors synced |
| **6** | PROTECTED_V1: adjust + imports preview | P2 | **done** (2026-08-25) | `access.ts` + unit `access`/`security`; handlers already `requireRole` |
| **7** | Нарезать `AdminVedCabinet` на panes | P2 | **done** | orchestrator ~816 LOC + `ved/admin/*` (14 panes + `types.ts`) · nav groups были prerequisite |
| **8** | Track A ops keys (Resend / ЮKassa) | P2 | pending | `ops:track-a -- --vercel` без NEED (оператор) |
| **9** | Hygiene: next-env ignore, Prisma 7 warn | P3 | **partial** — `package.json#prisma` → `prisma.config.ts` (Prisma **6.19**); `eslint.config.mjs` (без `"type":"module"` в package.json) | нет мусора в `git status` / нет MODULE_TYPELESS_PACKAGE_JSON на `npm run lint` |

## Шаг 1 — детали

### Цель

Убрать runtime-шум и мёртвый path precedent на Mode A / Vercel (sweb): таблица `verified_determinations` должна существовать.

### Ограничение sweb

Host `pg4.sweb.ru` **не** имеет extension `vector` (файл `vector.control` отсутствует).  
Поэтому:

| Миграция | sweb (Mode A / Vercel) | Compose (`pgvector/pgvector:pg17`) |
|----------|------------------------|--------------------------------------|
| `20260812130000_verified_determinations` | **применить** | применить |
| `20260812140000_precedent_embeddings` | SQL **fail-open** (skip column/index) | полная: extension + `embedding` + HNSW |

Lexical / fingerprint (`precedent-v1`) работает без pgvector.  
`precedent-v2` — только compose + `OPENAI_API_KEY` ([`plan-precedent-bulk.md`](./plan-precedent-bulk.md) §Фаза 7, D30).

### Команды

```bash
# Host DATABASE_URL = sweb (Mode A / prod schema sync)
npx prisma migrate deploy
npx prisma migrate status
npm run test:unit -- src/lib/ved/__tests__/ai-llm-failopen.test.ts
```

Compose (полный vector path):

```bash
docker compose up -d postgres
# DATABASE_URL=postgres://…@localhost:…/…  (compose postgres)
npx prisma migrate deploy
npm run smoke:precedent-vector   # skip OK без OPENAI_API_KEY
```

### Не делать на шаге 1

- Не включать shipping UI / `WEB_SURFACE=slim` / LLM CTA.
- Не `db push` вслепую поверх чужой истории без сверки `_prisma_migrations`.
- Не требовать pgvector на sweb shared hosting.

## Шаг 2+ (кратко)

2. **Lint:** **done** — `"lint": "eslint app src"` (Next 16 has no `next lint`; that treated `lint` as a directory).  
2b. **npm allowScripts:** **done** — Prisma / sharp / tesseract.js / unrs-resolver в `package.json` `allowScripts` (имя + pin lockfile; warning npm 11.16+; install behaviour unchanged). Не `ignore-scripts`.  
3. **tsc:** **done** — `EnvBag` для env-helpers; test mocks; `npm run typecheck` в `test:ci`; exclude `llm/` + `containers/` из root tsconfig.  
4. **WIP split:** не один монолитный merge admin-ops+Growth.  
5–7. Docs parity **done**, PROTECTED adjust/imports **done**, admin panes **done**.  
8. Keys — только ops ([`plan-track-a-p0.md`](./plan-track-a-p0.md)).

## Связанные документы

| Документ | Роль |
|----------|------|
| [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) | БД-2 / CSV / reclassify / pgvector |
| [`environments.md`](./environments.md) | sweb vs compose postgres / pgvector |
| [`database.md`](./database.md) | host sweb, migrate practice |
| [`dual-path-parity.md`](./dual-path-parity.md) | Next ↔ api (шаг 5) |
| [`roadmap.md`](./roadmap.md) | post-polish очередь |
| [`testing-branches.md`](./testing-branches.md) | smoke matrix |

## Правила обновления

При закрытии шага — обновить **статус** в таблице выше + строку в [`roadmap.md`](./roadmap.md) §Post-polish · при schema — [`data-model.md`](./data-model.md) / [`staging.md`](./staging.md).
