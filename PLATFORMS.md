# LBM (Ibm-cargo)

| | |
|---|---|
| Продукт | **LBM** |
| GitHub | `TikhonBaruch/Ibm-cargo` |
| Vercel | `ibm-cargo` · Root **`.`** · Framework **Services** → `vercel.json` must include `services` (see `vercel.services.bff.json`). *No Next.js version detected* = Root Directory not `.` (`next` is already in root `package.json`). Not `https://ibm-cargo.vercel.app`. |
| S3 | bucket **`lbm`** |
| Mesh | Compose `docker:scale` · без Docker `npm run mesh:up` · Vercel = in-process Qwen/DeepSeek keys |

## UI

- `/client/*` — дизайн lbm-bro (lab; [`docs/knowledge/plan-lbm-bro-visual.md`](./docs/knowledge/plan-lbm-bro-visual.md))
- `/cabinet` + `/api/v1` — функция
