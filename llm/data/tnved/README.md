# data/tnved — корпус ТН ВЭД / Пояснений

Provenance и обновление: см. [`docs/sources-tnved.md`](../../docs/sources-tnved.md).

## Layout

```text
raw/
  eec-psn/<YYYY-MM-DD>/     # toc.json + pages/*.html|*.json
  eec-ett/<YYYY-MM-DD>/     # manifest.json (+ optional pdfs/)
  nsi-stnvedst/<version>/   # XML/JSON if available
  tws-tnved/<YYYY-MM-DD>/   # local CSV leaves (npm run tnved:parse-tws)
  fts-opendata/<YYYY-MM-DD>/
normalized/
  codes.jsonl               # tree nodes for LBM import
  notes.jsonl               # explanatory note chunks
  classification-decisions.jsonl
export/
  batches/import-XXXX.json  # ≤500 items for POST /v1/tnved/import
```

## Provenance fields (normalized)

Each JSONL line should include where useful:

- `source` — `eec-nsi` | `eec-ett` | `tws-csv` | `fts-opendata` | `inferred-parent` | `eec-psn` (notes)
- `sourceUrl`
- `fetchedAt` (ISO)
- `edition` / `volume` (for notes)

## Update cadence

1. Re-run fetch scripts (rate-limit ~300–500ms between requests) and/or `tnved:parse-tws`.
2. `npm run tnved:normalize`
3. Review diff on `normalized/*.jsonl`
4. `npm run tnved:export-import` then admin import into LBM (staging first).

## Do not

- Bulk-scrape Alta / tnved.info / classifikators / Consultant into this tree (see sources-tnved.md).
- Commit API keys (`TKS_CLIENT_KEY`, Alta tokens) — use `.env`.
