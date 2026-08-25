# LBM-owned TN VED corpus mount (D36)

Place `codes.jsonl` (and optional `notes.jsonl`) here for Compose / host mesh.

Default compose: `TNVED_DATA_DIR=./containers/llm/data/tnved/normalized` → `/data/tnved`.

Do **not** mount or sync from nested `./llm` or taurus/llm (D36 zero coupling).
Without files, `containers/llm` lookup fail-opens (stub/lexical).

