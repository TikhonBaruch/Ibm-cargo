# Интерактивный дизайн (веб + мобилка)

Статус направления «Разработка интерактивного дизайна».  
Индекс: [`design.md`](./design.md). Baseline: [`design-baseline.md`](./design-baseline.md). Parity: [`design-parity.md`](./design-parity.md).

## Статус

Направление закрывается **прототипами + live baseline D14**, не mobile-приложением в проде.

- [x] **Веб-сайт — интерактивный дизайн** — HTML-рефы лендинга и кабинетов + живой UI (`VedShell` / panes / `AdminVedCabinet`)
- [x] **Мобильное приложение — интерактивный дизайн** — HTML wireframe клиента (экраны, tabbar, drawer, шаги newcalc/booking)

**Out of scope** (фаза Growth): React Native, PWA cutover, SMS-auth, отдельные mobile routes в Next. См. [`growth.md`](./growth.md).

## Как открыть рефы локально

```bash
# из корня репо
xdg-open docs/design/refs/cargo-broker-design.html
xdg-open docs/design/refs/cargo-broker-cabinets.html
xdg-open docs/design/refs/wireframe-cargo-broker-mobile.html
```

Рефы — self-contained HTML + `assets/`; не требуют `npm run dev`.

## Веб — интерактивные рефы

| Реф | Интерактивность | Live |
|-----|-----------------|------|
| `cargo-broker-design.html` | секции лендинга, формы, CTA | `src/components/landing/LandingPage.tsx` · live CTA → `/login` \| `/register` (D25; копия маркетинг — без rewrite) |
| `cargo-broker-cabinets.html` | proto-bar admin/client/broker; переключение panes; toast, quick calc, claim | `/cabinet`, `/broker`, `/admin` |

Proto-bar переключения ролей — **только** в HTML-рефе кабинетов, не в проде (D14).

## Мобилка — интерактивный прототип

Артефакт: [`wireframe-cargo-broker-mobile.html`](../design/refs/wireframe-cargo-broker-mobile.html) — **не** prod UI.

### Поток экранов

```text
onboarding (3 слайда) → auth (телефон/SMS демо) → home
  ├─ newcalc (шаг 1 товар → шаг 2 тариф) → orders
  ├─ booking (шаг расчёт → шаг оплата)
  ├─ orders · chat · profile
  └─ drawer: быстрые переходы + выход
```

### Навигация

- **Tabbar:** Главная · Заявки · Чат · Профиль (sync active state при `go()`)
- **Proto-bar сверху:** быстрый jump между экранами (для демо/ревью)
- **Drawer:** меню с теми же destination + баланс в footer

### Micro-interactions в прототипе

- Онбординг: dots + «Далее» / «Начать»
- Auth: двухшаговый SMS (демо-код `1234`)
- Newcalc: `setNcStep(1|2)`, выбор тарифа, валидация, добавление заявки в список
- Booking: `setBkStep(1|2)` расчёт → оплата
- Orders: фильтры по статусу; chat: вкладки jobs/support, отправка сообщений

Продуктовая реализация mobile — отдельная задача Growth; канон UX до cutover = этот wireframe.
