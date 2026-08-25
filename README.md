# LBM fork (2026-08-25)

Полный форк кода taurus + llm (git history + working tree на момент копирования).

## Что включено
- Исходники, docs, contracts, containers, prisma schema/migrations
- Незакоммиченные правки (в т.ч. precedent-suggest)
- `.env.example` (не `.env` — секреты не копировались)

## Что не включено (следующий шаг)
- База данных (Postgres volume / dump)
- Хранилище uploads / S3
- `node_modules` / `.next` — поставить: `cd taurus && npm ci` (и при необходимости containers/*)

## Открытие
```bash
cursor /home/andrey/Projects/.worktrees/lbm-fork-2026-08-25/lbm.code-workspace
```

Источник: `/home/andrey/taurus` + `/home/andrey/llm`
