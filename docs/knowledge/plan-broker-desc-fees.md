# План: брокер уточняет описание и доп. сборы

Индекс: [`cabinets/broker/README.md`](./cabinets/broker/README.md) · матрица полей [`calculation-fields.md`](./calculation-fields.md) · D15 [`decisions.md`](./decisions.md) · платежи [`customs-payments.md`](./customs-payments.md).  
Цикл **D33**. Ветвь 2 (брокер) + ядро (PATCH/approve/PDF). Код **не** начинать, пока не согласованы фазы ниже.

## 1. Идея

На QC брокеру нужно:

1. **Уточнить описание заявки/товара** — чтобы код ТН ВЭД и PDF опирались на таможенное наименование, а не на короткий текст клиента.
2. **Добавить дополнительные сборы** — не только переписать одно число «таможенный сбор», а явно показать клиенту *ещё* платежи (прочие / особые случаи).

Это не правка тарифа платформы (`TariffPlan.priceRub`) и не «доставка под ключ» (D27).

## 2. Анализ (as-is кабинета)

Job брокера на `/broker/work` (`WorkMapping`): claim → таблица HS / пошлина / НДС / цена ед. → одно поле **«Таможенный сбор, ₽»** (`feeRub`) → **«Комментарий»** (`brokerComment`) → черновик / утвердить PDF. Чат и thin-dossier — запрос фактов у клиента, **не** правка карточки.

| Что видит / делает | Сейчас | Ограничение |
|--------------------|--------|-------------|
| `Calculation.description` | read-only блок в шапке | D15 / [`calculation-fields.md`](./calculation-fields.md): брокер **не** пишет description / name / attrs |
| `CalculationItem.name` / `.description` | в таблице только `name`; item.description **нет в UI** | колонка в БД есть, PATCH items её не принимает (`d-map.broker.json`) |
| Attrs / эталон завода | read-only | D15; dossier просит клиента, не заполняет брокер |
| `brokerComment` | textarea → PDF + карточка клиента после approve | один текст «оговорка», не товарное описание |
| Reclassify note | уходит в LLM, **не** становится описанием заявки | эфемерно |
| Пошлина / НДС | **W** на строке | D15 ок |
| Сбор | **одно** число `feeRub` на заявке (шкала ПП 1637, override вручную) | нет строк «за что»; нет суммы «сбор + прочие» |
| Итого | `duty + vat + feeRub` | акциз / утиль / НТМ — **hold** ([`customs-payments.md`](./customs-payments.md)) |
| Тариф клиента | виден, не редактируется | D15 |

**PDF** (`buildPdfHtml`): title клиента, HS, пошлина, НДС, **одна** строка «Сбор», позиции (name + HS + duty/VAT), `brokerComment`. Нет коммерческого описания и нет расшифровки сборов.

**Клиент** (`OrderDetail`): то же описание (своё) + три числа платежей + комментарий брокера после approve.

Два разных «описания» нельзя смешивать:

```text
слова клиента (заявка)     → audit, чат, AI draft
товарное описание брокера  → ДТ / PDF / reclassify / precedent
```

Перезаписывать `Calculation.description` нельзя: ломается история «что просил клиент» и D15.

«Доп. сборы» ≠ bump `feeRub` втихую: клиент не видит, *что* добавили. И ≠ `TariffPlan.priceRub`.

## 3. Структурирование

Паттерн UI (D32): **inline form на WorkMapping** (как сейчас HS/сбор/комментарий), не вторая модалка. Расшифровка платежей — как строки инвойса (Stripe invoice line), не ERP.

### F1 — товарное описание (минимум)

Брокер пишет **уточнённое наименование для PDF**, исходный текст клиента остаётся.

| Решение | Почему |
|---------|--------|
| Не PATCH `Calculation.description` | audit + D15 |
| Писать `CalculationItem.description` (поле уже есть) на `/work` | одна позиция EXPRESS = одно поле; STANDARD/PRO — по строке |
| PDF: если item.description есть — показать его под/вместо короткого name | клиент видит уточнение в отчёте |
| `CalculationEvent` NOTE при смене описания | append-only история |
| `brokerComment` оставить для оговорки (thin dossier / «на чём основан код») | не смешивать с номенклатурой |

Клиенту на карточке: блок «Как описал брокер» (V после save/approve), оригинал не прятать.

### F2 — дополнительные сборы (минимум)

Оставить `feeRub` = **таможенный сбор за выпуск** (ПП 1637, брокер может скорректировать шкалу).

Добавить **одну** явную строку «Прочие сборы» (не акциз/утиль как отдельные типы — hold):

| Поле | Смысл |
|------|--------|
| `extraFeeRub` ≥ 0 | сумма прочих (инспекция, особый выпуск, округление и т.п.) |
| `extraFeeNote` | обязателен, если сумма > 0 (label для клиента и PDF) |

Итого: `duty + vat + feeRub + extraFeeRub`. Dual-path PATCH/approve + PDF таблица из 4 строк платежей. Не трогать `TariffPlan.priceRub`.

### F3 — hold / позже

- Список N строк с `kind` (акциз, утиль, антидемпинг) — после снятия hold в [`customs-payments.md`](./customs-payments.md).
- Правка attrs / веса / состава брокером — отдельный срез «empty attrs only» ([`plan-broker-qc-loop.md`](./plan-broker-qc-loop.md) backlog).
- Preview PDF до approve.
- Перезапись клиентского `Calculation.description`.

## 4. Реализация

**Статус (2026-08-14):** F1 + F2 **live** в коде. F3 hold.

| Фаза | Статус |
|------|--------|
| F1 товарное описание `CalculationItem.description` | **done** |
| F2 `extraFeeRub` + `extraFeeNote` | **done** (миграция `20260814150000_broker_extra_fee`) |
| F3 N строк акциз/утиль | hold |

Порядок был: F1 → F2. Контракт `d-map.broker.json` + `src/lib/ved/calculations.ts` + `containers/api` + `WorkMapping` + `OrderDetail` + `buildPdfHtml`.

## 5. Проверка

- Unit: extraFee входит в `totalPaymentsRub`; description item не затирает calc.description.
- `test:ci`; dual-path PATCH.
- Ручной: `broker@` → work → уточнить описание → прочие сборы с подписью → PDF; клиент видит оригинал + уточнение + 4 строки платежей.

## 6. Деплой

Merge `main` → Vercel Hobby; migrate F2 на sweb **отдельно** от build. Не slim, не второй Postgres.
