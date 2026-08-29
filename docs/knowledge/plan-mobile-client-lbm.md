# План: мобильный кабинет клиента (lbm-bro skin)

**Дата:** 2026-08-29.  
**Цикл D33.** План **до кода** — без реализации в этом срезе.  
**Зона:** ветвь 1 Client ([`branches.md`](./branches.md)).  
**Канон:** D27 · D11 · D10 · D8 · D14/D32 · D33.  
**Референсы:** live `/cabinet` · lab `/client` ([`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md)) · wireframe [`docs/design/refs/wireframe-cargo-broker-mobile.html`](../design/refs/wireframe-cargo-broker-mobile.html) · [`growth.md`](./growth.md) §Mobile · [`cabinets/client/`](./cabinets/client/).

---

## 0. Вердикт as-is

| Слой | Факт |
|------|------|
| Lab дизайн | `/client` + `src/lbm-bro` (токены, `.go-*` / `.wiz-*` / `.cl-*`) — **канон визуала** |
| Live skin | `LbmCabinetsShell` / honest-skin на ветках `cursor/lbm-bro-*` + PR #19 — **ещё не в `main`** |
| As-is на `main` | Responsive web `/cabinet` (старший shell); mobile ≤980px частично |
| Native / PWA клиента | **Нет.** `manifest.json` / `sw.js` — legacy admin chat, не `/cabinet` |
| Auth | Email + password → NextAuth JWT cookie → `/cabinet`; демо `client@example.com` / `demo1234` |
| Wireframe | SMS-онбординг + tabbar — Growth-прототип, не live API |

**Prerequisite:** M2+ (home/new/orders в skin) — после merge lbm-bro live chrome **или** feature-branch поверх него. M0–M1 (блок + login + tabbar tokens) можно параллельно с lab `/client`.

**Цель плана:** первый мобильный продукт клиента = D27-контур, визуал lbm-bro, цепочка от блока auth. Не брокер, не админ, не shipping/factory.

---

## 1. Идея

Частник на телефоне: вошёл → главная → новый просчёт → оплатил → видит статус / PDF / чат.  
Один визуальный язык с web-кабинетом (lbm-bro), без второго shell и без SMS как MVP-auth.

---

## 2. Анализ

### 2.1 Что уже есть (переиспользовать)

| Блок | Источник |
|------|----------|
| Shell / tokens | `src/lbm-bro/globals.css` (lab); live bridge — на skin-ветке: `LbmCabinetsShell`, `lbm-cabinets-live.css` |
| Home | lab `/client` + (на skin) `ClientSuperappHome` — `.go-dash` / `.go-grid` / `.go-tile` |
| New calc | `NewCalcPane` / lab wizard — `.wiz-full`; pay-first на skin-стеке |
| Orders | lab `.cl-order-grid`; live detail `/cabinet/orders/[id]` (C15 на skin) |
| Auth web | `app/login` + `LandingAuthShell` + `POST /api/v1/auth/register` |
| API | `GET/POST /api/v1/calculations`, pay, pdf, chat, me, tariffs, tnved |

### 2.2 Чего нет

- Отдельного mobile app shell (tabbar / safe-area)
- Token-auth для native (сейчас только cookie NextAuth)
- PWA install для `/cabinet`
- Offline / push

### 2.3 Риски

| Риск | Митигация |
|------|-----------|
| Второй UI-язык | Только токены/классы lbm-bro; D32 reuse |
| Ломка D11 (HS до оплаты) | Mobile new-calc = тот же pay-first контракт |
| SMS из wireframe как «обязаловка» | Auth MVP = email/password; SMS = later Growth |
| Shipping/factory в tabbar | Не в M1–M3; флаги остаются off |
| Scope creep native | Сначала **M-Web** (responsive + optional PWA), потом wrapper |

---

## 3. Формирование блока (модуль)

Перед экранами фиксируем **один продуктовый блок** — контракт mobile client:

```text
┌─────────────────────────────────────────────┐
│  mobile-client (блок M)                     │
│  ownership: Client branch                   │
│  surface:   /m/*  или  PWA на /cabinet      │
│  design:    lbm-bro tokens + tab chrome     │
│  auth:      email/password → session        │
│  domain:    только /api/v1 (dual-path ok)   │
│  out:       broker/admin/shipping/factory   │
└─────────────────────────────────────────────┘
```

### 3.1 Решение поверхности (зафиксировать в M0)

| Вариант | Плюс | Минус | Рекомендация |
|---------|------|-------|--------------|
| **A. Mobile web shell** на `/cabinet` (усилить ≤980px + tabbar) | Один деплой, те же cookies | Не «магазин приложений» | **M0–M3 Must** |
| **B. PWA** (manifest + SW только для client) | Add to Home Screen | Отдельный SW от admin legacy | **M4 Could** |
| **C. Capacitor / RN wrapper** | Store | Token bridge, второй билд | **Hold** до зелёного M-Web |

**Канон среза:** начинаем с **A**; B/C не блокируют auth→D27 chain.

### 3.2 IA мобильного клиента (5 destinations)

Совпадает с live `getClientNav`, tab-метафора как в wireframe:

| Tab | Route (web) | Job |
|-----|-------------|-----|
| Главная | `/cabinet` | greet + плитки + лента |
| Заявки | `/cabinet/orders` | список + фильтры |
| Новый | `/cabinet/new` | CTA center / FAB (не «ещё один tab-контент») |
| Чат | `/cabinet/support` | support + deep-link в order chat |
| Компания | `/cabinet/profile` | реквизиты + выход |

Справочник ТН ВЭД — плитка с главной / вход из NewCalc (как live), не обязательный 6-й tab в M1.

### 3.3 Инварианты блока (не ломать)

1. Очередь брокера только после оплаты (**D11**).  
2. Лимиты EXPRESS 1 / STANDARD 3 / PRO 10 (**D10**).  
3. Статусы только D8 (не lab `draft/pay/ai` в API).  
4. VAT 22% / ПП 1637; нет «1 бесплатно» на live (**C29**).  
5. Shipping / factory UI default off (**D27**).  
6. Нет второго toast/drawer/shell (**D32**).

---

## 4. Цепочка сборки (порядок)

```text
M0  блок + контракт + design tokens checklist
M1  логин / пароль (+ session / me)
M2  главная (superapp lbm-bro)
M3  новый просчёт → оплата (D27 core)
M4  заявки + карточка + PDF
M5  чат / support badge
M6  PWA / store wrapper (hold until M5 green)
```

Каждый Mn = отдельный мини-цикл D33: план-секция → код → `test:ci` / smoke → KB.

---

## 5. Фазы

### M0 — Формирование блока (этот документ + checklist)

| Шаг | Что | Done when |
|-----|-----|-----------|
| M0a | Зафиксировать surface = mobile web shell на client routes | **done** (§3.1) |
| M0b | Inventory screens ↔ panes (`cabinets/client`) | **done** (§3.2) |
| M0c | Token map: `--blue`, `--bg`, `--radius`, Manrope/Nunito, `.go-*` / `.wiz-*` / `.cl-*` | **done** |
| M0d | Tabbar wireframe → CSS classes (не копировать SMS-auth) | **done** — `.cl-tabbar` / FAB Новый |
| M0e | Out-of-scope list подписан | **done** (§7) |

**Код в M0:** не обязателен; максимум CSS sketch / empty `/m` redirect — только если не ломает `/cabinet`.

### M1 — Логин / пароль (первый runnable slice)

| Шаг | Что | API / UI |
|-----|-----|----------|
| M1a | Mobile-first login screen в токенах lbm-bro | **done** — `LbmAuthShell` |
| M1b | Email + password → NextAuth credentials | **done** (existing `signIn`) |
| M1c | После login: role CLIENT → home | **done** → `/cabinet` |
| M1d | Logout + session expire UX | **done** — `signOut` в shell → `/login` |
| M1e | Demo hint (non-prod) | **done** — client@ / demo1234 |
| M1f | Register link | **done** — `/register` на том же shell |

**Не в M1:** SMS, OAuth social, biometric, refresh-token native bridge.

**Проверка M1:** ручной login на phone width ≤390px; wrong password → понятная ошибка; CLIENT → home.

### M2 — Главная (lbm-bro superapp)

| Шаг | Что | Паттерн |
|-----|-----|---------|
| M2a | Tabbar sticky bottom (Главная · Заявки · +Новый · Чат · Компания) | **done** |
| M2b | `.go-dash` greet + hero tile «Новый просчёт» | **done** — mobile hero/greet polish |
| M2c | Лента активных заявок / filter chips | **done** — chips scroll + touch cards |
| M2d | Скрыть shipping/factory/commercial invoice | **done** — stubs `lbm-m-hide`; factory already C6 |

### M3 — Новый просчёт → оплата

| Шаг | Что | Инвариант |
|-----|-----|-----------|
| M3a | Wizard mobile: один столбец `.wiz-full` | **done** — side hidden на шагах 1–2 |
| M3b | `POST /api/v1/calculations` | **done** (existing domain) |
| M3c | Выбор тарифа + `POST …/pay` | **done** (existing; full-width CTA) |
| M3d | Не показывать финальный HS как «решение таможни» | **done** (C22 copy) |
| M3e | EXPRESS path first (1 позиция); multipack later | **done** — hide Мультипозиция ≤980px |

### M4 — Заявки + деталь + PDF

| Шаг | Что |
|-----|-----|
| M4a | Список `.cl-order-grid` full-width cards |
| M4b | `/cabinet/orders/[id]` — timeline D8, смета, next-step |
| M4c | PDF при `DONE` |
| M4d | Empty / loading / error состояния (D32) |

### M5 — Чат

| Шаг | Что |
|-----|-----|
| M5a | Support list + unread badge |
| M5b | Order chat after QUEUED/IN_REVIEW (как live) |
| M5c | Poll / soft refresh; без voice |

### M6 — PWA / native (hold)

| Шаг | Триггер |
|-----|---------|
| M6a | Client-only manifest + SW (не admin legacy) | M5 green + ops |
| M6b | Capacitor/RN + token session bridge | product ADR |
| M6c | Push (notify) | Track A notify keys |

---

## 6. Контракт (кратко)

| Действие | Method | Path | Role |
|----------|--------|------|------|
| Login | NextAuth credentials | `/api/auth/*` | public |
| Me | GET | `/api/v1/me` | session |
| List/create | GET/POST | `/api/v1/calculations` | CLIENT |
| Pay | POST | `/api/v1/calculations/:id/pay` | CLIENT |
| PDF | GET | `/api/v1/calculations/:id/pdf` | CLIENT |
| Chat | GET/POST | `/api/v1/chat` | CLIENT |
| Tariffs | GET | `/api/v1/tariffs` | CLIENT |

Session: cookie JWT (M1–M5). Native bearer — только M6b + ADR.

---

## 7. Вне скоупа (сейчас)

- Кабинет брокера / админа / производителя  
- Shipping UI, factory CTA, commercial invoice fields  
- SMS-auth, voice, ЧЗ/ТО как продукт  
- LLM-as-CTA, scrape Alta/TKS  
- Замена domain API  
- Store release до зелёного M-Web  

---

## 8. Дизайн-чеклист (lbm-bro)

- [ ] Токены: `--blue #2b72f4`, `--bg #f5f7fa`, `--radius ~28px`, Manrope + Nunito  
- [ ] Client light shell (не dark ops `.side`)  
- [ ] Home = `.go-grid` / `.go-tile.hero`, не dashboard KPI-wall  
- [ ] Orders = `.cl-order` cards, fullscreen detail (не второй drawer-язык)  
- [ ] New = `.wiz-*` + `.btn-primary` pill  
- [ ] Tabbar = одна композиция first viewport; бренд/продукт читается  
- [ ] Нет purple-glow / cream-serif / broadsheet biases  
- [ ] D32: reuse `VedToast` / `VedEmptyState` / status pills  

---

## 9. Проверка

```bash
npm run test:ci
# после M1+:
# phone / DevTools 390×844 — login → home → new → pay → orders/[id]
npm run smoke:mvp   # при running app + seed
```

Ручной сценарий роли CLIENT: demo login → создать EXPRESS → оплатить (mock) → увидеть статус → PDF при DONE.

---

## 10. KB / индекс при закрытии срезов

| Файл | Когда |
|------|-------|
| этот план — статусы Mn | каждый merge фазы |
| [`cabinets/client/README.md`](./cabinets/client/README.md) | tabbar / `/m` routes |
| [`growth.md`](./growth.md) §Mobile | pointer на план |
| [`current-app.md`](./current-app.md) | as-is mobile surface |
| ADR (если native/PWA cutover) | M6 |

---

## 11. Следующий шаг агента / человека

**Сейчас:** M0–M3 chrome **done** на `cursor/mobile-client-m1-e1f0`.  
**Дальше:** M4 orders list/detail polish → M5 chat.  
**Не начинать** M6 native без зелёного M4–M5.  
**Стек:** поверх `cursor/tnved-invoice-enrich-e1f0` (lbm-bro live skin).

Параллельно: ТН ВЭД / C31 — [`plan-next-vector-c28.md`](./plan-next-vector-c28.md).
