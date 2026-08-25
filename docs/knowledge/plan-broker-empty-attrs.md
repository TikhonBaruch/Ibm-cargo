# План: брокер заполняет только пустые attrs

Индекс: [`cabinets/broker/README.md`](./cabinets/broker/README.md) · [`calculation-fields.md`](./calculation-fields.md) · D15 / D24 · thin dossier [`plan-broker-qc-loop.md`](./plan-broker-qc-loop.md).  
Цикл **D33**. Ветвь 2 + ядро (PATCH/approve). Не трогать кабинет производителя.

## 1. Идея

После thin dossier брокер часто **уже знает** вес / состав / бренд (из чата или документов), но attrs на позиции read-only → снова просит клиента или approve с оговоркой. Нужно: **дописать только пустые** поля `CalculationItem.attrs`, не перезаписывая то, что уже дал клиент или снимок завода.

## 2. Анализ (as-is)

| Слой | Сейчас |
|------|--------|
| UI WorkMapping | attrs — текст + `FactorySkuSnapshot`; редактируются HS / платежи / item.description / extraFee |
| Domain PATCH | `ApproveItemInput` без `attrs` |
| D15 / calculation-fields | «брокер не редактирует product attrs» — было жёстко; срез: только empty |
| Thin dossier | gaps weight/composition/identity → чат; attrs не пишет |
| Завод | `manufacturerSkuId` + снимок в attrs; брокер **не** пишет каталог |

**Риск:** если принять attrs «как прислал UI» целиком — клиентский бренд можно затереть. Merge **только на сервере**: existing wins на заполненных ключах.

## 3. Структурирование

Паттерн UI (D32): **inline form** на строке позиции (как товарное описание), не drawer. Заполненные ключи — read-only chips; пустые — input.

### E1 — domain merge

```text
fillEmptyProductAttrs(existing, patch):
  для каждого ключа schema (кроме extra):
    если existing[key] «пусто» и patch[key] валиден → взять patch
    иначе оставить existing
  extra: добавить только ключи, которых нет в existing.extra
```

«Пусто» = отсутствует / null / `""` / (для чисел — только отсутствие, `0` считается заданным).

Вызов в `saveCalculationItems` / `approveCalculation` при `items[].attrs`; dual-path `containers/api`. Event `ITEM_MAPPED` payload: какие ключи дописаны.

### E2 — UI

Редактируемые поля (v1, стык с dossier): `brand`, `material`, `composition`, `originCountry`, `netWeightKg`, `grossWeightKg`, `model`, `hsHint`.  
Не в UI v1: `purpose`, `technicalSpecs`, произвольный `extra` (hold — меньше ERP).  
Клиент OrderDetail уже показывает attrs — после save увидит дописанное.

### E3 — hold

- Unclaim, PDF preview, N-line fees (F3)
- Перезапись заполненных attrs / name / calc.description / ManufacturerSku
- Обязательный attrs на approve (soft: dossier + comment как сейчас)

## 4. Реализация

**Статус:** E1–E2 **live**. E3 hold.

| Фаза | Статус |
|------|--------|
| E1 `fillEmptyProductAttrs` + PATCH/approve dual-path | **done** |
| E2 `BrokerAttrsFill` на WorkMapping | **done** |
| E3 unclaim / PDF preview / overwrite | hold |

## 5. Проверка

- Unit: existing brand сохранён при patch с другим brand; пустой netWeightKg заполняется.
- `test:ci`
- Ручной: thin calc без веса → брокер вводит кг → save → attrs на клиенте; бренд клиента не меняется.

## 6. Деплой

Merge → Vercel Hobby; migrate не требуется.
