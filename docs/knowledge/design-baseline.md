# Дизайн — baseline и токены

Визуальный канон живого UI. Индекс: [`design.md`](./design.md). ADR: **D14** в [`decisions.md`](./decisions.md).

## Baseline продукта

Зафиксировано **2026-08-04** (git tag **`ved-ui-cabinets-baseline`**):

- Живой UI = React `LbmCabinetsShell` + panes в `src/components/ved/{client,broker,admin}` + orchestrators (`VedShell` — manufacturer + shared widgets)
- Визуал ≈ [`cargo-broker-cabinets.html`](../design/refs/cargo-broker-cabinets.html); данные с `/api/v1` (не цифры из мока)
- Прод: https://ibm-cargo.vercel.app — `/cabinet`, `/broker`, `/admin`
- **Не** возвращать `CabinetsApp`; **не** добавлять proto-bar ролей в прод (proto-bar только в HTML-рефе)

## Код vs реф

| Слой | Путь |
|------|------|
| Shell | `src/components/ved/LbmCabinetsShell.tsx` (live C/B/A) · `VedShell.tsx` (manufacturer + widgets) |
| Client panes | `src/components/ved/client/*` · routes `app/cabinet/*` |
| Broker panes | `src/components/ved/broker/*` · routes `app/broker/*` |
| Admin VED | `src/components/ved/AdminVedCabinet.tsx` + `admin/*` panes · routes `app/admin/*` |
| Лендинг | `src/components/landing/*` · реф `cargo-broker-design.html` |
| Extract UI | `containers/{client,broker,admin}` — Docker COPY из `src/components/ved` |

## Токены

| Token | Value |
|-------|-------|
| `--blue` | `#2b72f4` (`--blue-2` `#1a5fd4`) |
| `--bg` | `#f5f7fa` |
| `--ink` | `#0f172a` |
| `--muted` | `#7a7f89` |
| `--ok` / `--danger` / `--warn` | `#16a34a` / `#dc2626` / `#c2410c` |
| Fonts | **Manrope** (UI) + **Nunito** (display) |
| Radius | ~28px cards, pill buttons |
| Theme | Light soft-UI, subtle blue radial glow |
| Shell | Full-bleed: sidebar flush left (260px), content ~22px inset |

## Навигация кабинетов (IA)

Live-код — источник правды. Удобство / группы / empty states: [`cabinets/ux-saas.md`](./cabinets/ux-saas.md).

**Клиент:** Главная · Заявки · Справочник ТН ВЭД · Чат · Компания. Header CTA «Новый просчёт» (`/new`) — не пункт сайдбара. `/settings` → `/profile`. Брокеры / баланс / перевозка† / производитель† — плитки главной.

**Брокер:** Дашборд · Очередь · В работе · Чат (unread badge) · SLA · Выплаты · Профиль.

**Админ:** сайдбар с секциями Операции / Каталог / Платформа (канон [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) §5); мобильные chips остаются плоскими. Badge unread — на пункте «Поддержка».

† **Перевозка** скрыта по умолчанию (`NEXT_PUBLIC_SHIPPING_UI`); код/API сохранены. Go-live — [`roadmap.md`](./roadmap.md) §2.2.

Live chrome клиента — суперприложение (`LbmCabinetsShell` product-shell), не клон admin-шелла. Lab `/client` — референс · [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md). Proto-bar только в lab, не в prod (D14).

As-is ops брокера: soft refresh · attrs на work · escalate own IN_REVIEW — [`cabinets/broker/`](./cabinets/broker/).

Соответствие live routes и реф-панелей: [`design-parity.md`](./design-parity.md).
