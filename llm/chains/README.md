# AI chains (profiles, not Docker services)

| ID | Folder | Vision | Classify |
|----|--------|--------|----------|
| 1 | [`01-nvidia`](./01-nvidia/) | NVIDIA NIM (legacy) | NIM |
| 2 | [`02-qwen-deepseek`](./02-qwen-deepseek/) | Qwen-VL | DeepSeek → Qwen |
| 3 | [`03-deepseek`](./03-deepseek/) | DeepSeek vision-exp | DeepSeek text |

LBM selects via `AI_CHAIN_ID`. HTTP capabilities stay in `services/classification` and `services/ocr`.  
Rule (D35): **model ≠ container**.
