# ibm-cargo

Самостоятельный продукт (AI-платформа импорта / ВЭД).  
Живёт **отдельно** от upstream `taurus` — свой remote, ветки, релизы и документация. Sync с исходным проектом не предполагается.

Публичный бренд UI пока: **LBM Брокер**. Внутренняя раскладка репозитория:

| Каталог | Роль |
|---------|------|
| [`taurus/`](taurus/) | Оркестратор: Next.js UI, Prisma, FSM просчёта, кабинеты, Compose |
| [`llm/`](llm/) | HTTP-матрица classify / OCR / … (без D8 FSM) |

Workspace: [`ibm-cargo.code-workspace`](ibm-cargo.code-workspace).

## Быстрый старт (Mode A)

```bash
# Postgres: пользователь/БД taurus:taurus@127.0.0.1:5432/taurus
cd taurus
cp .env.example .env   # или готовый локальный .env
npm install
npx prisma db push
npx prisma db seed     # client@ / broker@ / admin@ · demo1234
npm run dev            # http://localhost:3000
```

Опционально AI stub: `node containers/ai/src/index.js` → `:4100`.  
Подробнее: [`taurus/docs/development.md`](taurus/docs/development.md) · [`taurus/docs/knowledge/environments.md`](taurus/docs/knowledge/environments.md).

## Что не в git

- Секреты (`.env`)
- Postgres volume / dump
- Uploads / S3
- `node_modules` / `.next`

## Происхождение

Изначально скопирован из кодовой базы taurus + llm (2026-08-25). Исторический манифест: [`FORK.md`](FORK.md). Дальнейшая эволюция — только в этом репозитории.
