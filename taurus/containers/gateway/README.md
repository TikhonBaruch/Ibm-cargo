# containers/gateway

Nginx reverse proxy (профиль `full`), порт host `8080`.

Маршруты → upstream в сети `lbm`:

| Location | Upstream |
|----------|----------|
| `/` | `web:3000` |
| `/admin-app/` | `admin:3001` |
| `/broker-app/` | `broker:3002` |
| `/api/domain/` | `api:4000` |
| `/api/v1/ai/` | `ai:4100` |
