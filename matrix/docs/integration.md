# Integration with app (repo root)

Репозиторий: **ibm-cargo** · матрица: `matrix/` · app: корень.  
Папок `taurus/` / `llm/` нет.

## Already wireable

1. Start matrix:

```bash
cd matrix
cp .env.example .env
docker compose up --build
# or: PORT=4500 npm run start:classification & PORT=4700 npm run start:ocr &
```

2. Point app (root `.env`):

```bash
LLM_SERVICE_URL=http://127.0.0.1:4500
OCR_SERVICE_URL=http://127.0.0.1:4700
```

Mode B Compose hardcodes `http://llm:4500` for ai/api/web — do not put `127.0.0.1` into container env.

3. **TN VED corpus (lookup-v1)** in `docker-compose.yml`:

```bash
TNVED_CODES_PATH=/data/tnved/codes.jsonl
volumes:
  - ./matrix/data/tnved/normalized:/data/tnved:ro
```

4. Sync mirrors from repo root: `npm run sync:ai-matrix`.

## Canon vs Compose mirrors

| Capability | Canon | Compose mirror |
|------------|-------|----------------|
| classify/duty | `matrix/services/classification` | `containers/llm` |
| OCR extract | `matrix/services/ocr` | `containers/ocr` |
