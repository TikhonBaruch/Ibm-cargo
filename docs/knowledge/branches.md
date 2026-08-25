# Три продуктовые ветви

Карта владения зонами VED. Сопоставление gaps → done: см. [`decisions.md`](./decisions.md) D15.

## Ветвь 1 — Клиент

| Зона | UI | API |
|------|----|-----|
| Просчёт + позиции + файлы | `/cabinet/new` (+ `containers/client`) | `POST /api/v1/calculations` + items D10 |
| Заявки / pay / preferred | `/cabinet`, `/cabinet/orders`, brokers | `…/pay`, preferred на create/pay |
| Логистика после DONE | `/cabinet/shipping` (**UI off** by default: `NEXT_PUBLIC_SHIPPING_UI=1`) | `POST /shipping` → quotes + tracking (demo-3pl / stub); domain всегда доступен |
| Чат / баланс / support | order card, `/cabinet/balance`, `/cabinet/support` | chat+uploads; topup; SUPPORT ticket + archive; unread badge |
| Удобство кабинета | empty states, один CTA на статус | канон [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) · очередь **клиент → брокер → админ** |
| UI lab (lbm-bro) | `/client/*` — суперприложение, demo-store | референс; live лицо = `/cabinet` · [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) |
| Профиль | `/cabinet/profile` (`/settings` → redirect) | PATCH company |
| Завод / сборный заказ | `/cabinet/factory` | запрос qty к PUBLISHED SKU; сегмент `clientSegment` |
| Deep-link заявки | `/cabinet/orders?id=` | openCalc + support links |
| Extract | gateway `/client-app/` | D17 Next; `USE_DOMAIN_API` → api |

## Ветвь 2 — Брокер

| Зона | UI | API |
|------|----|-----|
| Очередь / claim | `/broker/queue` (+ `containers/broker`) | `claim`, list `scope=queue`; preferred timeout D15/D16 |
| Таблица сопоставлений + цены | `/broker/work` | `approve` / `PATCH …/items`; thumbs; attrs read-only; escalate own IN_REVIEW |
| Чат | `/broker/chat` + work | `/api/v1/chat` + uploads; `waitingOn`; nav unread badge |
| Выплаты / SLA | `/broker/payouts`, `/broker/sla` | payouts; avg SLA / on-time / AI≠HS bars |
| Domain extract | gateway `/api/domain/` | `containers/api` claim/approve/escalate (`USE_DOMAIN_API=1`) |
| Удобство кабинета | queue as triage; `acceptingJobs` режет queue list + claim | [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) §4 |


## Ветвь 4 — Производитель (D31)

| Зона | UI | API |
|------|----|-----|
| Каталог SKU | `/manufacturer/catalog` (+ `containers/manufacturer`) | `GET/POST /api/v1/manufacturer/skus`, `PATCH …/skus/:id` |
| Спрос (без ПДн) | `/manufacturer/demand` | агрегаты `demandCalcCount` / `DONE` |
| Сборные заказы | `/manufacturer/pools` | принять/отклонить запрос; подтвердить пул (D34) |
| Превью карточки | `/manufacturer/preview` | `clientPreview` → attrs снимка |
| Профиль завода | `/manufacturer/profile` | `GET/PATCH /api/v1/manufacturer/company` |
| Доступ | инвайт ADMIN / seed | нет публичного signup (D25) |

Не участвует в D8 FSM. Сборный заказ (D34) — отдельные `SkuOrderRequest` / `SkuOrderPool`, не статусы заявки.

## Ветвь 3 — Трёхстороннее ядро

```text
CLIENT → create/pay/preferred → PLATFORM ledger/queue
AI → draft HS/payments
BROKER → claim/mapping/prices/approve → PDF + payout
PLATFORM → assign/escalate/tariffs/audit/integrations/toggles (D28)
```

Статусы: D8. Очередь только после оплаты: D11.  
Worker live (`SLA_TICK`); AI = heuristic-v1 ± optional llm (C3/D21); payments/notify/logistics = C4 envelopes + opt-in providers ([`growth.md`](./growth.md)).  
Данные: товары `attrs` / ТН ВЭД / `CalculationEvent` — [`data-model.md`](./data-model.md) (D24); writers в ядре (`src/lib/ved` + `containers/api`).  
ADMIN ops: [`admin-ops.md`](./admin-ops.md) (D28).  
Удобство кабинетов (SaaS-паттерны, группы admin-nav, производитель v1): [`cabinets/ux-saas.md`](./cabinets/ux-saas.md).  
Карта контейнеров: [`containerization.md`](./containerization.md).  
Параллельные пакеты (D35): [`plan-parallel-ownership.md`](./plan-parallel-ownership.md) · [`../../src/lib/ved/PACKAGES.md`](../../src/lib/ved/PACKAGES.md).  
Диалоги ядра (client / broker / llm) и сценарии S1–S6: [`core-dialogues.md`](./core-dialogues.md).  
Контракты envelopes: [`../contracts/`](../contracts/) (в т.ч. D-PRODUCT / D-TNVED / D-HISTORY).  
Индекс KB: [`README.md`](./README.md).

## Гибрид назначения брокера

1. Клиент задаёт `preferredBrokerUserId` (optional).
2. Иначе любой брокер `claim` из очереди.
3. Admin `assign` перекрывает оба.

## Параллельный трек: визуал кабинетов (lbm-bro)

**Не смешивать** с go-live ядра / D36 / domain PR.

| Трек | Ветка / PR | Ownership | Правило |
|------|------------|-----------|---------|
| **Standalone MVP + API** | `main` (2026-08-25) | ветвь 3 + smoke | heuristic → pay mock → broker → PDF |
| **Визуальный skin** | `cursor/lbm-bro-visual-study-e1f0` (#9) | UI ветви 1–2 | D32: reuse `VedShell` / patterns; не второй toast API |
| **Backend max** | `cursor/mvp-max-standalone-ff9f` | docs + smoke KB | без restyle panes |

Канон прототипа: [`../../docs/plan-lbm-bro-skin.md`](../../docs/plan-lbm-bro-skin.md) · план max: [`plan-max-standalone-mvp.md`](./plan-max-standalone-mvp.md).
