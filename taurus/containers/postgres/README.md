# containers/postgres

Локальный PostgreSQL для Compose (не путать с prod sweb `newlsu_taurus`).

- Image: `pgvector/pgvector:pg17` (extension `vector` for precedent embeddings)
- Init: `init/*.sql` монтируется в `/docker-entrypoint-initdb.d`
- Данные: volume `pgdata`
