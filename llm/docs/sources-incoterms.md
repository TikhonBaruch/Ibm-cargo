# Источники: Инкотермс / комментарии ICC

Инвентарь обновлён **2026-08-11**.

**Канон продуктовой KB (LBM):** [`../docs/knowledge/incoterms.md`](../../docs/knowledge/incoterms.md)  
(если репозитории рядом: `Ibm-cargo (this repo)/docs/knowledge/incoterms.md`).

Этот файл — зеркало для LLM-матрицы (`services/logistics`, future documents).  
LBM: **Growth hold**, не MVP CTA (D27).

## Иерархия истины

| Приоритет | Источник | Пишет / роль |
|-----------|----------|----------------|
| **1** | *Incoterms® 2020* ICC № **723** / RU **723ER** | Канон текста правил (EN оригинал; RU = офиц. перевод ICC Russia) |
| **2** | *ICC Guide to Incoterms® 2020* **P805E** (Herre / Tiberg) | Detailed commentary по 11 правилам |
| **3** | Введение к 723 (Debattista) | Do / do NOT; выбор термина; 2010→2020 |
| **4** | Guide 2010 / ICC **720R** (Рамберг / Вилкова) | Исторический RU-комментарий к редакции 2010 |
| — | Вилкова / ВЭД-обзоры | Secondary FAQ only |

## Доступ

| Источник | Доступ |
|----------|--------|
| [P805E Guide](https://2go.iccwbo.org/icc-guide-to-incoterms-2020.html) | **PAY** |
| [723ER iccbooks](https://iccbooks.ru/catalog/mezhdunarodnyy-biznes/inkoterms-2020-pravila-icc-po-ispolzovaniyu-natsio/) | **PAY** |
| [720R Комментарий 2010](https://iccbooks.ru/catalog/mezhdunarodnyy-biznes/kommentariy-icc-k-inkoterms-2010-ponimanie-i-prakticheskoe-primenenie/) | **PAY** |
| [Intro PDF](https://www.icc-switzerland.ch/images/723e_inco2020_eng_intro.pdf) | **OK** (фрагмент) |
| [Key changes](https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/) | **OK** |
| Пиратские полные PDF | **NO** |

## Политика

- Не scrape HTML «таблиц базисов» как эталон.
- Не класть полный текст A1–B10 / Guide в git без лицензии ICC.
- Допустимо: собственные выжимки (do/do-not, список 11 терминов, новеллы 2020) + ссылки на официальные магазины.
- Wire в LBM: только после ADR + env; logistics stub остаётся stub до wiring.

См. также: [`sources-tnved.md`](./sources-tnved.md), [`integration-lbm.md`](./integration-lbm.md).
