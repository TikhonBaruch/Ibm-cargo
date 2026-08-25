"use client";

import Link from "next/link";
import { useState } from "react";

const FAQ: Array<[string, string]> = [
  [
    "Чем отличаются тарифы просчёта кода?",
    "EXPRESS — 1 позиция, только AI, без очереди брокера при высокой уверенности. STANDARD — до 3 позиций, после оплаты заявка в очередь брокера. PRO — до 10 позиций, очередь брокера. Цены берутся из TariffPlan, не из пакетов «Код / Таможня / Под ключ» макета.",
  ],
  [
    "Когда я вижу код ТН ВЭД?",
    "Heuristic готовит черновик сразу после создания заявки. Финальный код подтверждает брокер после оплаты (STANDARD/PRO). EXPRESS может закрыться без очереди при high conf. Бесплатного «одного пика» справочника в domain нет.",
  ],
  [
    "Когда считают пошлину и НДС?",
    "В смете заявки: НДС 22%, таможенный сбор по ПП 1637. Это не 20% и не 15 000 ₽ из макета дизайнера.",
  ],
  [
    "Как работает мультипозиция?",
    "Лимит D10: EXPRESS 1 / STANDARD 3 / PRO 10. CSV, Excel или фото — на форме нового просчёта. Справочник ищет одну позицию через GET /api/v1/tnved/search.",
  ],
];

export function FaqPane({ homeHref }: { homeHref: string }) {
  const [open, setOpen] = useState(0);
  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>FAQ</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Коротко про расчёт, брокера и документы
          </p>
        </div>
        <Link href={homeHref} className="btn btn-ghost btn-sm">
          На главную
        </Link>
      </div>
      {FAQ.map(([q, a], i) => (
        <div key={q} className={`faq-item${open === i ? " open" : ""}`}>
          <button type="button" className="q" onClick={() => setOpen(open === i ? -1 : i)}>
            {q} <span>▾</span>
          </button>
          <div className="a">{a}</div>
        </div>
      ))}
    </>
  );
}
