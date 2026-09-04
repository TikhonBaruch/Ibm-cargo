# План: client HS blur (10-знак после 3 цифр)

**Статус:** **done** 2026-09-04  
**Канон:** [`plan-lbm-bro-tnved-dir.md`](./plan-lbm-bro-tnved-dir.md) · [`plan-tnved-directory-leaf-only.md`](./plan-tnved-directory-leaf-only.md)

## 1. Идея

В кабинете клиента 10-значный код в подсказках/карточке справочника: **первые 3 цифры** читаемы, хвост **размыт** (и в DOM — `•`, не сырые цифры). Брокер/админ без маски. Полный код по-прежнему уходит в заявку при выборе (D11/D15), UI не светит хвост в списке.

## 2. Структура

| # | Действие |
|---|----------|
| 1 | `maskHsCodeForClient` + `<ClientMaskedHsCode>` |
| 2 | `/cabinet/tnved` hits + `.tnved-code` + **связанные коды** |
| 3 | `HsCodeAutocomplete` dropdown при `leafOnly` |
| 4 | CSS `.hs-client-mask-tail { filter: blur }` |

## 3. Критерий

`ноутбук` → в списке `847` + blur, не `8471 30 000 0` целиком.
