# План: search false-friend audit + fix loop

**Статус:** in progress · 2026-09-04  
**Канон:** [`plan-tnved-search-alias-boost.md`](./plan-tnved-search-alias-boost.md) · [`plan-tnved-search-whole-word.md`](./plan-tnved-search-whole-word.md) · staging H5.

## 1. Идея

После морс/HDD/ноутбук нужен **повторяемый** аудит: top `/api/v1/tnved/search` не должен уезжать в чужую главу из‑за substring / notes hitchhike.

## 2. Алгоритм проверки

```text
corpus = dictionary.rows[searchPrefix] ∪ critical HS ∪ H5 seeds
for each (query, expectedPrefix):
  live:  GET /tnved/search?q → top.code
  offline: score(good leaf under prefix) vs score(known decoys) + alias resolve
  FAIL/HITCH if top digits !startsWith any alt of expectedPrefix (pipe-alts OK)
  EMPTY if no rows
report: HITCH/EMPTY table → miss-driven aliases / blockHit / soft expected
```

| Шаг | Вход | Выход |
|-----|------|-------|
| A Corpus | probe-dictionary `searchPrefix` + critical + seeds | JSON rows |
| B Live | prod/preview cookie search | top code / title |
| C Offline | `scoreTnvedSearchHit` + decoy fixture | score order |
| D Gate | `--fail-on hitch` / `empty` / `any` | exit 1 |

Команда: `npm run probe:search-ff` · live: `--live` · `TEST_API_URL=…`.

## 3. Baseline live (prod 2026-09-04)

`n=66` → **OK 27 / HITCH 29 / EMPTY 10**.

Классы (как морс/HDD):

| Класс | Примеры | Лечение |
|-------|---------|---------|
| A Lexical hitch | лимонад→1704, порошок→7106, вафли→мыло, мин.вода→вата, бампер→аттракцион, hdmi→желоба | alias + `blockHit` |
| B Empty / abbr | SSD, кофемашина, чайник, кола, чипсы, курица… | alias `codePrefix` OR + expand |
| C Near-HS soft | кеды 6403↔6404, молоко 0402↔0401, ткань 52xx, пижама 610x | alias + soft `searchPrefix` / `\|` alts |
| D Wrong chapter | коляска→8711, сигареты→e-cig, ручка→плетёнка, торт→столовые | alias boost |

## 4. Структура работ

| # | Действие | Done when |
|---|----------|-----------|
| 1 | `scripts/probe-search-false-friends.ts` + KB | **done** |
| 2 | Live+offline baseline | **done** §3 |
| 3 | Aliases / blockHit / soft expects + tests | in progress |
| 4 | Re-probe + staging note + PR | 0 HITCH/EMPTY on corpus (gate) |

## 5. Критерий закрытия

`npm run probe:search-ff -- --live --fail-on any` → **0 bad** на golden corpus; unit decoys зелёные.
