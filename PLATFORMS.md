# LBM (Ibm-cargo)

| | |
|---|---|
| Продукт | **LBM** |
| GitHub | `TikhonBaruch/Ibm-cargo` |
| Vercel | `ibm-cargo` · Root Directory **`app`** |
| S3 | bucket **`lbm`** (отдельное) |
| Postgres | **отдельная** БД (`newlsu_lbm` на sweb) |

## Vercel checklist

1. Root Directory = `app` (**только dashboard** → Settings → General)
2. Env: `DATABASE_URL`, `NEXTAUTH_*`, `NEXT_PUBLIC_SITE_URL`, `ALLOW_MOCK_TOPUP`, `CRON_SECRET`
3. Redeploy после env
4. Smoke: `cd app && TEST_API_URL=https://<host> npm run smoke:mvp`

## UI lab

- `/client/*` — дизайн lbm-bro (`app/src/lbm-bro`)
- `/cabinet` + `/api/v1` — функция
- Нет domain → `DesignerStub`
- План: `docs/plan-lbm-bro-skin.md`

Приложение живёт в **`app/`** (не taurus).
