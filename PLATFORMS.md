# LBM (Ibm-cargo)

| | |
|---|---|
| Продукт | **LBM** |
| GitHub | `TikhonBaruch/Ibm-cargo` |
| Vercel | `ibm-cargo` · Root Directory **`app`** |
| S3 | bucket **`lbm`** (отдельное) |
| Postgres | **отдельная** БД (`app/.env`) |

## UI lab

- `/client/*` — дизайн lbm-bro (`app/src/lbm-bro`)
- `/cabinet` + `/api/v1` — функция
- Нет domain → `DesignerStub`
- План визуала: [`docs/plan-lbm-bro-skin.md`](docs/plan-lbm-bro-skin.md)
- Карта структуры: [`docs/architecture-map.md`](docs/architecture-map.md)

Приложение живёт в **`app/`**. Чужие репозитории/БД/S3 в runtime не использовать.
