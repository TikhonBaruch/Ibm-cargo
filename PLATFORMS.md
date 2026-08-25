# LBM (Ibm-cargo)

| | |
|---|---|
| Продукт | **LBM** |
| GitHub | `TikhonBaruch/Ibm-cargo` |
| Vercel | `ibm-cargo` · Root **`.`** · Framework **Services** → `vercel.json` must include `services` (see `vercel.services.bff.json`) |
| S3 | bucket **`lbm`** |
| Mesh | Compose `docker:scale` · без Docker `npm run mesh:up` · Vercel = in-process Qwen/DeepSeek keys |

## UI

- `/client/*` — дизайн lbm-bro
- `/cabinet` + `/api/v1` — функция
