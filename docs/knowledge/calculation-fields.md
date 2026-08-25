# Поля заявки (Calculation): обязательность и видимость ролей

Канон UI/API для просчёта. ADR фокуса: [`decisions.md`](./decisions.md) **D27**. Данные: [`data-model.md`](./data-model.md) (D24).  
Контракты: [`d-calc.client.json`](../contracts/d-calc.client.json) · [`d-product.calc.json`](../contracts/d-product.calc.json) · [`d-map.broker.json`](../contracts/d-map.broker.json).

**Hold:** полный справочник ТН ВЭД, LLM enrich, shipping UI — не блокер этой матрицы (heuristic + ручной HS брокера).  
Базис / Инкотермс (комментарии ICC) — [`incoterms.md`](./incoterms.md); не MVP-обязательное поле.  
Платежи (НДС/сбор/акциз hold) — [`customs-payments.md`](./customs-payments.md).

Legend: **R** = required · **O** = optional · **E** = edit · **V** = view · **W** = write on map/approve · **S** = system · **—** = не в UI роли · **PDF** = только в PDF.

---

## 1. Обязательность при create (CLIENT)

| Поле | Required | Примечание |
|------|----------|------------|
| `title` | **R** | UI + API (min 2) |
| `description` | **R** | UI + API (min 5) |
| `items[]` с ≥1 `name` | **R** | UI; API может fallback на title/desc |
| item attrs `originCountry` (ISO-2) | **R** | Страна происхождения; UI + API hard-reject |
| item attrs `manufacturerName` | **R** | Производитель; UI + API hard-reject |
| item attrs `composition` | **R** | Состав / материалы; UI + API hard-reject |
| `tariffCode` | soft | default STANDARD |
| `country`, `shipmentValue` | O | default country в форме «Китай»; валюта инвойса USD/CNY/EUR |
| `shipmentCurrency` | O | default USD; в `shipmentValue` суффикс (`15000 CNY`) |
| `preferredBrokerUserId` | O | |
| item `qty`, `unitPrice`, `mediaUrl` | O | |
| Прочие attrs | O | см. §3 |
| item `description` / `unit` / `currency` | O | currency default USD; редко в UI |

---

## 2. Матрица видимости (UI as-is target)

### Calculation (шапка)

| Поле | CLIENT create | CLIENT detail | BROKER work | ADMIN detail |
|------|---------------|---------------|-------------|--------------|
| `number`, `status` | — / V | V | V | V |
| `title` | **E** R | V | V | V |
| `description` | **E** R | **V** | **V** (клиентский текст; не PATCH) | **V** |
| `country`, `shipmentValue` | E O | **V** | **V** | **V** |
| `landedWithoutFreight` (в `aiDraft`) | — | **V** (смета без доставки) | **V** | **V** |
| `tariff` | E | V | V | V |
| `preferredBrokerUserId` | E O | E at pay | V badge | — |
| `hsCode` / `hsCodeFinal` / confidence | — | V | V + **W** final | via items |
| `dutyRub` / `vatRub` / `feeRub` / totals | — | V | V + **W** fee | — |
| `extraFeeRub` / `extraFeeNote` | — | V | **W** (note, если сумма > 0) | V |
| `brokerComment` | — | **V** (после approve) | **W** | **V** |
| Events timeline | — | V | V | V |
| PDF | — | V when DONE | V when DONE | V if present |
| Pay / chat / assign | pay+chat | — | chat | assign/escalate |

### CalculationItem

| Поле | CLIENT create | CLIENT detail | BROKER work | ADMIN detail |
|------|---------------|---------------|-------------|--------------|
| `name` | **E** R | V | V | V |
| item `description` | E O | V + «как описал брокер» | **W** (товарное для PDF; не calc.description) | V |
| attrs subset (brand, material, origin, weight, hsHint, **composition / purpose / extra.color / extra.ageGroup**) | E (§3) + **attr chips** | V | V + **W empty only** | V |
| other attrs (`model`, …) | schema O | — | — | — |
| `qty` / `unitPrice` | E O | V (если заданы) | unitPrice **W** | — |
| `mediaUrl` | E O | V | V thumbs | — |
| `hsCodeAi` / `hsCodeFinal` | — | V | V / **W** | V |
| `dutyRub` / `vatRub` | — | V after map | **W** | — |

