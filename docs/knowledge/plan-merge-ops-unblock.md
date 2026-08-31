# План исполнения: merge-стек + ops (без нового feature-кода)

**Дата:** 2026-08-31. **D33.**  
Канон: [`plan-next-vector-c28.md`](./plan-next-vector-c28.md) · [`deploy.md`](./deploy.md) · [`environments.md`](./environments.md) · [`plan-preview-auth.md`](./plan-preview-auth.md).  
**Вердикт:** узкое место — human merge + Vercel/DB ops; агентский код C8–C31 в [#16](https://github.com/TikhonBaruch/Ibm-cargo/pull/16) готов.

**Не делать до закрытия фаз 1–4:** C35-impl, новые feature-PR от tip стека, deploy/smoke на taurus-liart (D37).

---

## Фаза 1 — Must: merge #16 → main (человек)

| | |
|--|--|
| PR | [#16](https://github.com/TikhonBaruch/Ibm-cargo/pull/16) `cursor/lbm-bro-honest-skin-e1f0` → `main` |
| Содержит | C8–C18 + **#19 MERGED** (C19–C31, pay-first, cascade) |
| Статус агента | ready, MERGEABLE; **merge в main агент сделать не может** |

Человек:

1. Merge #16 → `main` (squash или merge — как принято).
2. Дождаться Production deploy Vercel project **`ibm-cargo`** → https://ibm-cargo-phi.vercel.app
3. Ручной check: `/login` (`client@example.com` / `demo1234`) → `/cabinet/new` → Товар → Оплата → HS только после pay; `/cabinet/tnved` открывается.

**Done when:** pay-first на prod; C28a = done.

---

## Фаза 2 — Draft-цепочка → `main` (после фазы 1)

Порядок merge: **#22 → #23 → #24 → #25**. Параллельно после #16: **#26** (docs C35 brief). Optional: **#21** mobile.

| PR | Тема | База сейчас | После #16 |
|----|------|-------------|-----------|
| [#22](https://github.com/TikhonBaruch/Ibm-cargo/pull/22) | C32 Preview DevEx | `tnved-invoice-enrich` | retarget → `main`, undraft, merge |
| [#23](https://github.com/TikhonBaruch/Ibm-cargo/pull/23) | fill-hints audit | #22 | → `main` after #22 |
| [#24](https://github.com/TikhonBaruch/Ibm-cargo/pull/24) | кепка/молоко/кеды | #23 | → `main` after #23 |
| [#25](https://github.com/TikhonBaruch/Ibm-cargo/pull/25) | layer-G fees | #24 | → `main` after #24 |
| [#26](https://github.com/TikhonBaruch/Ibm-cargo/pull/26) | C35 brief | honest-skin | → `main` |
| [#21](https://github.com/TikhonBaruch/Ibm-cargo/pull/21) | mobile M1 | tnved tip | optional → `main` |

Side: [#9](https://github.com/TikhonBaruch/Ibm-cargo/pull/9) вероятно superseded #16 — закрыть после проверки. #17 clarify — отдельный human review.

---

## Фаза 3 — Ops (человек; Vercel MCP в агенте = needsAuth)

| ID | Действие | Env | Done when |
|----|----------|-----|-----------|
| O1 | `DATABASE_URL` на **Preview** (= seeded `newlsu_lbm`, не только Production) | Vercel `ibm-cargo` | `/health` → `databaseUrl: true` на Preview |
| O2 | `ALLOW_MOCK_TOPUP=1` + `NEXTAUTH_SECRET` на Preview; **не** копировать чужой `NEXTAUTH_URL=ibm-cargo.vercel.app` | Preview | login + mock pay smoke |
| O3 | `VERCEL_AUTOMATION_BYPASS_SECRET` + Protection bypass для CI/curl | Preview | C32c / `probe:preview` без SSO block |
| O4 | `npm run tnved:load -- --search-extras` на prod DB (**не** `--full`) | host + `DATABASE_URL` | aliases/notes для C19/#24 |
| O5 | Track A RESEND/ЮKassa | — | **Won't** до стабильного mock path |

---

## Фаза 4 — Verify + KB

```bash
TEST_API_URL=<preview-with-bypass> npm run smoke:mvp
npm run test:classify-cascade   # после merge #24
```

KB: этот файл + [`plan-next-vector-c28.md`](./plan-next-vector-c28.md) C28a/e · [`current-app.md`](./current-app.md) «C18–C31 на main».  
C35: только brief; `plan-c35-*.md` / код — следующий диалог после зелёных фаз 1–4.

---

## Статус исполнения (агент)

| Фаза | Статус | Примечание |
|------|--------|------------|
| 1 Merge #16 | **blocked human** | Playbook на tip #16 (`686a9a0`); PR body + comment «MERGE NOW»; subscribe PR #16 |
| 2 Retarget chain | waiting | комментарии на #22–#26; старт после merge #16 |
| 3 Ops | blocked human | Vercel MCP needsAuth — O1–O4 в таблице выше |
| 4 Verify/KB | partial | playbook + C28a статус в next-vector; C28e после merge |

После merge #16 агент: retarget #22–#26 → `main`, undraft по порядку, комментарии, smoke-помощь, KB C28e.
