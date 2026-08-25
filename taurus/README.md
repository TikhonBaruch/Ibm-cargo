# LBM Брокер (пакет `taurus/` в ibm-cargo)

AI-платформа для импорта / ВЭД.  
Репозиторий продукта: **ibm-cargo** — развивается отдельно от upstream taurus. Имя папки `taurus/` — историческое.

**Документация:** [`docs/README.md`](docs/README.md) · **Контейнеры:** [`containers/README.md`](containers/README.md) · **Корень монорепо:** [`../README.md`](../README.md)

## Стек

| Компонент | Технология |
|---|---|
| UI | Next.js 16, TypeScript, Tailwind |
| БД | PostgreSQL + Prisma 6 |
| Auth | NextAuth v4 |
| Контейнеры | Docker Compose (`containers/*`) |
| Хостинг UI | Vercel |

## Быстрый старт

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

## Контейнеры

```bash
cp docker.env.example .env   # при необходимости
npm run docker:core          # postgres + api + ai
npm run docker:web           # + Next web
npm run docker:full          # полный стек + gateway :8080
```

См. [`docs/containers.md`](docs/containers.md), [`docs/development.md`](docs/development.md), [`docs/knowledge/environments.md`](docs/knowledge/environments.md).

## Структура

```text
app/ src/ prisma/     # Next UI (Vercel)
containers/
  web/ admin/ broker/ # поверхности
  api/ ai/            # backend stubs
  gateway/ postgres/  # infra
packages/ docs/
docker-compose.yml
```

## Ссылки

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/knowledge/product.md`](docs/knowledge/product.md)
- [`docs/knowledge/database.md`](docs/knowledge/database.md)
- [`docs/knowledge/ai-pipeline.md`](docs/knowledge/ai-pipeline.md)
