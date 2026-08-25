# Dual-path parity (Next ↔ containers/api)

Checklist for **D24 + D26** writers before marking polish F19 done.  
Индекс KB: [`README.md`](./README.md) · очередь после polish: [`roadmap.md`](./roadmap.md) §«Post-polish» · notify ops: [`runbook.md`](./runbook.md).  
Gate: same behaviour when `USE_DOMAIN_API=0` (Prisma in Next) and `=1` (proxy → `containers/api`).

## Mutations (must match)

| Path | Next | `containers/api` | Notes |
|------|------|------------------|-------|
| Create + draft | `createAndDraftCalculation` | `POST /v1/calculations` | attrs / tnvedCode / events; invoice FX + `landedWithoutFreight`; **enqueue `AI_DRAIN`** если `llmEnrichEnabled` и задан OCR/LLM URL |
| Attr suggest chips | `POST /api/v1/calculations/attr-suggest` | same | heuristic fill-stage; UI never calls LLM |
| Pay | `payCalculation` | `POST …/pay` | ledger + QUEUED/DONE; outbox |
| Claim | `claimCalculation` | `POST …/claim` | preferred window; **acceptingJobs** |
| Map items | PATCH items | same | soft tnved; item.description; extraFee; empty attrs fill |
| Reclassify | `POST …/reclassify` | same | WorkMapping feedback → LLM (skip precedent); stays `IN_REVIEW` |
| Import preview | `POST /api/v1/imports/products/preview` | Next-only (`mustStayOnNext`) | CSV/XLSX/PDF → rows + precedent/LLM classify; D10 limit |
| Approve | approve + PDF + outbox-in-tx | same | D26; write-back `verified_determinations` |
| Chat SUPPORT | create / reply / status | same | admin inbox + archive; `box=` filter |
| Chat unread ADMIN | `GET chat?scope=unread` | same | `countAdminUnread` — OPEN + waitingOn BROKER |
| Brokers list | marketplace + acceptingJobs | same | empty if marketplace off |
| Queue list | empty if !acceptingJobs | same | |
| Maintenance | block create/pay | 503 | admins bypass |
| paymentsEnabled | block topup/pay | same | D28 |
| llmEnrichEnabled | skip external LLM | same | heuristic only |
| notifyEnabled | skip notify kick | same | D28 |
| Integrations snapshot | `GET platform/integrations` | same | payments/llm/**notify** + toggles |
| Orch health deps | payments/llm/ai/notify/logistics/**ocr** | same | dual-path probe list must match |
| Company admin detail | `GET /v1/company/:id` | same | ADMIN_ROLES |
| Company ADJUSTMENT | `POST /v1/company/:id/adjust` | same | ledger ADJUSTMENT + audit; **PROTECTED_V1** |
| Manufacturer SKU | `POST/PATCH /v1/manufacturer/skus` | same | D31 catalog; not D8 |
| Factory consolidate | `POST /v1/factory/requests` · accept/confirm pools | same | D34; not D8 |
| Published catalog | `GET /v1/catalog/skus` | same | CLIENT/BROKER; PUBLISHED only |
| Create + SKU FK | `items[].manufacturerSkuId` | same | snapshot attrs; optional |
| Brokers PATCH | moderation + **acceptingJobs** | Next `PATCH /api/v1/brokers` (web session); domain list/me already dual-path | admin pause ≠ `/brokers/me` |
| GET TN VED card | `getTnvedCard` | `GET /v1/tnved/:code` | envelope: ancestors + rate (ETT or null) + paymentsHint 22%/ПП 1637 |
| Orch retry | `POST /api/v1/platform/orch` | Next-only admin session (Prisma helpers) | FAILED/DEAD → requeue |

## Ops / observability

| Check | Command / URL |
|-------|----------------|
| Unit + contracts | `npm run test:ci` |
| Orch health (internal) | `GET /api/v1/internal/orch/health` + `x-internal-key` |
| Orch admin UI | `GET /api/v1/platform/orch` (session ADMIN) |
| Integrations admin | `GET /api/v1/platform/integrations` (session ADMIN) · [`admin-ops.md`](./admin-ops.md) |
| C5 gateway | `npm run smoke:gateway` (compose `:8080`) |
| Live MVP | `npm run smoke:mvp` / `smoke:full` |

## Notify email (F17)

On host running `containers/notify` (or Compose profile with notify):

1. Set `NOTIFY_SERVICE_URL` on web/api (e.g. `http://notify:4400`).
2. Set **either** `RESEND_API_KEY` **or** `SMTP_URL` (+ `SMTP_FROM`).
3. Optional `NOTIFY_OPS_EMAIL` for SLA alerts.
4. Confirm outbox drain: worker → `POST /v1/internal/outbox/drain`; templates in `d-event.notify.json`.
5. Without keys: email is **not** marked DELIVERED (queued/FAILED until Resend/SMTP). Vercel inline path uses `RESEND_API_KEY` only.

```bash
# Vercel (prod dual-path, no notify container):
vercel env add RESEND_API_KEY production   # already need SMTP_FROM
vercel --prod
npm run ops:track-a -- --vercel
# Then: broker approve → client inbox; or drain with x-internal-key
```

See [`runbook.md`](./runbook.md) · [`containers/notify/README.md`](../../containers/notify/README.md) · [`plan-track-a-p0.md`](./plan-track-a-p0.md) A2.

## Customs fees canon

| Artifact | Role |
|----------|------|
| `src/lib/ved/customs-fees.ts` | **Canon** (VAT 22%, PP 1637 brackets, `customsOperationsFeeFromUsd`) |
| `containers/{api,ai,llm}/src/customs-fees.js` | Compose mirrors — keep brackets identical |
| `llm/services/classification/src/customs-fees.js` | Matrix source for `sync:ai-matrix` |

Do not diverge fee tables between TS and JS. Unit: `customs-fees.test.ts`.
