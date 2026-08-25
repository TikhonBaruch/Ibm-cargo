# Track A (P0) — деньги, notify, demo ADMIN

Узкий execution-план после обзора бизнес-логики.  
Стратегический контекст: обзор «ценность → акторы → D8/D11 → gaps»; Growth B/C **не** в этом треке.

## Решение по приоритету

| Трек | Содержание | Решение |
|------|------------|---------|
| **A (P0)** | Live topup · notify delivery · demo `ADMIN` vs `SUPER_ADMIN` | **Выбран** — закрывает путь к реальной выручке и ясным ops-ролям |
| B (P1) | ТН ВЭД каталог · LLM · OCR | Отложен до закрытия A1–A2 на prod (или параллельно ops) |
| C (P2) | Shipping UI · usdRate в UI · broker UX | После продажи ядра; не в CTA до 3PL-истории |

Обоснование: MVP idea-check уже зелёный; блокер «продаём за деньги» — mock topup и недоставленные письма, не качество HS и не перевозка.

---

## A1 — Живой topup (ЮKassa)

**Цель:** реальный клиент пополняет баланс без `ALLOW_MOCK_TOPUP`.

| Шаг | Где | Критерий done |
|-----|-----|----------------|
| 1 | Host payments (`PAYMENTS_SERVICE_URL` + ЮKassa keys) | `PaymentIntent` TOPUP → webhook → ledger credit |
| 2 | Vercel/prod: `ALLOW_MOCK_TOPUP` off (или только `DEMO_MODE`) | Mock не принимает деньги от реальных signup |
| 3 | Staging/preview: mock остаётся | Idea-check и smoke не ломаются |
| 4 | `smoke:payments` на prod с live path (или staging mirror) | PASS без mock |

Код уже: [`src/lib/ved/payments.ts`](../../src/lib/ved/payments.ts), webhook `/api/v1/webhooks/payments`.  
**Этот шаг — ops/keys + проверка**, не новый domain FSM.

**Статус 2026-08-07:** код готов; **keys на prod host ещё не закрыты** — demo path = mock topup (`ALLOW_MOCK_TOPUP`). Checklist ops: `PAYMENTS_SERVICE_URL`, ЮKassa shopId/secret, webhook URL → prod, затем `ALLOW_MOCK_TOPUP` off на prod (оставить на preview). Gate: `npm run ops:track-a -- --vercel`. **Не** снимать mock на prod до live `smoke:payments`.

---

## A2 — Доставка notify

**Цель:** клиент/брокер получают письма approve / SLA / topup.

| Шаг | Где | Критерий done |
|-----|-----|----------------|
| 1 | `RESEND_API_KEY` (или SMTP) на Vercel / notify container | Outbox drain → delivered |
| 2 | Проверить шаблоны `OUTBOX_TEMPLATES` | approve, SLA_RISK, topup |
| 3 | Runbook smoke | [`runbook.md`](./runbook.md) F17 checklist |

Код/outbox (**D26**) уже есть. **Этот шаг — keys + e2e проверка.**

**Статус 2026-08-07:** `SMTP_FROM` на Vercel есть; **`RESEND_API_KEY` на prod ещё нужен** (оператор). Код: drain/kick **не** помечают DELIVERED без ключа; `npm run ops:track-a -- --vercel`. После add key → redeploy → одно письмо после approve = F17 done.

---

## A3 — Demo роли ADMIN vs SUPER_ADMIN

**Цель:** не путать продукт (VED ops) с Legacy CMS.

| Аккаунт | Роль | Пароль | Что видит |
|---------|------|--------|-----------|
| `operator@example.com` | `ADMIN` | `demo1234` | VED `/admin/*` — **без** Legacy CMS |
| `admin@example.com` | `ADMIN` | `demo1234` | VED `/admin/*` (demo) |
| `client@example.com` | `CLIENT` | `demo1234` | `/cabinet` |
| `broker@example.com` | `BROKER` | `demo1234` | `/broker` |

`SUPER_ADMIN` / obscure CMS path: credentials only in seed / private ops — not listed in public KB.

**Код:** [`prisma/seed.ts`](../../prisma/seed.ts); surface [`src/lib/ved/super-admin.ts`](../../src/lib/ved/super-admin.ts).  
**UI RBAC:** `/admin` = ADMIN VED; obscure path = SUPER_ADMIN CMS only.  
**Проверка:** login `operator@` → `/admin` без CMS.

**Follow-on (done):** полный ADMIN ops-контур — toggles payments/llm/notify/mock, `/admin/integrations`, audit/users без SUPER — ADR **D28** · [`admin-ops.md`](./admin-ops.md).

---

## Порядок исполнения

```text
A3 (seed + docs)  →  можно сразу в репо
A2 (notify keys)  →  ops, параллельно
A1 (ЮKassa host)  →  ops; после A2 желательно (письма о topup)
```

После A1–A2 на prod — вернуться к треку **B** ([`roadmap.md`](./roadmap.md) §3 / Growth P1b).

## Вне скоупа Track A

- Shipping UI go-live, LLM как обязательный matcher, публичная регистрация брокеров, новая админ-панель с нуля, вторая FSM поверх D26.
