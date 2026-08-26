# Карта структуры LBM (Ibm-cargo)

Канон взаимосвязей репозитория. Ресурсы продукта: **этот** GitHub, выделенная Postgres (`app/.env` → `DATABASE_URL`), S3 bucket **`lbm`**. Чужие репозитории/БД/S3 в runtime не использовать.

Связанные планы: [`plan-lbm-bro-skin.md`](./plan-lbm-bro-skin.md) · [`PLATFORMS.md`](../PLATFORMS.md) · [`app/docs/knowledge/environments.md`](../app/docs/knowledge/environments.md).

---

## Дерево

```
Ibm-cargo/
  app/                 # Vercel Root Directory — Next monolith
    app/               # App Router: /client, /cabinet, /broker, /admin, /api/v1
    src/lbm-bro/       # UI lab skin (дизайн-прототип)
    src/components/ved # Domain cabinets (функция)
    src/lib/ved/       # Domain logic + Prisma
    containers/        # Mode B extract (api, ai, llm, …)
    prisma/
  llm/                 # AI matrix + TN VED corpus (не UI)
  docs/                # продукт + этот файл
```

---

## Surfaces

| Route | Роль | UI | Данные |
|-------|------|-----|--------|
| `/client/*` | UI lab | `src/lbm-bro` + `DemoProvider` | частично `/api/v1` (ТН ВЭД); остальное demo |
| `/cabinet/*` | Domain client | `components/ved` | `/api/v1` + своя БД |
| `/broker/*` | Domain broker | `components/ved` | `/api/v1` |
| `/admin/*` | Domain admin | `components/ved` | `/api/v1` |

Access: [`app/src/lib/ved/access.ts`](../app/src/lib/ved/access.ts) — CLIENT home → `/client`; lab доступен ролям CLIENT как cabinet.

Lab mount: [`app/app/client/layout.tsx`](../app/app/client/layout.tsx) → fonts + `lbm-bro/globals.css` + `ClientLabProviders` (`DemoProvider`, `ClientShell`, ProtoBar).

---

## Потоки данных

```text
Browser
  ├─ /client (lbm-bro) ──┬── /api/v1/tnved/*  ──► lib/ved/tnved (+ hs-aliases)
  │                      └── DemoProvider      ──► localStorage (freemium, fake orders)
  ├─ /cabinet|/broker|/admin ── /api/v1/* ─────► lib/ved ──► Prisma (DATABASE_URL)
  └─ uploads ──────────────────────────────────► S3 bucket lbm (S3_*)

Optional Mode B:
  /api/v1 ──USE_DOMAIN_API──► containers/api ──► same Postgres schema
  lib/ved AI ──*_SERVICE_URL──► containers/ai|llm|ocr
  llm/ ── npm run sync:ai-matrix ──► app/containers/{llm,ocr}
```

Env-корень Next = **`app/`** только:

| Файл | Что хранит |
|------|------------|
| `app/.env` | **единственный** `DATABASE_URL` + `S3_*` + NextAuth / ключи |
| `app/.env.local` | опционально localhost UI / mock / mesh URLs — **без** override DB/S3 |
| repo `.env.local` | CLI/OIDC; приложение не читает |

---

## Статус фронта lbm-bro

| Кусок | Статус | Следующий шаг |
|-------|--------|----------------|
| Shell `/client` | live (lab) | Phase 2: баланс/лента с API |
| ТН ВЭД browse | **domain API** + alias pin | smoke на своей БД; freemium → server later |
| Wizard `/client/new` | demo (static classify) | Phase 3: `POST /api/v1/calculations` |
| Orders / balance / chat / ship | demo + DesignerStub | Phase 2–3 |
| Broker/Admin в `lbm-bro` | не смонтированы | Phase 4 after client |
| `/cabinet` `/broker` `/admin` | domain canon | не ломать |

Образец «lab UI + domain data»: [`client-tnved.tsx`](../app/src/lbm-bro/components/client-tnved.tsx) → `/api/v1/tnved/search|chapters|:code` + [`tnved-aliases.ts`](../app/src/lib/ved/tnved-aliases.ts).

Синхрон кураторских кодов lbm-bro → Postgres: `cd app && npm run tnved:sync-aliases` (ветки aliases + предки из `public/lbm-bro/data/tnved.json`).

Полный Track B (ФНС дерево + TWS ставки + PSN notes): `npm run tnved:compose` затем `npm run tnved:load -- --full` (~30k узлов, `parentCode` 2→10).

### Clarify-hints (P0–P3)

Единая карта уточняющих chips: [`app/src/lib/ved/clarify-hints/`](../app/src/lib/ved/clarify-hints/) — `detectCategory` → gaps → ≤3 Q → `searchValue` / `attrsPatch`.

| Surface | UI | Поведение |
|---------|-----|-----------|
| `/cabinet` NewCalc | `ClarifyHintsPanel` | local heuristic → `POST /api/v1/clarify/questions` (веса DB); tokens → HS |
| `/client/new` wizard | `ClarifyField` (adapter) | merge в desc + `wizard.attrs`; multi-pack off |
| Suggest typeahead | FieldSuggest / suggest API | P3: `clarify_product_profiles` (`source: profile`) |
| Broker approve | calculations.ts | P2: `clarify_hs_feedback` + upsert profile (fail-open) |

Карта: [`clarify-hints-map.md`](./clarify-hints-map.md). Seed/reweight: `npm run clarify:seed-options` · `npm run clarify:reweight`.

---

## Дорожная карта внедрения фронта

Принцип: **скин lbm-bro**, данные и инварианты domain (D8–D35). Не переносить demo-тарифы и localStorage в прод.

| Phase | Содержание |
|-------|------------|
| **1 Фундамент** | Этот документ + env канон + smoke ТН ВЭД на своей БД |
| **2 Shell/home** | Счётчики/заявки/баланс с `GET /api/v1/…`; сужение DesignerStub |
| **3 Wizard** | Clarify UI + create через domain; classify не только `tnved.json` |
| **4 Конвергенция** | Lab как primary CLIENT UI **или** skin на `/cabinet`; broker/admin skin после |

Детали визуала и stubs: [`plan-lbm-bro-skin.md`](./plan-lbm-bro-skin.md).

---

## Mode A / Mode B (кратко)

| Mode | Команда | БД / S3 |
|------|---------|---------|
| **A** (ежедневно) | `cd app && npm run dev` | только `app/.env` (своя Postgres + S3 `lbm`) |
| **B** (опционально) | `cd app && docker compose --profile core up -d` (project name **`lbm`**) | in-network postgres compose; host `.env` DB/S3 для Next Mode A не подменять |

Compose не заменяет выделенную продуктовую БД/S3 для UI lab и Vercel.

Проверка connectivity (без вывода секретов):

```bash
cd app && npx tsx scripts/verify-db.ts
```
