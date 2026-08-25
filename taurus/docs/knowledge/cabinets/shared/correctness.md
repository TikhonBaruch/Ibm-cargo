# Проверка взаимосвязей и корректности

Проверка as-of 2026-08-05 по коду `src/components/ved`, `app/*`, `containers/{client,broker,admin}`, `src/lib/ved`.

## Route parity: web ↔ extract

| Поверхность | Web | containers/* | Вердикт |
|-------------|-----|--------------|---------|
| Broker | chat, queue, work, sla, payouts, profile | то же | **OK** |
| Admin VED | bookings…audit | то же (без Legacy CMS) | **OK** (CMS только root, D6) |
| Client | + **support**, **profile**, **factory** | pages в `containers/client` | **OK** |
| Manufacturer | catalog, demand, **pools**, preview, profile | `containers/manufacturer` | **OK** (D31 + D34) |

Shipping route есть в обоих; UI скрыт flag (`cabinet-features`).

## Domain ↔ UI consistency

| Связь | Ожидание | Факт | Вердикт |
|-------|----------|------|---------|
| Claim statuses | QUEUED \| SLA_RISK | `CLAIMABLE_STATUSES` | OK |
| Approve statuses | IN_REVIEW \| SLA_RISK | `APPROVABLE_STATUSES` | OK |
| Shipping after DONE | D15 | ShippingPane filters DONE; API rejects pre-DONE | OK |
| Preferred reserved | exclusive window | `queueBadge` + domain `preferredClaimHours` | OK |
| Brokers list client | APPROVED + acceptingJobs; empty if marketplace off | `resolveBrokersListFilter` | OK |
| acceptingJobs | влияет на queue | queue empty + claim blocked when false | OK |
| marketplaceEnabled | скрывает/открывает брокеров | CLIENT list empty when off | OK |
| autoAssignBrokers | auto claim/assign | After pay → claim preferred/top-rated | OK |
| maintenanceMode | блок create/pay | `assertNotInMaintenance` | OK |
| paymentsEnabled | блок topup/pay | `assertPaymentsEnabled` | OK |
| llmEnrichEnabled | skip external LLM | `requestAiDraft` / create | OK |
| notifyEnabled | skip notify kick | `kickNotifyDelivery` | OK |
| Local upload GET | compose `ved_uploads` + route | `app/uploads/ved/[filename]`; broker WorkMapping thumbs | OK (2026-08-12) |
| mockTopupAllowed | AND `ALLOW_MOCK_TOPUP` | `isMockTopupAllowedBySettings` | OK |
| preferredClaimHours admin UI | редактирование | поле в `/admin/settings` | OK |
| SUPPORT reply / status | ответ staff; Close / Archive / Reopen | `/admin/support` + `SUPPORT_REPLY` / `SUPPORT_STATUS` | OK |
| Integrations pane | health + ServiceCall I/O | `/admin/integrations` + notify card | OK |
| Client drill-down | company + ledger + ADJUSTMENT | `/admin/clients?company=` | OK |
| Calc deep-link | admin detail | `/admin/bookings?id=` | OK |
| Admin SUPPORT unread | badge | `countAdminUnread` · nav | OK |
| Admin users create/reset | no SUPER | `/admin/users` | OK |
| Audit без SUPER | no-op log + filter API | `/admin/audit` · `audit.ts` | OK |
| Unread KPI | client CALC+SUPPORT; broker CALC waitingOn=BROKER | `GET chat?scope=unread` · badge Заявки+Поддержка | OK |
| Broker escalate | own IN_REVIEW → SLA_RISK | `escalateSla` + route BROKER_ROLES; dual-path api | OK |
| PDF client | в карточке | OrderDetail banner + list PDF | OK |
| List pay vs OrderDetail | topup-then-pay | CTA в full **и** compact таблице | OK |
| Settings / Profile | один pane | `/settings` → `/profile`; nav без дубля | OK |
| Deep-link заявки | `/orders?id=` | openCalc + SupportPane links | OK |
| SUPPORT thread (client) | ответы staff + статусы | SupportPane tabs + `?threadId=` | OK |
| WorkChat на QUEUED | — | `null` до claim | OK (by design) |
| Uploads Vercel | S3 | 503 без `S3_*` | OK |
| Dual UI tree | запрет | `test:structure` | OK |
| Prisma in UI containers | запрет | package.json без prisma | OK |

## Корректные сквозные пути (smoke)

| Путь | Проверка |
|------|----------|
| Client pay → broker queue | `smoke:full` / `smoke:client` |
| Claim → approve → DONE | `smoke:broker` / `smoke:full` |
| Shipping pre-DONE reject | `smoke:shipping` |
| Topup | `smoke:payments` |
| Register MVP | `smoke:mvp` |

## Potential (не баг исполнения UI-контракта, а roadmap)

Shipping UI flag off · notify/LLM/YooKassa host · SSE chat · DOCS_REQUESTED payout step  

См. [`../../roadmap.md`](../../roadmap.md) §2.x · [`../../growth.md`](../../growth.md).

## Итог

Исполнение **ядра** (статусы D8/D11, claim/approve, preferred window, pay/ledger, chat CALCULATION, admin assign/escalate/PAID) — **корректно**.  
Закрыты UX-gaps D27: PDF в карточке, list topup-then-pay, SUPPORT inbox, settings enforcement (marketplace / acceptingJobs / maintenance / autoAssign), preferredClaimHours UI, admin orch (+ retry FAILED/DEAD), unread KPI.
**Client polish (2026-08-10):** settings→profile, deep-link `/orders?id=`, dual unread badges, compact topup-then-pay, SUPPORT thread read — [`../client/interactions.md`](../client/interactions.md).  
**D28 ADMIN ops:** payments/llm/notify/mock toggles, `/admin/integrations` (+ notify card), audit/users без SUPER, obscure SUPER CMS — [`../../admin-ops.md`](../../admin-ops.md).  
**ADMIN cabinet UX (2026-08-10):** client drill-down + ADJUSTMENT, calc `?id=` + PDF link, support unread badge, users create/reset — [`../admin/`](../admin/).  
**ADMIN ops P1 (2026-08-10):** `/tnved` import UI, finance filter+CSV, orch retry, broker acceptingJobs PATCH — D28 §7 · [`../admin/`](../admin/).  
P1b logistics/LLM/payments — Growth.
