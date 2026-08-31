# Кабинеты — инвентарь UI по контейнерам

Разделение продуктовых поверхностей (ветви 1–2 + админ VED) по контейнерам extract и shared UI.

| Контейнер | Порт | Web routes | Shared UI | Документ |
|-----------|------|------------|-----------|----------|
| [`containers/client`](../../../containers/client/) (D17) | 3003 | `/cabinet/*` | `src/components/ved/client/*` + `ClientCabinet` | [`client/`](./client/) |
| [`containers/broker`](../../../containers/broker/) (D16) | 3002 | `/broker/*` | `src/components/ved/broker/*` + `BrokerCabinet` | [`broker/`](./broker/) |
| [`containers/admin`](../../../containers/admin/) (D20) | 3001 | `/admin/*` (VED) | `AdminVedCabinet` | [`admin/`](./admin/) |
| [`containers/manufacturer`](../../../containers/manufacturer/) (D31) | 3004 | `/manufacturer/*` | `src/components/ved/manufacturer/*` + `ManufacturerCabinet` | [`manufacturer/`](./manufacturer/) |
| Shared shell / кросс-роль | — | LbmCabinetsShell (live C/B/A), VedShell (manufacturer + widgets) | `src/components/ved/*` | [`shared/`](./shared/) |

Оркестрация на Vercel: один Next (`app/cabinet|broker|admin`) → те же компоненты (Docker COPY, без dual tree).  
Live chrome: `LbmCabinetsShell` ([`plan-lbm-bro-visual.md`](../plan-lbm-bro-visual.md) фаза C). Lab lbm-bro на `app/client` — референс, не prod-лицо.  
Domain API: `app/api/v1` ↔ `containers/api` при `USE_DOMAIN_API=1`.

## Как читать

1. В папке роли: **элементы** (nav, panes, инфо, CTA) + **взаимодействия**.
2. [`ux-saas.md`](./ux-saas.md) — удобство по ветвям, SaaS-аналоги, очередь клиент→брокер→админ→производитель v1.
3. [`ui-guide.md`](./ui-guide.md) — **сводка UI:** сравнение трёх кабинетов, канон админа (D28), следующие шаги pane-split.
4. [`admin/schema.md`](./admin/schema.md) — **схема admin panel:** экраны ↔ API ↔ акторы, existing/required/future.
5. [`shared/correctness.md`](./shared/correctness.md) — проверка взаимосвязей и найденные разрывы.

## Сквозные цепочки (кратко)

```text
CLIENT create/pay → QUEUED → BROKER claim/map/approve → DONE+PDF
                 ↘ preferred → queue reserved → SLA tick release
CLIENT↔BROKER chat (CALCULATION, waitingOn; broker unread badge)
BROKER escalate own IN_REVIEW → SLA_RISK (also admin/tick)
ADMIN assign/escalate/PAID/moderation → влияет на queue/mine/client list
ADMIN clients drill-down → ADJUSTMENT ledger · calc deep-link `?id=` / `?company=`
SUPPORT ticket → admin `/support` reply / archive + unread
Platform gates → marketplace / acceptingJobs / maintenance / payments / llm / notify (`platform-gates`, D28)
ADMIN integrations → payments/llm/notify health + ServiceCall I/O + toggles ([`../admin-ops.md`](../admin-ops.md))
```

Удобство кабинетов: [`ux-saas.md`](./ux-saas.md) · сравнение ролей и UI roadmap: [`ui-guide.md`](./ui-guide.md).  
План волн (клиент → брокер → админ → супер): [`../plan-cabinets-d32.md`](../plan-cabinets-d32.md).

Карта ownership: [`../branches.md`](../branches.md) · ADR D14–D17/D20/D26–**D28** · [`../containerization.md`](../containerization.md) · correctness: [`shared/correctness.md`](./shared/correctness.md).  
ADMIN ops: [`../admin-ops.md`](../admin-ops.md) · Post-polish: [`../roadmap.md`](../roadmap.md) §«Post-polish» (1c–**1h** done на ветке).
