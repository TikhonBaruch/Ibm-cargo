# План: карточка заявки как страница (C15)

**D33.** Референс: lab [`/client/orders/47892`](../../app/client/orders/[id]/page.tsx) = [`ClientOrderPage`](../../src/lbm-bro/components/client-order-page.tsx) (демо `#47892` Ноутбуки Lenovo ThinkPad, статус done, тариф «Таможня»).  
Live сейчас: slide-over `VedDetailDrawer` на `/cabinet/orders?id=`. Пользователь: **отдельная страница + полный chrome макета; нереализованное — stub**.

Канон: [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) C2/C8/C9 · D8/D10/D11 · НДС **22%** / сбор **ПП 1637**.

## 1. Идея

`/cabinet/orders/[id]` — полноэкранная карточка в `LbmCabinetsShell` (не drawer). Клик в списке / ленте → эта страница. «← К заявкам» → `/cabinet/orders`.

**Паттерн (D32):** application **detail page** (как lab `/client/orders/[id]`), не slide-over. Drawer на заявке снимаем.

## 2. Что копируем с 47892 (chrome)

Шапка: «← К заявкам», kicker «Заявка #», title, meta «страна · тариф», pill.  
`.timeline` (точки + подписи). `.order-hs` + cover. `.order-facts`. Документы. Aside: next CTA, платежи, брокер, события. Сетка `.order-full-grid`.

## 3. Live vs stub

| Блок макета | Live | Stub (слот есть, domain нет) |
|-------------|------|------------------------------|
| HS, confidence, описание | `/api/v1` (код **не** прячем за оплату) | — |
| Пошлина / НДС / сбор | НДС **22%**, ПП **1637** | не 20% / не 15 000 |
| Тариф | D10 EXPRESS/STANDARD/PRO | не «Код / Таможня / Под ключ» |
| Оплата тарифа, PDF DONE, чат после очереди | D11 / PDF / chat | — |
| Timeline 5 шагов 47892 | прогресс из D8 | подписи chrome: Параметры / Оплата / Код / Платежи / Файл (EXPRESS без «Платежи» как 4 шага, если нет брокера — всё равно 5 chrome как макет **или** 4 honest; канон: 4–5 с D8 current) |
| PaymentsForm (город, инвойс, вес) | — | disabled поля, **не** считать 20% |
| UpgradeTile Код→Таможня→Под ключ | — | плитки, CTA disabled |
| Перевозка / Оформление / Брокер под ключ | shipping UI off | `.order-svc` плитки, не заказ |
| Share demo-PDF, «Передать брокеру» без оплаты | — | нет CTA (D11) |
| DocUploader новых файлов | item `mediaUrl` как чипы | dropzone hold |

## 4. Не делать

Менять D8/D10/D11; прятать live HS до оплаты; считать НДС 20%; апгрейд линейки с карточки; второй drawer; возвращать бейдж «Замысел дизайнера».

## 5. Проверка

Список → `/cabinet/orders/{id}` (не `?id=`). Нет overlay. 47892-layout: timeline, HS, facts, aside. Stub-плитки не вызывают pay/upgrade. `npm run test:ci`.
