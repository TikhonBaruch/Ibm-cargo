# Дизайн — индекс

Канон UI и интерактивных рефов. HTML-артефакты: [`docs/design/refs/`](../design/refs/).  
Дубликаты (не источники правды): `new_desing/cabinet (2)/`, `new_desing/cabinet (3)/`.

## Разделы KB

| Документ | Содержание |
|----------|------------|
| [`design-baseline.md`](./design-baseline.md) | ADR D14, live UI, токены, shell, навигация кабинетов |
| [`design-patterns.md`](./design-patterns.md) | **D32:** сначала общепризнанные паттерны (NN / WCAG / SaaS) |
| [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) | **Live chrome:** клиент product-shell `/cabinet`; брокер/админ ops `/broker` `/admin`; lab `/client` референс |
| [`design-interactive.md`](./design-interactive.md) | Статус интерактивного дизайна (веб + мобилка), как открыть рефы |
| [`design-parity.md`](./design-parity.md) | Таблица экранов реф ↔ live, UI backlog |
| [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) | Удобство, SaaS-аналоги, empty states, nav groups |
| [`cabinets/ui-guide.md`](./cabinets/ui-guide.md) | **Сводка UI:** клиент vs брокер vs админ, канон админа, next steps |
| [`../design/README.md`](../design/README.md) | Каталог HTML-рефов и assets |

## Внешний макет → live (без второго кабинета)

Канон, который уже сработал на lbm-bro: [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) · честность слотов [`plan-lbm-bro-honest-skin.md`](./plan-lbm-bro-honest-skin.md) · сверка chrome [`plan-lbm-bro-max-match.md`](./plan-lbm-bro-max-match.md).

Макет **не** копируют в `src/` как новое приложение. Последствия того пути: второй wizard/toast/shell, фейковые цифры (инвойс, НДС), SW держит старый chrome, lab и `/cabinet` расходятся.

| Шаг | Что |
|-----|-----|
| 0 | Артефакт в scratch или [`docs/design/refs/`](../design/refs/), не в `ved/client` |
| 1 | Таблица: кадр макета → live pane → паттерн D32 → **honesty gap** (чего domain не делает) |
| 2 | PR токенов/chrome only (`globals.css`, shell). Domain-формы не трогать |
| 3 | Один экран на PR: те же компоненты, другой CSS/copy. Не заменять `NewCalcPane` целиком на lab-wizard |
| 4 | Gap: скрыть (C8) или честный stub (C9). Не обещать оплату 0 ₽, НДС 20%, полный HS до оплаты |

Live лицо = `/cabinet`. Lab `/client` = музей макета. Данные и CTA — LBM, не demo-store.

## Быстрый старт

| Задача | Куда |
|--------|------|
| Править визуал кабинета | `design-baseline.md` + **D32** [`design-patterns.md`](./design-patterns.md) → `src/components/ved/*` |
| Удобство / следующий кабинет | [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) · **сравнение ролей:** [`cabinets/ui-guide.md`](./cabinets/ui-guide.md) |
| Сверить экран с моком | `design-parity.md` → `cargo-broker-cabinets.html` |
| Mobile UX / прототип | `design-interactive.md` → `wireframe-cargo-broker-mobile.html` |
| Новый визуал кабинетов | [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) → `LbmCabinetsShell` на live routes |
| Прод baseline | tag **`ved-ui-cabinets-baseline`** · ADR **D14** в [`decisions.md`](./decisions.md) |

## Рефы (интерактивные HTML)

| Файл | Назначение |
|------|------------|
| [`cargo-broker-design.html`](../design/refs/cargo-broker-design.html) | Лендинг (+ live: `src/components/landing/` → auth CTAs `/login`\|`/register`) |
| [`cargo-broker-cabinets.html`](../design/refs/cargo-broker-cabinets.html) | Веб-кабинеты admin / client / broker |
| [`wireframe-cargo-broker-mobile.html`](../design/refs/wireframe-cargo-broker-mobile.html) | Мобильный клиент — прототип (**не** prod) |
| `assets/*.jpg` | Картинки → также `public/cabinets/assets/` |
