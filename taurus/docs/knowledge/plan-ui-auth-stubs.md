# План: UI auth stubs (дыры кабинетов без middleware)

Индекс: [`access.ts`](../../src/lib/ved/access.ts) · [`plan-vercel-services.md`](./plan-vercel-services.md) · [`feature-cycle.md`](./feature-cycle.md).  
Ветвь 3 (ядро) + UI cabinets. D28 / D32.

## 1. Идея

HTML-кабинеты (`/cabinet`, `/broker`, `/manufacturer`, `/admin`, obscure SUPER) закрыты **layout stubs** (`requirePathAccess`) + корневым Node `proxy.ts` (UI redirects). Edge `middleware.ts` снят.

Цель этапа **stubs**: при отключении / переносе middleware → `proxy.ts` (или временном matcher без UI) кабинеты всё равно не отдают HTML чужой роли — через тонкие server layouts + общий helper. Без редизайна, без второго shell.

## 2. Анализ

| Поверхность | Layout сейчас | Session gate |
|-------------|---------------|--------------|
| `/cabinet/*` | **нет** `layout.tsx` | только middleware |
| `/broker/*` | **нет** | только middleware |
| `/manufacturer/*` | **нет** | только middleware |
| `/admin/*` | client `useSession` | soft: unauthenticated → `children` as-is; role redirect частичный |
| `/2178737/*` | client shell | soft client; login path отдельно |
| `/login`, register, public | n/a | `isPublicAuthedPath` |

API: большинство `app/api/v1/**` уже `requireRole` — **не** предмет этого плана (дыра именно **UI HTML**).

`resolvePathAccess` / `homePathForRole` в `access.ts` — единый канон RBAC; stubs не дублируют таблицы ролей.

## 3. Структурирование

### E0 — helper (канон)

`src/lib/ved/require-path-access.ts`: `resolveUiPathGate` (pure) + `requirePathAccess` (session → redirect). Unit: `require-path-access.test.ts`.

### E1 — stubs layouts (RSC, redirect-only)

| Файл | Поведение stub |
|------|----------------|
| `app/cabinet/layout.tsx` | `requirePathAccess("/cabinet")` → `{children}` |
| `app/broker/layout.tsx` | то же для `/broker` |
| `app/manufacturer/layout.tsx` | то же для `/manufacturer` |
| `app/admin/layout.tsx` | **не ломать** client chrome: либо server parent + client child split, либо тонкий server wrapper `layout.tsx` + перенос client в `AdminChrome.tsx`; stub = session deny → `redirect("/login")` + `resolvePathAccess` |
| `app/2178737/layout.tsx` | аналогично: login path skip; иначе SUPER-only via `resolvePathAccess` |

Правила stubs:

- Только `redirect` / `children` — **нет** нового UI, тостов, skeleton (loading оставить как есть в client shells).
- Не копировать role-sets — только `access.ts`.
- Matcher middleware **пока оставить** (defense in depth); stubs = страховка, не cutover.

### E2 — smoke / e2e заглушки

- Расширить `tests/e2e/redirects.e2e.test.ts` (или unit без live): аноним → `/cabinet` → login; CLIENT → `/broker` → `/cabinet`.
- Hold live: `smoke:mvp` на preview после merge.

### Hold (не в этом срезе)

- Удаление UI-matcher из middleware / полный отказ от proxy для HTML.
- Миграция `middleware.ts` → `proxy.ts` (отдельный go; см. Services).
- Per-page auth вместо layout.
- Client-only gate как единственная защита (запрещено).

## 4. Реализация

| Фаза | Статус |
|------|--------|
| План | **done** |
| E0 helper | **done** (`require-path-access.ts`) |
| E1 layouts stubs | **done** (cabinet/broker/manufacturer + admin `(ved)` + SUPER `(cms)`) |
| E2 тесты | **done** (unit + e2e paths) |
| Hold cutover middleware | hold |

## 5. Проверка

1. `npm run test:unit` — access + helper.  
2. Ручной: logout → `/cabinet` → `/login`; broker cookie → `/cabinet` → `/broker`.  
3. `npm run test:ci`.  
4. Middleware всё ещё в matcher — регресс UI не ожидается.

## 6. Деплой

Только Next/session; migrate нет. Можно мержить до Services. После зелёных stubs — опционально ослабить middleware matcher на UI (отдельный план/ADR).

## Done when

- Четыре зоны UI имеют server-side gate через `resolvePathAccess`.
- Аноним и wrong-role не получают HTML кабинета при **выключенном** middleware matcher на этих путях (проверяется локально флагом/временным комментарием в preview, не в prod).
- KB + index обновлены; код без второго RBAC-словаря.
