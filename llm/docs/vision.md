# Vision — шесть AI-модулей

Источник pitch: Taurus landing `#features` (`src/components/landing/markup.ts`) + `docs/knowledge/product.md`.

> **Vision ≠ as-is.** Taurus MVP (D27): ТН ВЭД draft → брокер-QC → PDF.  
> This matrix develops model services externally for later URL wiring.

## Модули

1. **AI Classification** — код ТН ВЭД по описанию и документам с пояснением уверенности модели.
2. **AI OCR** — извлечение данных из invoice, packing list и сертификатов без ручного ввода.
3. **AI Broker** — чат 24/7 по кодам, ставкам и рискам — с эскалацией живому брокеру.
4. **AI Risk** — вероятность досмотра и красные флаги до подачи ДТ.
5. **AI Logistics** — маршрут и перевозчик по сроку, цене и типу груза.
6. **AI Documents** — ошибки в комплекте документов до отправки на таможню.

## product.md (выжимка)

AI — первая линия; брокер подтверждает. Ценность: уверенность в стоимости импорта до оплаты поставщику.

Roadmap фаз (Taurus): MVP → Growth (OCR, консультант) → Platform → Ecosystem.  
OCR / Risk / Cargo в Taurus помечены Growth / P3; heuristic-v1 остаётся ядром draft.

См. также [`matrix.md`](./matrix.md), [`integration-taurus.md`](./integration-taurus.md).
