# План: параллельные AI-цепочки 1 / 2 / 3

**Дата:** 2026-08-23. **Цикл D33.**  
Канон: [`plan-parallel-ownership.md`](./plan-parallel-ownership.md) · D35 · [`PACKAGES.md`](../../src/lib/ved/PACKAGES.md).

## Нумерация

| ID | Имя | Vision | Classify | Роль |
|----|-----|--------|----------|------|
| **1** | `nvidia` | NIM / OpenAI-compat NVIDIA (legacy) | NIM instruct | архив / opt-in |
| **2** | `qwen-deepseek` | Qwen-VL | DeepSeek → Qwen failover | **default prod** |
| **3** | `deepseek` | DeepSeek vision-exp | DeepSeek text only | стенд / next |

Env: `AI_CHAIN_ID=1|2|3` (алиасы `nvidia` / `qwen-deepseek` / `deepseek`). Default **2**.

## Структура

- **Не** Docker на вендора. Профили/adapters в `src/lib/ved/chains/` (D36: не `llm/chains/`).
- Capability-сервисы без изменений: `classification`, `ocr`.
- Orch пишет `aiDraft.chainId` + soft-fails; UI не зовёт matrix.

## Шаги

1. Registry + KB + profile folders (**этот цикл**).
2. Цепочка 3: DeepSeek vision + classify-only-deepseek.
3. Позже: shadow 2∥3, admin toggle.

## Жёстко

Fail-open create · vision-before-classify gate · model ≠ container · envelope sync.
