# План C32 — Preview / smoke DevEx

**Дата:** 2026-08-29. **D33.**  
Вектор: [`plan-next-vector-c28.md`](./plan-next-vector-c28.md) · staging: [`staging.md`](./staging.md) · auth Preview: [`plan-preview-auth.md`](./plan-preview-auth.md).

## 1. Идея

Агенты и CI не могут гонять `smoke:*` на Vercel Preview: **Deployment Protection** (`ssoProtection`) редиректит curl на `vercel.com/sso-api` / login. Человек открывает **Visit Preview**. C32 закрывает DevEx: чеклист Visit Preview + mock topup, ops-шаги bypass token, зелёный `smoke:standalone` на Preview после C28.

## 2. Анализ

| Симптом | Причина |
|---------|---------|
| `curl` Preview → 302 `vercel.com/sso-api` | Protection all_except_custom_domains |
| `/health` на Preview недоступен без SSO | тот же gate |
| Prod custom domain / `ibm-cargo-phi` | без SSO — curl OK |
| `smoke:mvp` без mock на seeded client | баланс ≥ 1000 ₽ нужен; иначе `ALLOW_MOCK_TOPUP=1` |
| Агент не ставит Vercel secrets | Dashboard only; Vercel MCP `needsAuth` |

Не делать: коммитить bypass secret; считать `ibm-cargo.vercel.app` нашим Preview; объявлять C32c PASS при SSO redirect.

## 3. Фазы

| ID | Что | Owner | Status |
|----|-----|-------|--------|
| **C32a** | Чеклист Visit Preview + `ALLOW_MOCK_TOPUP` (ниже + зеркало в staging) | docs | **done** |
| **C32b** | Protection Bypass for Automation + smoke header helper | ops + scripts | **docs done**; secret = human |
| **C32c** | `smoke:standalone` зелёный на Preview после C28 merge | ops/agent | **blocked SSO** (2026-08-29) до bypass |

## 4. C32a — чеклист Visit Preview + mock topup

### Перед ручным / smoke прогоном

1. Push ветки → дождаться Ready Preview (`https://ibm-cargo-*-*.vercel.app`).
2. Env Preview (зеркало Production), минимум:
   - `DATABASE_URL` → seeded `newlsu_lbm` (`client@example.com` / `demo1234`)
   - `NEXTAUTH_SECRET` (не только `AUTH_SECRET`)
   - **не** копировать `NEXTAUTH_URL=https://ibm-cargo.vercel.app`
   - `ALLOW_MOCK_TOPUP=1` (для signup→topup spine; seed client с балансом может обойтись без mock)
   - `S3_*` если нужен upload path (без S3 create без media всё ещё ок)
3. Открыть Preview кнопкой **Visit Preview** в PR / Vercel (SSO под владельцем проекта).
4. Проверка без логина: `GET /health` → `{ ok: true, databaseUrl: true }` (в браузере после SSO **или** с bypass header).
5. Login демо: `client@` / `broker@` / `admin@` · `demo1234`.

### Команды smoke (нужен bypass **или** отключённая Protection)

```bash
# доступность без записи в БД
TEST_API_URL=https://<preview>.vercel.app npm run probe:preview

# spine после C28 (pay-first ветка / post-merge)
TEST_API_URL=https://<preview>.vercel.app npm run smoke:standalone

# с bypass (секрет только в env / CI secrets, не в git):
VERCEL_AUTOMATION_BYPASS_SECRET=… TEST_API_URL=https://<preview>.vercel.app npm run smoke:standalone
```

Полный визуальный C↔B↔A: [`staging.md`](./staging.md) § «Визуальный чеклист».

## 5. C32b — Protection Bypass for Automation (ops)

Канон Vercel: [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

1. Vercel → проект **ibm-cargo** → **Settings → Deployment Protection**.
2. **Protection Bypass for Automation** → Create / copy secret.
3. Secret попадает в деплои как system env `VERCEL_AUTOMATION_BYPASS_SECRET` (для кода на самом Preview). Для **внешнего** CI/агента — скопировать в GitHub Actions secret / Cursor secret с тем же именем.
4. Клиентские запросы:

```bash
curl -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  -H "x-vercel-set-bypass-cookie: true" \
  https://<preview>.vercel.app/health
```

5. Репо: `scripts/lib/install-vercel-bypass.mjs` — side-effect wrap `fetch` во всех `scripts/smoke-*.mjs` и `probe-preview-access.mjs`, если задан `VERCEL_AUTOMATION_BYPASS_SECRET` или alias `VERCEL_PROTECTION_BYPASS`.
6. **Не** коммитить значение секрета. Ротация: regenerate в Dashboard → обновить CI secret → Redeploy не обязателен для внешних smoke (секрет сверяется с project settings).

Агент **не** может включить bypass без auth Vercel Dashboard / MCP.

## 6. C32c — Preview `smoke:standalone`

| Дата | Host | Bypass | Результат |
|------|------|--------|-----------|
| 2026-08-29 | Preview `ibm-cargo-o0eyq3bya-…` (ветка mobile / stack) | off | **SSO_BLOCK** — `probe:preview` / curl → 302 `vercel.com/sso-api` |
| 2026-08-29 | https://ibm-cargo-phi.vercel.app (prod, без SSO) | n/a | `/health` OK `databaseUrl: true` — baseline reachability; **не** зачёт C32c (нужен Preview + C28) |

**Разблокировка C32c:** человек создаёт bypass secret (C32b) → агент/CI: `VERCEL_AUTOMATION_BYPASS_SECRET` + `TEST_API_URL=<preview с C28/C31>` → `npm run smoke:standalone` → запись PASS в [`staging.md`](./staging.md).

Идеальный Preview для C32c: ветка `cursor/tnved-invoice-enrich-e1f0` (PR #19) или `main` после merge C28–C31.

## 7. Проверка (закрытие)

- [x] C32a чеклист в KB
- [x] C32b docs + smoke bypass helper
- [ ] C32c Preview spine PASS (ждёт ops secret)
- [x] Статус в [`plan-next-vector-c28.md`](./plan-next-vector-c28.md) + [`staging.md`](./staging.md)

## 8. Не в scope

Отключать Deployment Protection навсегда · Shareable Links как единственный путь CI · писать secret в `.env.example` со значением · smoke против `ibm-cargo.vercel.app` (чужой проект).
