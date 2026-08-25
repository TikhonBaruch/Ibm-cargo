# План: кабинет брокера — QC loop (2026-08-14)

Индекс: [`cabinets/broker/README.md`](./cabinets/broker/README.md) · ADR D27 · ветвь 2 [`branches.md`](./branches.md).

## 1. Идея

**Job брокера (D27):** QC оплаченного AI-черновика → правка ТН ВЭД / пошлин / НДС → чат при необходимости → approve → PDF клиенту + начисление доли.

Замкнуть петлю качества: клиентский отклик после DONE должен быть **виден брокеру**; инструменты mapping не должны обещать LLM на Vercel без ключа.

## 2. Анализ (as-is)

| Экран | Что делает брокер |
|-------|-------------------|
| Дашборд | KPI, «Требуют внимания», claim |
| Очередь | Взять оплаченную заявку (D11) |
| В работе | Mapping table, save, approve, reclassify, escalate |
| Чат | Ответ клиенту, вложения |
| SLA | Read-only метрики |
| Выплаты | ACCRUED / PAID read-only |
| Профиль | `acceptingJobs`, специализация |

**API:** `scope=queue|mine`, claim, PATCH items, approve, reclassify, escalate, chat, payouts, tnved.

**Gaps (до этого плана):**

1. `clientFeedback*` не в broker UI после merge PR #4.
2. Reclassify UI без gate `llmEnrichEnabled` → 400 на prod Vercel.
3. TN VED hints только на сводном HS, не на строках таблицы.
4. Nav badge только Очередь + Чат (нет «В работе»).
5. Payouts/chat empty — plain text vs `VedEmptyState`.

## 3. Структурирование (фазы)

| Фаза | Deliverable | Статус |
|------|-------------|--------|
| **B0** | KB plan + interactions | этот документ |
| **B1** | Client feedback на WorkMapping (DONE) | code |
| **B2** | Reclassify gate + copy | code |
| **B3** | Row duty/VAT hints из TN VED pick | code |
| **B4** | Nav badge «В работе», empty states, chat upload toast | code |
| **B5** | `test:ci` + PR → Vercel free tier | **done** |
| **B6** | Thin dossier: checklist + chat request + approve comment | **done** |

**Статус (2026-08-14):** B0–B6; досье — [`broker-dossier.ts`](../../src/lib/ved/broker-dossier.ts).

**Вне scope:** unclaim, SUPPORT inbox, SSE chat, shipping, public LLM CTA.

## 4. Реализация (файлы)

| Зона | Файлы |
|------|-------|
| Types | `src/components/ved/broker/types.ts` |
| Mapping + feedback | `WorkMapping.tsx`, `BrokerClientFeedback.tsx` |
| Orchestrator | `BrokerCabinet.tsx` |
| Polish | `PayoutsPane.tsx`, `ChatThreadsPane.tsx`, `WorkChat.tsx` |
| KB | `cabinets/broker/*`, `design-parity.md` |

## 5. Проверка

- `npm run test:ci`
- Manual: `broker@example.com` → work → DONE calc with client feedback → виден отклик
- Reclassify disabled when admin toggles LLM off
- Row HS pick → soft fill duty/VAT

## 6. Деплой

- PR → merge `main` → Vercel Hobby auto-deploy (без отдельного split DB).
- Миграции не требуются (feedback columns уже на sweb).

## 7. Следующий backlog (post-B6)

- Broker edit empty attrs only — [`plan-broker-empty-attrs.md`](./plan-broker-empty-attrs.md)
- Pre-approve PDF preview (Growth)
- Extract dashboard/profile → panes (tech-debt)
- Manufacturer catalog inherit (D29)
