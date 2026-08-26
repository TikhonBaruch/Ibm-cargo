# Анализ lbm-bro → план визуала LBM (Ibm-cargo)

**Площадка:** `TikhonBaruch/Ibm-cargo` (продукт **LBM**).  
**Код приложения:** `app/` (Vercel Root Directory).  
**Инфра:** отдельная Postgres + S3 bucket `lbm`.  
**Источник UI:** lbm-bro prototype · [`PLATFORMS.md`](../PLATFORMS.md)

---

## 1. Что заложил «Дизайнер» (решения)

### 1.1. Продуктовая метафора

**Суперприложение**, не «форма просчёта». Главная = сетка модулей («Что сделаем?»): консультация, Честный знак, ТН ВЭД, заявки, чат, FAQ, гайд, перевозка, ТО, брокер под ключ.

### 1.2. Визуальный язык (канон = Next-прототип, не ранний UX.md)

| Токен | Значение | Заметка |
|-------|----------|---------|
| Primary | `#2b72f4` | В UX.md был `#1B4F8A` — прототип новее |
| Fonts | Manrope + Nunito | UX.md писал Inter — **не используем** |
| Radius | 28px / 16px | Крупные «soft» карточки |
| Proto-bar | Админ / Клиент / Брокер | Только lab, не prod |

### 1.3. Тарифная модель дизайнера (≠ taurus D10)

| Дизайн | Смысл | В taurus |
|--------|--------|----------|
| **Код** (990 ₽, 1-й бесплатно) | Только HS | Нет freemium-гейта |
| **Таможня** (2990) | HS + пошлина/НДС, без брокера | Ближе к EXPRESS без QC? |
| **Под ключ** (5990) | + брокер ≤4ч | STANDARD/PRO + queue |
| Пакеты m20 / m100 | Мультипозиция | D10: 1 / 3 / 10 позиций |

**Дизайнер хотел:** воронку «бесплатный код → апгрейд Таможня/Под ключ», upgrade tiles на карточке заявки.

### 1.4. Статусы заявки (дизайн)

`draft → pay → ai → ready → broker → done`  
Плюс фильтры ленты: Все / Оплата / ТН ВЭД / В работе / Готово.

### 1.5. Клиентские экраны (структура кода)

```
components/
  client-shell     # sidebar + balance chip + nav
  client-home      # superapp grid + feed
  client-wizard    # /new — OCR, clarify, тарифы, PDF demo
  client-orders    # карточки
  client-order-page# деталь + upgrade + payments form
  client-extra     # FAQ, guide, balance, chat, brokers, ship, clearance, company
  client-tnved     # справочник + free peek
lib/
  store.tsx        # DemoProvider (localStorage) — НЕ domain
  tariffs / payments / clarify-ai / tnved-lookup / order-pdf …
```

### 1.6. Что есть только в дизайне (нет / hold в taurus domain)

| Модуль | Замысел дизайнера | Domain taurus |
|--------|-------------------|---------------|
| **Честный знак** | Маркировка в заявке, брокер проверяет коды | Нет продукта |
| **Таможенное оформление (ТО)** | Декларация / выпуск после кода | Нет полного модуля |
| **Голос в чате** | Voice bubbles | Текст |
| **1-й HS бесплатно** | Freemium peek | Нет |
| **Тарифы Код/Таможня/Под ключ** | Отдельный product packaging | EXPRESS/STANDARD/PRO |
| **Клиентский classify в браузере** | tnved.json + aliases | Server + LLM fail-open |
| **Clarify-AI chips** | Вопросы до оплаты | Attr chips heuristic |
| **Shipping на главной** | LTL/FTL CTA | Domain есть, UI default **off** (D27) |
| Proto-bar ролей | Демо | Запрещён в prod |

### 1.7. Что пересекается с taurus (можно подключать позже)

Create calc, pay, queue/claim, chat text, balance/ledger, PDF, HS search, broker work, attrs/upload/CSV — **сохранять**; визуал натягивать поверх API.

---

## 2. Пошаговый план внедрения

### Фаза A — Визуал клиентского lab (сейчас)

1. Зафиксировать анализ (этот файл).
2. Компонент **`DesignerStub`**: бейдж «Замысел дизайнера» + текст + disabled CTA.
3. Главная `/client`: живой вид сетки; модули без domain → stub (ЧЗ, ТО, freemium copy).
4. Shipping на главной → stub со ссылкой «в domain UI off (D27)» / текст замысла.
5. Proto-bar: UI lab / Функция cabinet / Брокер / Админ.
6. `/cabinet` + `/api/v1` не ломать.

### Фаза B — Визуал остальных client-экранов

7. Shell, orders list, order card — CSS/компоненты lbm-bro.
8. Wizard `/client/new` — UI; оплата/AI → stub «подключим к `/api/v1/calculations`».
9. Balance / chat / brokers / FAQ / guide / company — визуал; chat voice → stub.
10. Tnved — визуал; free peek → stub (позже серверный search).

### Фаза C — Визуал broker / admin (после клиента)

11. Не перезаписывать domain `/broker`/`/admin` сразу — lab-маршруты `/lab/broker` *или* skin поверх panes.
12. Очередь / work / SLA дашборд — визуал + stub метрик.

### Фаза D — Сшивка с domain (не визуал)

13. DemoProvider → адаптер: list calcs, create, pay, chat.
14. Маппинг тарифов дизайн ↔ D10 (таблица в KB).
15. Убрать stubs по мере готовности API; freemium/ЧЗ/ТО — ADR или hold.

Дорожная карта слоёв (Phase 1–4): [`architecture-map.md`](./architecture-map.md) § «Дорожная карта внедрения фронта». Образец lab+API: справочник `/client/tnved`.

### Фаза E — Деплой ibm-cargo

16. Vercel Root Directory = **`app`**.
17. Env: выделенная Postgres + S3 bucket `lbm` (только ресурсы Ibm-cargo).
18. Smoke: login → `/client` визуал; `/cabinet` функция; `/client/tnved` на своей БД.

---

## 3. Правила на ibm-cargo

- Меняем только форк `Ibm-cargo`.
- Нет domain → **DesignerStub**, не тихий noop.
- Не менять инварианты D8–D35 «ради красоты».
- Текст stub в UI: коротко «что хотел дизайнер» + статус «не в MVP domain».

---

## 4. Статус

| Шаг | Статус |
|-----|--------|
| Импорт `src/lbm-bro` + `/client` routes | done (предыдущий срез) |
| Анализ + план (этот файл) | **done** |
| DesignerStub + stubs на home / ship / clearance / chat / new | **done** |
| Фаза B: orders / balance / brokers / tnved / company / faq / guide | **done** |
| Фаза C: broker/admin skin | next |
| Domain wire (DemoProvider → `/api/v1`) | later · см. [`architecture-map.md`](./architecture-map.md) |
| Vercel Root=`app` + своя БД/S3 | later |
| ТН ВЭД lab → `/api/v1/tnved` | **done** (Phase 1 образец) |
