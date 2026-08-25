# Инкотермс: комментарии и источники

Инвентарь обновлён **2026-08-11**.  
**Статус в продукте (D27):** справочник / Growth — **не** текущий CTA. Shipping UI выкл.; deliverable MVP = ТН ВЭД → брокер-QC → PDF ([`product.md`](./product.md)).  
Связано: перевозка / 3PL — [`growth.md`](./growth.md) §«Перевозка»; внешняя LLM-матрица logistics — репозиторий [`llm`](../../../llm/) (`services/logistics`).

## Что имеется в виду под «Комментариями»

| Уровень | Издание | Статус |
|--------|---------|--------|
| Официальный **Guide** ICC | *ICC Guide to Incoterms® 2020* (P805E, ISBN 978-92-842-0522-6, 2022, ~244 стр.) — Johnny Herre, Oscar Tiberg | Платный (~€55–69): [Knowledge 2 Go](https://2go.iccwbo.org/icc-guide-to-incoterms-2020.html). Раздел *«INCOTERMS® 2020, A DETAILED COMMENTARY»* — разбор всех 11 правил |
| Предшественник | *Комментарий ICC к Инкотермс 2010* — Ян Рамберг; рус. пер. Н.Г. Вилковой = ICC № **720** / **720R** | Платный у [ICC Russia / iccbooks](https://iccbooks.ru/catalog/mezhdunarodnyy-biznes/kommentariy-icc-k-inkoterms-2010-ponimanie-i-prakticheskoe-primenenie/) |
| Текст правил + **Введение** | *Incoterms® 2020* — ICC № **723** / RU **723ER** (двуязычн. ICC Russia) | Платно; Введение (Charles Debattista) = практический комментарий «что делают / не делают правила» |
| Сопутствующее | *ICC Handbook on Transport and the Incoterms® 2020 Rules* | Платно, транспортный угол |
| Вторичные | статьи Н.Г. Вилковой, обзоры ВЭД-порталов, СПС | Не заменяют официальный Guide |

Русского перевода **Guide 2020** как открытого канона нет (в отличие от Guide 2010 / Рамберг). Для РФ канон **текста** правил — **723ER**; «глубокий» комментарий 2020 — англ. Guide **P805E**.

## Инварианты для продукта / AI

1. Инкотермс описывают **обязанности**, **риск** (момент «поставки») и **расходы** между продавцом и покупателем — не заменяют договор КП.
2. **Не** регулируют: переход права собственности; цену/оплату; санкции/тарифы/запреты; force majeure; IP; подсудность; спецификацию товара.
3. В контракте: `[термин] [именованное место/порт] Incoterms® 2020` (год обязателен).
4. Не путать риск (Инкотермс) и ownership (отдельная оговорка / применимое право / CISG).
5. Полный текст A1–B10 и Guide — **IP ICC**. Для корпуса / LLM: только лицензия ICC или собственные выжимки **без** копирования правил. Скрейп пиратских PDF — запрещён.

## 11 терминов (Incoterms® 2020)

| Любой вид транспорта | Только море / внутр. воды |
|----------------------|---------------------------|
| EXW, FCA, CPT, CIP, DAP, DPU, DDP | FAS, FOB, CFR, CIF |

Группы E → F → C → D: рост обязанностей продавца (от «с завода» до «доставлено / с очисткой»).

## Ключевые новеллы 2020 (офиц. комментарий к изменениям)

Источник: [iccwbo.org Incoterms® 2020](https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/) + Введение к 723.

| Тема | Суть |
|------|------|
| **FCA** | Опция onboard B/L по соглашению (A6/B6) — для банков / аккредитива |
| **DAT → DPU** | Выгрузка в любом месте (не только «терминал»); рядом с DAP |
| **CIF vs CIP** | CIF: Institute Cargo Clauses **(C)** по умолчанию; CIP: более широкий **(A)** (или аналог) |
| **Costs** | Свод всех расходов в **A9/B9** (+ по-прежнему в тематических статьях) |
| **Security** | Яснее в A4/A7 и в A9/B9 |
| **Carriage** | Учтён сценарий без стороннего carrier (свой транспорт) |

## Практика (из доступных комментариев)

- Контейнеры: чаще **FCA**, не «классический» FOB у борта.
- **EXW**: экспортная очистка фактически у покупателя — часто неудобно; осторожность / предпочтение FCA.
- **DDP**: импортная очистка и пошлины на продавце — риск запретов/лицензий в стране покупателя.
- Варианты («FOB stowed» и т.п.) — вне стандартных правил; Введение предупреждает.

## Инвентарь URL / доступ

Легенда: **OK** — бесплатный / полуоткрытый слой; **PAY** — лицензия ICC / магазин; **SEC** — вторичка (не канон); **NO** — не для корпуса.

| URL / источник | Что даёт | Доступ |
|----------------|----------|--------|
| [icc Guide 2020 P805E](https://2go.iccwbo.org/icc-guide-to-incoterms-2020.html) | Detailed commentary по 11 правилам | **PAY** |
| [iccbooks 723ER](https://iccbooks.ru/catalog/mezhdunarodnyy-biznes/inkoterms-2020-pravila-icc-po-ispolzovaniyu-natsio/) | Офиц. RU+EN текст правил + Введение | **PAY** |
| [iccbooks Guide 2010 / 720R](https://iccbooks.ru/catalog/mezhdunarodnyy-biznes/kommentariy-icc-k-inkoterms-2010-ponimanie-i-prakticheskoe-primenenie/) | Рамберг / Вилкова (к редакции 2010) | **PAY** |
| [723e Intro PDF (фрагмент)](https://www.icc-switzerland.ch/images/723e_inco2020_eng_intro.pdf) | Введение: do / do NOT, выбор термина, 2010→2020 | **OK** |
| [iccwbo.org key changes](https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/) | Новеллы FCA/DPU/CIF·CIP/costs/security | **OK** |
| K2Go checklist + flowcharts | Выбор термина (графика) | **OK** (free SKU на K2Go) |
| [Вилкова / ICC Russia](https://iccwbo.ru/tpost/trixfvizt1-pochemu-incoterms-2020-luchshe-predidusc) | Экспертный разбор новелл (RU) | **SEC** |
| [Таможенная академия](https://customs-academy.net/?p=16937) | То же / перепост экспертного мнения | **SEC** |
| [pvs.ru рекомендации](https://pvs.ru/news/2023.10.09.html) | Как включать в контракт; границы Инкотермс | **SEC** |
| Популярные таблицы базисов (банки, логисты) | Краткие расшифровки | **SEC** — часто путают риск / собственность / таможню |
| Пиратские PDF полного текста / Guide | — | **NO** |

## Guide 2020 — оглавление (платный слой)

Полезные блоки TOC для будущей навигации / RAG (без копирования текста):

1. Evolution 1936→2020; sales + additional contracts  
2. Understanding the rules (carriage, insurance, L/C, e-commerce, variants)  
3. Categories E / F / C / D  
4. Seller/buyer obligations overview (A1–B10)  
5. **Detailed commentary** — EXW…DDP, затем FAS…CIF  
6. Role in sale contract / CISG / ICC model sale contract  

Авторы Guide 2020: Johnny Herre, Oscar Tiberg (Swedish ICC Commercial Law & Practice).

## Политика корпуса (как у ТН ВЭД)

| Источник | Bulk / API | Пригодно как corpus |
|----------|------------|---------------------|
| Guide / 723 полный текст | Нет, покупка | Только с лицензией ICC |
| Введение 2020 (открытый PDF) | Да, частично | База «что / не что» + выбор термина |
| Key changes ICC | Да | Чеклист новелл |
| Вилкова / вторичка | Да | FAQ / обучение, не канон |
| HTML-таблицы чужих сайтов | — | Не scrape как эталон |

Инвентарь-зеркало для LLM-матрицы (тот же ibm-cargo): [`../../../llm/docs/sources-incoterms.md`](../../../llm/docs/sources-incoterms.md).

## Связь с LBM Брокер

| Тема | Где |
|------|-----|
| Shipping после `DONE` (D15); UI hold (D27) | [`growth.md`](./growth.md), [`current-app.md`](./current-app.md) |
| Поля заявки / attrs | [`calculation-fields.md`](./calculation-fields.md) — базис поставки **не** MVP-обязателен |
| Logistics AI stub | llm `services/logistics` · contract `d-logistics.llm.json` |
| Не обещать «под ключ» в CTA | [`product.md`](./product.md) · ADR D27 |

**Follow-up (не сейчас):** лицензия ICC → структурированный glossary терминов для logistics/documents AI; поле `incoterms` / базис в attrs или контракте — отдельная задача Growth, не ломать D27.
