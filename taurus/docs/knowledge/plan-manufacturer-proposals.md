# План: производители (rename + предложения + модерация ADMIN)

Индекс: [`cabinets/client/README.md`](./cabinets/client/README.md) · [`cabinets/admin/`](./cabinets/admin/) · D25 / D31 / D32 / D33 / D34.  
Ветви: 1 клиент · 2 брокер · 3 ядро · ADMIN.

## 1. Идея

1. В UI клиента/админа/брокера **«Завод» → «Производитель»** (product language).
2. Выбор производителя — **одна строка с подсказками** (combobox), не только native select SKU.
3. CLIENT/BROKER могут **добавить нового** производителя в список без ожидания админа (черновик).
4. В **постоянный каталог** (подсказки всем, Company `MANUFACTURER`) — только после **утверждения ADMIN**.
5. В админке — **отдельный раздел** модерации и управления такими записями.

Сборный заказ D34 (`SkuOrderRequest` / пулы) **не ломаем**: route `/cabinet/factory` остаётся; copy и UX выбора — производитель. Эталон SKU по-прежнему нужен для qty-запроса; на NewCalc — строка производителя (+ опц. SKU если уже выбран из каталога).

## 2. Анализ

| As-is | Gap |
|-------|-----|
| Copy «Завод», `/factory` | Rename labels (route hold) |
| `SkuCatalogSelect` = native select PUBLISHED SKU | Combobox имени производителя + hints |
| MANUFACTURER только через ADMIN invite | Proposal PENDING от client/broker |
| Publish SKU = self-serve manufacturer | Не путать: здесь модерация **компании-производителя**, не SKU |
| Admin: заводы внутри «Клиенты» | Отдельный nav «Производители» |

Канон: D25 нет публичного signup производителя; approve ADMIN **создаёт shell Company** без логина (инвайт — отдельно в Users). D15 брокер не пишет ManufacturerSku; может предложить имя. D32: combobox / soft callout / StatusPill / VedToast — не wizard.

## 3. Структурирование

### E1 — БД

```text
ManufacturerProposalStatus: PENDING | APPROVED | REJECTED

ManufacturerProposal
  name, country?, note?
  status
  proposedByUserId, sourceRole (CLIENT|BROKER)
  approvedCompanyId?  // set on APPROVED
  reviewedByUserId?, reviewedAt?, rejectReason?
```

`attrs.manufacturerName` в product attrs (sanitize). Связь calc↔proposal — опционально в `attrs.extra.manufacturerProposalId` (без колонки на item в v1).

### E2 — API (dual-path)

| Кто | Метод | Path |
|-----|-------|------|
| CLIENT/BROKER | GET | `/api/v1/manufacturers/directory?q=` — APPROVED companies + свои PENDING |
| CLIENT/BROKER | POST | `/api/v1/manufacturers/proposals` — создать PENDING |
| ADMIN | GET | `/api/v1/admin/manufacturer-proposals?status=` |
| ADMIN | POST | `…/proposals/:id/approve` → Company MANUFACTURER + link |
| ADMIN | POST | `…/proposals/:id/reject` |
| ADMIN | PATCH | company (уже есть) для утверждённых |

Hints: только APPROVED (всем) + собственные PENDING. Чужие PENDING не светятся в каталоге.

### E3 — UI

- Rename «Завод»→«Производитель» (nav, panes, admin filter, broker snapshot, NewCalc tips).
- `ManufacturerSuggest`: input + dropdown hints + CTA «Добавить в список».
- NewCalc: строка производителя вместо/вместо акцента на select SKU; SKU select — только если выбран утверждённый с PUBLISHED (опц. hold: скрыть select, оставить prefill `?sku=`).
- Admin: nav **Производители** — очередь PENDING + список APPROVED companies; approve/reject; deep-link в company drawer.
- Broker: то же поле в attrs fill / mapping (propose).

### E4 — hold

- Авто-инвайт User MANUFACTURER при approve
- Смена route `/factory` → `/manufacturers`
- ADMIN CRUD SKU (как в plan-admin-actors hold)
- Hard-reject calc без manufacturerName

## 4. Реализация

| Фаза | Статус |
|------|--------|
| План | **done** |
| E1–E3 | **done** — proposal + directory + ManufacturerSuggest + admin pane + rename |
| E4 | hold |

## 5. Проверка

- Unit: propose → directory shows own pending; approve → Company + status; reject; чужой pending не в directory.
- `test:ci` + contracts envelope.
- Ручной: client строка → добавить → админ approve → появляется в hints другому клиенту.

## 6. Деплой

Migrate отдельно от build → Vercel Hobby.
