# Web slim / Vercel boundary (C5)

**Статус:** scaffold + gateway auth smoke (**PASS** 2026-08-07 local) — полный cutover кабинетов с Vercel **не** включён (ломает текущий деплой).

**Hold (D22 / D27):** не ставить `WEB_SURFACE=slim` на Vercel prod; не удалять `/cabinet|/broker|/admin` с root Next без отдельного cutover ADR.

## Цель

`containers/web` / корневой Next на Vercel = **landing + auth + тонкий session-proxy**.  
Кабинеты обслуживают split-поверхности:

| Path (prod today) | Slim target |
|-------------------|-------------|
| `/cabinet/*` | `containers/client` (:3003) / gateway `/client-app/` |
| `/broker/*` | `containers/broker` (:3002) / `/broker-app/` |
| `/manufacturer/*` | `containers/manufacturer` (:3004) / `/manufacturer-app/` |
| Legacy CMS | остаётся на `web` (D6) |

## Env

| Variable | Values | Meaning |
|----------|--------|---------|
| `WEB_SURFACE` / `APP_SURFACE` | `full` (default) | монолит UI как сейчас на Vercel |
| | `slim` | сигнал для агентов/CI: кабинеты не расширять в `web` |

Compose: `WEB_SURFACE=${WEB_SURFACE:-full}` → `APP_SURFACE` на сервисе `web`.  
Код: [`src/lib/ved/web-surface.ts`](../../src/lib/ved/web-surface.ts) (`getWebSurface`).

## Gateway auth smoke (обязательный gate перед cutover)

```bash
# docker compose --profile full up
TEST_API_URL=http://localhost:8080 NEXTAUTH_URL=http://localhost:8080 npm run smoke:gateway
```

Проверяет: login через gateway → `/api/v1/me` с cookie → `/cabinet` (+ optional `/client-app/`).

## Как включать позже (не сейчас)

1. Зелёные C1–C4 + **`npm run smoke:gateway`** через `:8080`.
2. Reverse-proxy на edge: `/cabinet` → client, `/broker` → broker, `/admin` (VED) → admin.
3. Убрать дублирующие cabinet routes из корневого Next **только** после проверки auth cookies / `NEXTAUTH_URL`.
4. ADR cutover (отдельный) + feature flag `WEB_SURFACE=slim`.

## Запреты до cutover

- Не удалять `/cabinet`, `/broker`, `/admin` из корневого Next.
- Не требовать `WEB_SURFACE=slim` в Vercel.
- Не тащить Prisma в UI-контейнеры.
