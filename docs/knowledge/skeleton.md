# Каркас проекта (skeleton)

Единая карта структуры и запретов для агентов и CI.  
Индекс KB: [`README.md`](./README.md). Инварианты: [`decisions.md`](./decisions.md) (D1–D33). Ownership: [`branches.md`](./branches.md).  
Данные товаров / ТН ВЭД / история: [`data-model.md`](./data-model.md) (D24).  
Инкотермс / комментарии ICC (Growth hold): [`incoterms.md`](./incoterms.md).  
Таможенные платежи (НДС 22% / сбор ПП 1637): [`customs-payments.md`](./customs-payments.md).  
Signup CLIENT: **D25** · orch durable: **D26** · фокус частник: **D27** · ADMIN ops: **D28** · стратегия persona/сеть: **D29** ([`target-client.md`](./target-client.md)) · [`current-app.md`](./current-app.md) · [`admin-ops.md`](./admin-ops.md).
Контейнерные ответвления: [`containerization.md`](./containerization.md). Dual-path: [`dual-path-parity.md`](./dual-path-parity.md).  
Машинные проверки: `npm run test:structure` → [`scripts/verify-structure.cjs`](../../scripts/verify-structure.cjs).

## Карта папок

```text
app/                      # Next routes (Vercel web) + /api/v1 session API
app/cabinet/**            # Client surface routes → ClientCabinet (domain)
app/client/**             # UI lab lbm-bro (visual; DemoProvider, не /api/v1)
app/broker/**             # Broker surface routes → BrokerCabinet
app/admin/**              # Admin VED (D28: integrations/users/audit/settings) → AdminVedCabinet
app/api/v1/**             # Domain HTTP (session); optional proxy → containers/api
src/lib/ved/              # Domain: calculations, domain, ledger, access, settings,
                          # product-description, tnved, calculation-events (D24),
                          # orchestration / orch-health (D26), platform-gates,
                          # integrations / super-admin / infra-access (D28)
src/components/ved/       # Cabinets + LbmCabinetsShell (live) + VedShell (manufacturer/widgets)
src/components/ved/client/# Client panes (ветвь 1)
src/components/ved/broker/# Broker panes (ветвь 2)
src/lbm-bro/              # UI lab visual (не domain; план: plan-lbm-bro-visual.md)
docs/knowledge/cabinets/  # Инвентарь UI по контейнерам client/broker/admin + correctness
prisma/                   # Schema + seed (Tnved* / CalculationEvent / orch tables D26)
containers/api            # Domain extract (USE_DOMAIN_API=1) → C1 — D24/D26 writers parity
containers/ai             # AI draft heuristic-v1 → C3 (D21); enrich via llm
containers/worker         # SLA_TICK / OUTBOX_DRAIN / BackgroundJob (D26)
containers/broker         # Next UI :3002 (D16)
containers/client         # Next UI :3003 (D17)
containers/admin          # Next UI :3001 (D20/D28) — support + orch + tnved + integrations + users + audit
containers/payments|notify|llm|logistics  # C4 envelopes; providers opt-in (growth.md)
containers/ocr            # P2 :4700 — d-ocr.ai.json; create fail-open when OCR_SERVICE_URL set
containers/web            # Full Next Docker build; C5 slim = scaffold + smoke:gateway
docs/knowledge/           # Единая KB (README = индекс; dual-path-parity, roadmap post-polish)
AGENTS.md                 # Правила для агентов
.cursor/rules/            # Cursor mdc
```

## Ownership (куда писать код)

