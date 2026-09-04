# Client — взаимодействия

| Действие | Эффект |
|----------|--------|
| Create (+ preferred, attrs, media, **optional published SKU**, **hsHint from directory combobox and/or heuristic top-N**, **attr chips** composition/purpose/color/age, **invoice currency USD/CNY/EUR**) | `AI_READY`; preferred на calc; `manufacturerSkuId` + снимок attrs; optional **LLM enrich**; `aiDraft.landedWithoutFreight`; UI: progressive tips / **HS search** / **attr-suggest chips** ([`plan-llm-fill-hints.md`](../../plan-llm-fill-hints.md)) |
| Upload → `mediaUrl` | `POST /api/v1/uploads`; compose local `storage: local` + `GET /uploads/ved/...` |
| CSV/XLSX/PDF/JPG table → preview → create | `POST /imports/products/preview` (`csv` / `xlsxBase64` / `pdfBase64` / `imageBase64` / file); apply из `NewCalcPane` pack dropzone; лимит D10; пустое фото = 200 |
| Pay / topup-then-pay | Ledger → `QUEUED` или Express `DONE`+PDF; preferred → broker reserved |
| **Result feedback (`AI_READY`+)** | `POST …/feedback` — 👍/👎 на черновик ТН ВЭД или финальный PDF; один раз; NOTE в EventsTimeline |
| Chat CALCULATION | `waitingOn` BROKER; broker threads «ответ» |
| SUPPORT create / read / close | ticket + полный тред (`GET ?threadId=`); вкладки Активные / Архив; Close / Reopen; admin reply → `WAITING_CLIENT` |
| Topup | TOPUP ledger; pending+confirmUrl; optional notify |
| Shipping create (flag on) | Только calc `DONE` (D15) |
| Preferred на BrokersPane | Локально + в pay/create payload |
| Завод: запрос qty | `POST /factory/requests` → очередь производителя; не D8 |
| Завод: просчёт с карточки | `/new?sku=&qty=&request=` → create + `POST …/link-calc` |
| Сегмент компании | PATCH `clientSegment` (SINGLE / RETAIL_SMALL / WHOLESALE) |
| Deep-link `/orders?id=` | Открывает OrderDetail + чат; sync URL при openCalc |

## Статусные ворота (клиент)

| Статус | UI |
|--------|-----|
| AI_READY / AWAITING_PAYMENT | Pay / «Пополнить и оплатить» (list + detail) |
| QUEUED / IN_REVIEW / SLA_RISK / DONE | OrderChat (не pay) |
| AI_READY+ (есть HS) | **реакция на черновик** (OrderDetail) |
| DONE | PDF в таблице заявок; **реакция на результат** если ещё не ставили; shipping* |
| CANCELLED | Не в «активных» |

## Feedback

- `VedToast` (`useVedToast`) — pay / topup / support sent / upload error / **result feedback** (banner остаётся для blocking).
- Unread: KPI на дашборде **и** badge на nav «Поддержка» + «Заявки» (`scope=unread` = CALC + **активные** SUPPORT, `waitingOn=CLIENT`); archive/RESOLVED не в badge.

## Polish UX (закрыто 2026-08-10)

| Gap | Решение |
|-----|---------|
| Дубль `/settings` · `/profile` | Один nav «Профиль»; `/settings` → redirect `/profile` (web + `containers/client`) |
| Support → заявки без id | `orderHrefFor(id)` → `/orders?id=` |
| Unread только Support | Badge также на «Заявки»; KPI = полный count |
| List pay без topup | CTA «Пополнить и оплатить» в full **и** compact таблице |
| SUPPORT fire-and-forget | Клиент открывает полный тред (не accordion), пишет ответ, закрывает / открывает снова |