Broker **не** перезаписывает заполненные product attrs / name / `Calculation.description` / `TariffPlan.priceRub` (D15).  
Может **дописать пустые** attrs (`fillEmptyProductAttrs`) — [`plan-broker-empty-attrs.md`](./plan-broker-empty-attrs.md).  
Товарное описание позиции и прочие сборы — **W** на mapping ([`plan-broker-desc-fees.md`](./plan-broker-desc-fees.md)).

---

## 3. Политика attrs (без полного справочника ТН ВЭД)

| Тариф | Правило |
|-------|---------|
| **Все тарифы** | **R:** `originCountry` (ISO-2), `manufacturerName`, `composition` — UI disable CTA + Zod/`createAndDraft` hard-reject ([`plan-required-create-attrs.md`](./plan-required-create-attrs.md)) |
| **EXPRESS** | Прочие attrs **optional** (1 позиция, быстрый путь) |
| **STANDARD** / **PRO** | Дополнительно рекомендуется ≥1 из: `brand`, `material`, `netWeightKg`, `hsHint`. Soft-warn в UI если пусто. |
| Полный каталог attrs | `model`, `technicalSpecs`, `grossWeightKg` — schema only; **purpose / extra.color / extra.ageGroup** — на create UI + chips; брокер видит gaps в `BrokerDossierPane` |

**Thin dossier (брокер, IN_REVIEW):** если низкий confidence / короткий HS / нет веса — чеклист + «Запросить у клиента» (чат) **или** дописать пустые attrs. Approve при thin требует `brokerComment`. Канон: [`plan-broker-qc-loop.md`](./plan-broker-qc-loop.md) B6 · [`plan-broker-empty-attrs.md`](./plan-broker-empty-attrs.md).

Код: `hasRequiredCreateAttrs` в `product-description.ts`; refine в `POST /api/v1/calculations`; dual-path в `containers/api`; UI — NewCalcPane + Dashboard quick.

**UI create (D32 contextual help):** progressive tip + labels на `/cabinet/new` — [`plan-newcalc-hints.md`](./plan-newcalc-hints.md). Heuristic **attr chips** (клик → только пустые поля) — [`plan-llm-fill-hints.md`](./plan-llm-fill-hints.md). **Field typeahead** — прецеденты + локальный словарь [`plan-precedent-suggest-service.md`](./plan-precedent-suggest-service.md) · [`plan-field-suggest.md`](./plan-field-suggest.md). Не wizard; UI не зовёт LLM matrix.

**Реакция клиента:** `POST …/feedback` с `AI_READY`, если есть HS-черновик (не только DONE). 👍 на approve пишет `verified_determinations.quality=CLIENT_HELPFUL` (не новая колонка заявки).

---

## 4. Hold (не путать с пробелами UI)

| Тема | Статус |
|------|--------|
| Полный импорт `TnvedCode` tree | HOLD — seed + search/autocomplete достаточно |
| LLM enrich CTA | HOLD — heuristic-v1 |
| Shipping UI | HOLD — `NEXT_PUBLIC_SHIPPING_UI` off; не продавать на лендинге |

---

## Ownership

| Артефакт | Путь |
|----------|------|
| Create form | `src/components/ved/client/NewCalcPane.tsx` |
| Client card | `src/components/ved/client/OrderDetail.tsx` |
| Broker map | `src/components/ved/broker/WorkMapping.tsx` |
| Admin detail | `src/components/ved/AdminVedCabinet.tsx` |
| Zod attrs | `src/lib/ved/product-description.ts` |