| Зона | UI | Domain |
|------|-----|--------|
| Клиент | `ved/client/*`, `/cabinet`, `containers/client` | create/pay/shipping/topup/chat (+ optional `items[].attrs`) |
| Клиент UI lab | `src/lbm-bro/*`, `/client` (не extract) | референс + DesignerStub; live = `/cabinet` ([`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md)) |
| Брокер | `ved/broker/*`, `/broker`, `containers/broker` | claim/approve/items/payouts/SLA (+ acceptingJobs gate) |
| Ядро | `proxy.ts` (Node UI), `access.ts`, `require-path-access`, `ved/proxy` BFF, ledger, tariffs, settings, `platform-gates` | статусы D8, pay-before-queue D11, D24 events/TN VED, D26 orch |
| Admin | `AdminVedCabinet`, `/admin/*` VED (D28) | SUPPORT, orch (+retry), tnved import, integrations (+notify), toggles, users create/reset, client ADJUSTMENT, calc deep-link+PDF, finance CSV, broker acceptingJobs |
| AI | `src/lib/ved/ai.ts`, `containers/ai` | draft only, не финальный HS |
| Legacy CMS | obscure SUPER surface (D6/D28) | не лицо продукта; не в `containers/admin` |

## Запреты (красные флаги)

1. **Очередь без оплаты** — нельзя `QUEUED` без `pay` / ledger charge (D11).
2. **Synthetic item id** — запрещён `id: "synthetic"`; всегда реальные `CalculationItem` (D15).
3. **Брокер не трогает** `TariffPlan.priceRub` — только duty/VAT/fee/item HS (D15).
4. **Prisma в UI-контейнерах** — `containers/broker` и `containers/client` без `@prisma/client` (D16/D17).
5. **CMS как продукт** — не расширять posts/portfolio как основной UX (D6); SUPER credentials не в публичных демо (D28).
6. **Лимиты позиций** — EXPRESS 1 / STANDARD ≤3 / PRO ≤10 (D10).
7. **Shipping до DONE** — заявка на перевозку только после `DONE` (D15).
8. **D24 dual-path** — меняя create/pay/claim/map/approve events или attrs/`tnvedCode`, обновить и `src/lib/ved/calculations.ts`, и `containers/api` ([`dual-path-parity.md`](./dual-path-parity.md)).
9. **D26** — orch tables не дублируют D8 FSM; outbox enqueue в той же tx, что domain mutation.
10. **D27** — не смешивать Growth (shipping/LLM/live pay) в текущий CTA частника.
11. **D28** — URL/keys payments/LLM не из ADMIN UI; SUPER не в users/audit UI; toggles через `platform-gates` + dual-path.
12. **D29** — стратегия производителя / buyer-groups / master-data габаритов не подменяет CTA D27 ([`target-client.md`](./target-client.md)).
13. **D32** — UI: сначала общепризнанный паттерн; не второй toast/drawer/shell ([`design-patterns.md`](./design-patterns.md)).
14. **D33** — без письменного плана в `docs/knowledge/` код не писать; без записи в KB задачу не закрывать ([`feature-cycle.md`](./feature-cycle.md)).

## Checklist перед фичей

Полный процесс (D33: план → код → KB): [`feature-cycle.md`](./feature-cycle.md). Кратко:

- [ ] Есть письменный план в `docs/knowledge/` **до** кода (D33)?
- [ ] Какая ветвь (1/2/3)? Папка ownership совпадает?
- [ ] Нужен ли новый ADR или хватает D1–D33 / containerization C*?
- [ ] UI от baseline D14 / `ved-ui-cabinets-baseline` (не откатывать к MVP-шеллу / `CabinetsApp`)?
- [ ] Кабинет UX: empty state / drawer / toast по [`cabinets/ux-saas.md`](./cabinets/ux-saas.md); очередь клиент→брокер→админ?
- [ ] Unit на инвариант в `src/lib/ved/__tests__/`?
- [ ] Dual-path: Next + `containers/api`, если мутация domain?
- [ ] `PROTECTED_V1_MUTATIONS` обновлён, если новая чувствительная мутация?
- [ ] При смене данных — [`data-model.md`](./data-model.md) / contracts?
- [ ] LLM enrich / corpus lookup / local uploads / **precedent БД-2** / CSV·XLSX·PDF import / broker reclassify — [`ai-pipeline.md`](./ai-pipeline.md) + [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) + [`runbook.md`](./runbook.md); smoke `smoke:chain-llm` / `smoke:precedent-csv` / `smoke:csv-import` / `smoke:pdf-import` / `smoke:reclassify` / `smoke:precedent-vector` (skip OK) при compose `scale`?
- [ ] OCR vision (`imageBase64`) — только после ключа; hold D30 · [`plan-ocr-vision.md`](./plan-ocr-vision.md); не включать в CTA D27?
- [ ] Settings/gates / ADMIN ops — [`admin-ops.md`](./admin-ops.md) + [`cabinets/shared/correctness.md`](./cabinets/shared/correctness.md)?
- [ ] `npm run test:ci` зелёный (unit + structure + contracts + verify)?
- [ ] Запись в `docs/knowledge/` в том же PR (D33 — без KB не закрывать)?
- [ ] После UI — ручной C↔B↔A ([`staging.md`](./staging.md)) или `smoke:mvp`?

## Демо

`client@example.com` / `broker@example.com` / `operator@example.com` / `admin@example.com` (ADMIN) — пароль `demo1234`.
