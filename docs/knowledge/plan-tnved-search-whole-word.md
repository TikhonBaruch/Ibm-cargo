# План: whole-word search + notes as clarification

**Статус:** **done** unit · await deploy  
**Канон:** [`plan-tnved-search-alias-boost.md`](./plan-tnved-search-alias-boost.md) · [`plan-tnved-hint-chains-audit.md`](./plan-tnved-hint-chains-audit.md)

## 1. Идея

Live `q=ноутбук` топ = `442191` «Из бамбука», потому что FTS-notes содержат «ноутбука» (подставка), а title ноутбука (`847130`) без слова «ноутбук» проигрывает при равном leaf-score / code order.

## 2. Правила

1. **Title / notes:** только token / word-prefix (`hasTokenOrPrefix`), **не** mid-word substring.
2. **Notes = уточнение:** вес notes-token ≪ title-token; phrase-in-notes тоже secondary.
3. **Alias:** `ноутбук|laptop|notebook|macbook` → codePrefix `847130` (pool + score), как HDD→8471.

## 3. Критерий

`q=ноутбук` → top `847130*` · bamboo `4421*` ниже · морс/HDD H5 без регрессии.
