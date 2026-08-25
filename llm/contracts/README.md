# Contracts

Frozen JSON Schema envelopes for the LLM matrix.  
Sync with LBM `docs/contracts/` when transport shapes change.

| File | Service | LBM alias |
|------|---------|--------------|
| `d-classification.llm.json` | classification | `d-draft.llm.json` |
| `d-ocr.ai.json` | ocr | same |
| `d-draft.ai.consumer.json` | (LBM ai context) | `d-draft.ai.json` |
| `d-broker.llm.json` | broker | — |
| `d-risk.llm.json` | risk | — |
| `d-logistics.llm.json` | logistics | — (≠ `d-ship.logistics.json`) |
| `d-documents.llm.json` | documents | — |
| `d-ai.pipeline.json` | ocr + classification | `d-ai.pipeline.json` |
