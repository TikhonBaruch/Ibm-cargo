# Chain 1 — NVIDIA (legacy)

Historic path: OpenAI-compatible NVIDIA NIM for classify (± vision via NIM multimodal if configured).

## Env (example)

See `profile.env.example`. Typical:

- `OPENAI_API_KEY=nvapi-…`
- `OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1`
- `LLM_CLASSIFY_MODEL=meta/llama-3.1-8b-instruct`

Taurus: `AI_CHAIN_ID=1`.
