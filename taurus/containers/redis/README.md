# Redis — очередь / кэш

Образ: `redis:7-alpine`. Порт хоста: **6379**. Профили: `core`, `scale`, `full`.

Используется `worker` (`REDIS_URL=redis://redis:6379`) и будущим domain API для rate-limit / session cache.

Отдельный Dockerfile не нужен — сервис описан в корневом `docker-compose.yml`.
