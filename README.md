# ibm-cargo

AI-платформа импорта / ВЭД. Самостоятельный продукт (не зеркало upstream taurus).

Публичный бренд UI пока: **LBM Брокер**.

## Раскладка

```text
.                 # Next.js app (Vercel) + Prisma + Compose
├── app/ src/ prisma/ containers/ docs/
├── matrix/       # HTTP AI-матрица (classify / OCR / …)
└── README.md
```

Имена папок `taurus/` и `llm/` **не используются**.

## Env

| Файл | Назначение |
|------|------------|
| `.env` | Next / Prisma / Auth (локально, не в git) |
| `matrix/.env` | матрица ports / keys (локально, не в git) |
| `.env.example` | шаблон app |
| `matrix/.env.example` | шаблон matrix |

```bash
cp .env.example .env
cp matrix/.env.example matrix/.env
```

## Быстрый старт (Mode A)

```bash
# Postgres: taurus:taurus@127.0.0.1:5432/taurus  (имя роли БД историческое)
npm install
npx prisma db push
npx prisma db seed     # client@ / broker@ / admin@ · demo1234
npm run dev            # http://localhost:3000
```

Опционально AI stub: `node containers/ai/src/index.js` → `:4100`.  
Матрица: `cd matrix && npm install && PORT=4500 npm run start:classification`.

Документы: [`docs/development.md`](docs/development.md) · [`docs/knowledge/environments.md`](docs/knowledge/environments.md) · [`AGENTS.md`](AGENTS.md).

## Происхождение

Скопировано из кодовой базы taurus + llm (2026-08-25), затем пересобрано в эту раскладку. Архив: [`FORK.md`](FORK.md).
