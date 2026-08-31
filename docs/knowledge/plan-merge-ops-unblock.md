# План исполнения: merge-стек + ops (без нового feature-кода)

**Дата:** 2026-08-31. **D33.**  
Канон: [`plan-next-vector-c28.md`](./plan-next-vector-c28.md) · [`deploy.md`](./deploy.md) · [`environments.md`](./environments.md) · [`plan-preview-auth.md`](./plan-preview-auth.md).

**Вердикт (closeout):** код #16 + #27 на `main`. Prod login/seed/`DATABASE_URL` **OK**. `smoke:mvp` на ibm-cargo-phi **PASS**. Критичный поиск (кепка/ноутбук/кеды/молоко) **HIT**. Остаток — Preview secrets (человек) + optional mobile #21.

---

## Фаза 1 — Merge #16 → main

| | |
|--|--|
| Status | **done** 2026-08-31 `b7418aa` |
| Prod | https://ibm-cargo-phi.vercel.app |

---

## Фаза 2 — Draft-цепочка

| | |
|--|--|
| Status | **done** via consolidated [#27](https://github.com/TikhonBaruch/Ibm-cargo/pull/27) `16a51d0` (C32→layer-G + C35 brief) |
| Superseded closed | #22 #23 #24 #25 #9 |
| Optional open | #21 mobile (draft) |

---

## Фаза 3 — Ops

| ID | Действие | Status |
|----|----------|--------|
| O1 | Preview `DATABASE_URL` | **human** — agent requested secret + Vercel MCP auth |
| O2 | Preview `ALLOW_MOCK_TOPUP` + `NEXTAUTH_SECRET` | **human** |
| O3 | Preview bypass secret | **human** (C32c) |
| O4 | `tnved:load -- --search-extras` | **done** 2026-08-31 — merged 53 extras; 31706 codes / 14948 leaves / 15025 variations on `newlsu_lbm` (prod search HIT кепка/ноутбук confirmed) |
| O5 | Track A ЮKassa/RESEND | **Won't** now |

---

## Фаза 4 — Verify + KB

| Check | Result 2026-08-31 |
|-------|-------------------|
| Prod `/health` | `databaseUrl: true` |
| Demo login API | `client@example.com` / `demo1234` → CLIENT session |
| `TEST_API_URL=https://ibm-cargo-phi.vercel.app npm run smoke:mvp` | **PASS** (#47822 DONE; mock topup off → seeded client) |
| `npm run test:classify-cascade` | **94 PASS** |
| TN VED search | ноутбук / кепка / кеды / молоко — hits |
| Browser pay-first UI | automation flaky on password field; trust smoke:mvp + manual spot-check |
| Preview smoke | **blocked** until O1–O3 |

---

## Статус исполнения

| Фаза | Статус |
|------|--------|
| 1 Merge #16 | **done** |
| 2 Stack #27 | **done** |
| 3 Ops Preview | **blocked human** (secrets requested) |
| 4 Verify prod | **done** (API/smoke); manual UI optional |
| C35 | brief on main; plan/impl next dialogue |

**Не делать:** C35-impl до `plan-c35-*.md`; taurus deploy (D37).
