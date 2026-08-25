# План: заметка клиенту о сбое LLM (тестовый режим)

## Идея

Сервис в тестовом режиме: если vision (Qwen) или звено classify-цепочки не сработало, **отчёт клиента** (карточка + PDF) должен явно сказать, что какая-то LLM не ответила — без сырых HTTP/ключей.

## Анализ

- Сбои уже есть в `visionTrace` / ServiceCall / `[ai-drain]` — это для orch/админа, не для клиента.
- PDF берёт `aiDraft.disclaimer` (`buildPdfHtml`); карточка — `OrderDetail`.
- Gate vision-before-classify: с фото при 401 Qwen → fail-open на 6-й попытке; без фото DeepSeek может работать один.

## Структура

1. Коды soft-fail в `aiDraft.llmSoftFails` + клиентский текст «Тестовый режим: не сработало — …».
2. Писать при: vision fail/skip, failover/lexical classify, drain-dead.
3. Мержить текст в `disclaimer` (PDF) + баннер в `OrderDetail`.
4. Unit на форматтер; KB `current-app`.

## Done when

Клиент видит понятную пометку; PDF содержит ту же мысль; секреты/URL не утекают.
