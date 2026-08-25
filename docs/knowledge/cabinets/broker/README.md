# Контейнер broker (D16) — элементы UI

**Код:** `src/components/ved/BrokerCabinet.tsx` + `src/components/ved/broker/*`  
**Routes:** `app/broker/*` ≡ `containers/broker/app/*` (:3002) — parity OK

## Nav (`getBrokerNav`)

| Элемент | Route | Информирование | Взаимодействие |
|---------|-------|----------------|----------------|
| Дашборд | `/broker` | Очередь / в работе / SLA risk / avg; «Требуют внимания» | Claim; переход в work |
| Очередь | `/queue` | `.card` + `table.data`; AI %, SLA countdown; badges «для вас»/reserved | **Взять** (disabled если reserved); approve **не** здесь |
| В работе | `/work` | Mapping table, Δ AI≠broker, thumbs | Hs autocomplete; save; approve→PDF |
| Чат | `/chat` | `.card` + `.activity-list`; WorkChat = `.chat-box` | WorkChat (скрыт при QUEUED) |
| SLA | `/sla` | `.stats` + `.breakdown` AI vs правки (live) | Read-only |
| Выплаты | `/payouts` | `.stats` + `table.data`; pill Начисление/Документы/Выплачено | Read-only (PAID — admin) |
| Профиль | `/profile` | `.card` + `.field` + `toggle-row` | `acceptingJobs` checkbox |

Header: pill «Онлайн» / «Не принимает» ↔ `acceptingJobs` (F21); кнопка **Обновить** (+ soft poll 45с). Boot **loading ≠ empty очереди ≠ acceptingJobs off**.  
Footer: SLA `preferredClaimHours` + **Рейтинг ★ / закрыто за нед.** из `BrokerProfile` (`formatBrokerSideFoot`).

## Вложенные

| Элемент | Где |
|---------|-----|
| queueBadge preferred/reserved | QueuePane + `broker/types.ts` |
| HsCodeAutocomplete → `/api/v1/tnved/search` + карточка `GET :code` | WorkMapping; shared `HsCodeAutocomplete` + `TnvedCardDrawer` |
| AI draft `hsCodeAi` | WorkMapping — из heuristic ± **LLM corpus lookup** (backend); брокер правит в autocomplete |
| Reclassify («Запросить новый код AI») | WorkMapping → `POST …/reclassify` + feedback; **UI gated** `llmEnrichEnabled` |
| attrs read-only chips + **empty fill** | WorkMapping · `BrokerAttrsFill` |
| **Эталон завода (снимок)** | WorkMapping — `manufacturerSkuId` / `attrs.extra.sku`; брокер **не** пишет каталог |
| Подтвердить позиции / Утвердить и PDF / Сначала взять | WorkMapping |
| Эскалировать SLA (own IN_REVIEW) | WorkMapping → POST …/escalate |
| Empty-items guard (нельзя approve) | WorkMapping |
| EventsTimeline | WorkMapping |
| **Client feedback (`AI_READY`+)** | WorkMapping → `BrokerClientFeedback` |
| **Similar precedents** | WorkMapping → `BrokerSimilarPrecedents` (`CLIENT_HELPFUL` выше) |
| **Thin dossier (AI weak / no manufacturer)** | `BrokerDossierPane` — чеклист, запрос в чат, comment на approve |
| WorkChat waitingOn CLIENT/BROKER | work + chat |

## API

`calculations?scope=queue|mine` · claim · PATCH items · **reclassify** · approve · escalate · pdf/events · chat (+threads, unread) · payouts · me · brokers/me · platform/settings · uploads · tnved/search

## Domain gates

- Claim: `QUEUED` \| `SLA_RISK` (`CLAIMABLE_STATUSES`)
- Approve: `IN_REVIEW` \| `SLA_RISK` (`APPROVABLE_STATUSES`)
- Broker escalate: own `IN_REVIEW` → `SLA_RISK` (admin: QUEUED\|IN_REVIEW)
- Preferred exclusive: `preferredClaimHours` (worker release)

## Post-polish (2026-08-14)

| Gap | Статус | Канон |
|-----|--------|-------|
| Client feedback visible on DONE | **done** | `BrokerClientFeedback.tsx` · [`plan-broker-qc-loop.md`](../../plan-broker-qc-loop.md) |
| Similar approved HS + 👍 вес | **done** | `BrokerSimilarPrecedents` · [`plan-llm-fill-hints.md`](../../plan-llm-fill-hints.md) |
| Reclassify gate `llmEnrichEnabled` | **done** | WorkMapping + platform settings |
| Row TN VED duty/VAT hints | **done** | `applyTnvedRowHint` + HsCodeAutocomplete |
| Nav badge «В работе» | **done** | `BrokerCabinet` navWithBadge |
| Payouts/chat empty states | **done** | `VedEmptyState` |
| Thin dossier / запрос клиенту | **done** | `BrokerDossierPane` + `broker-dossier.ts` |
| Товарное описание + прочие сборы | **done** | [`plan-broker-desc-fees.md`](../../plan-broker-desc-fees.md) · item.description + `extraFeeRub` |
| Empty attrs fill | **done** | [`plan-broker-empty-attrs.md`](../../plan-broker-empty-attrs.md) · `fillEmptyProductAttrs` |
