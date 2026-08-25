# Дизайн — индекс

Канон UI и интерактивных рефов. HTML-артефакты: [`docs/design/refs/`](../design/refs/).  
Дубликаты (не источники правды): `new_desing/cabinet (2)/`, `new_desing/cabinet (3)/`.

## Разделы KB

| Документ | Содержание |
|----------|------------|
| [`design-baseline.md`](./design-baseline.md) | ADR D14, live UI, токены, shell, навигация кабинетов |
| [`design-patterns.md`](./design-patterns.md) | **D32:** сначала общепризнанные паттерны (NN / WCAG / SaaS) |
| [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) | **Lab lbm-bro:** суперприложение клиента `/client` + ops-шелл брокера/админа vs domain `/cabinet` `/broker` `/admin` |
| [`design-interactive.md`](./design-interactive.md) | Статус интерактивного дизайна (веб + мобилка), как открыть рефы |
| [`design-parity.md`](./design-parity.md) | Таблица экранов реф ↔ live, UI backlog |
| [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) | Удобство, SaaS-аналоги, empty states, nav groups |
| [`cabinets/ui-guide.md`](./cabinets/ui-guide.md) | **Сводка UI:** клиент vs брокер vs админ, канон админа, next steps |
| [`../design/README.md`](../design/README.md) | Каталог HTML-рефов и assets |

## Быстрый старт

| Задача | Куда |
|--------|------|
| Править визуал кабинета | `design-baseline.md` + **D32** [`design-patterns.md`](./design-patterns.md) → `src/components/ved/*` |
| Удобство / следующий кабинет | [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) · **сравнение ролей:** [`cabinets/ui-guide.md`](./cabinets/ui-guide.md) |
| Сверить экран с моком | `design-parity.md` → `cargo-broker-cabinets.html` |
| Mobile UX / прототип | `design-interactive.md` → `wireframe-cargo-broker-mobile.html` |
| Новый визуал клиента (суперприложение) | [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) → `src/lbm-bro` · `/client` |
| Прод baseline | tag **`ved-ui-cabinets-baseline`** · ADR **D14** в [`decisions.md`](./decisions.md) |

## Рефы (интерактивные HTML)

| Файл | Назначение |
|------|------------|
| [`cargo-broker-design.html`](../design/refs/cargo-broker-design.html) | Лендинг (+ live: `src/components/landing/` → auth CTAs `/login`\|`/register`) |
| [`cargo-broker-cabinets.html`](../design/refs/cargo-broker-cabinets.html) | Веб-кабинеты admin / client / broker |
| [`wireframe-cargo-broker-mobile.html`](../design/refs/wireframe-cargo-broker-mobile.html) | Мобильный клиент — прототип (**не** prod) |
| `assets/*.jpg` | Картинки → также `public/cabinets/assets/` |
