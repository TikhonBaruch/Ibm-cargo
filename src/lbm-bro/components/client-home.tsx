"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/lbm-bro/components/icon";
import { OrderCover } from "@/lbm-bro/components/order-cover";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import { pickOrderCover } from "@/lbm-bro/lib/docs";
import { FEED_FILTERS, feedMatch, feedMeta, feedProgress, type FeedFilter } from "@/lbm-bro/lib/order-feed";
import { useDemo } from "@/lbm-bro/lib/store";

function activeLabel(n: number) {
  if (n === 0) return "Нет активных";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} активная`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} активные`;
  return `${n} активных`;
}

/**
 * Superapp home (lbm-bro visual).
 * Modules without domain → DesignerStub (do not pretend they work).
 */
export function ClientHome() {
  const { orders, chatBadge, beginNewCalculation } = useDemo();
  const [markOpen, setMarkOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const activeCount = orders.filter((o) => o.status !== "done").length;
  const feed = useMemo(
    () => orders.filter((o) => feedMatch(o, feedFilter)),
    [orders, feedFilter],
  );
  const feedPreview = feed.slice(0, 5);

  return (
    <div className="go-dash">
      <div className="go-greet">
        <div className="go-greet-copy">
          <span className="go-kicker">Кабинет клиента · UI lab</span>
          <h2>Что сделаем?</h2>
          <p>Выберите модуль — как в суперприложении</p>
        </div>

        <div className="go-quick-wrap">
          <div className="go-quick">
            <Link href="/client/chat?open=support" className="go-quick-btn consult">
              <span className="gq-ico"><Icon name="message" /></span>
              <span className="gq-txt">
                <strong>Консультация</strong>
                <span>Ответ за 15 минут</span>
              </span>
              <span className="gq-go" aria-hidden>›</span>
            </Link>
            <button
              type="button"
              className={`go-quick-btn mark${markOpen ? " on" : ""}`}
              onClick={() => setMarkOpen((v) => !v)}
              aria-expanded={markOpen}
            >
              <span className="gq-ico cz" aria-hidden>ЧЗ</span>
              <span className="gq-txt">
                <strong>Честный знак</strong>
                <span>Маркировка в заявке</span>
              </span>
              <span className="gq-go" aria-hidden>›</span>
            </button>
          </div>
          {markOpen ? (
            <DesignerStub
              title="Честный знак"
              intent="Дизайнер заложил модуль маркировки: для одежды/обуви брокер отмечает необходимость ЧЗ в заявке и сверяет коды по документам — отдельная плитка на главной, не deep-link в ТН ВЭД."
              gap="В domain taurus модуля «Честный знак» нет. На ibm-cargo — только визуал и описание замысла."
              compact
            />
          ) : null}
        </div>
      </div>

      <DesignerStub
        title="Тарифная воронка «1-й код бесплатно»"
        intent="Дизайнер: первый просмотр/просчёт одной позиции — 0 ₽, дальше пакеты Код / Таможня / Под ключ и апгрейд с карточки заявки."
        gap="В taurus тарифы EXPRESS/STANDARD/PRO (D10), freemium-гейта нет. Копирайт плитки ниже — визуальный, оплата пойдёт через domain позже."
        compact
      />

      <div className="go-grid">
        <Link href="/client/new" className="go-tile hero" onClick={() => beginNewCalculation()}>
          <span className="gt-kicker">Визуал · ТН ВЭД ЕАЭС</span>
          <div className="gt-title">Определение кода ТН ВЭД ЕАЭС</div>
          <div className="gt-sub">Экран мастера как у дизайнера. Создание в БД — через /cabinet, пока wizard на demo-store.</div>
          <div className="gt-cta">Открыть мастер <span>›</span></div>
          <div className="gt-art art-calc" aria-hidden>
            <div className="ring" />
            <div className="box" />
            <div className="chip">AI</div>
          </div>
        </Link>

        <Link href="/client/orders" className="go-tile orders">
          <div className="gt-ico"><Icon name="list" /></div>
          <div className="gt-title">Мои заявки</div>
          <div className="gt-sub">{activeLabel(activeCount)} · демо-лента</div>
          <div className="gt-art art-orders" aria-hidden>
            <div className="stack"><div className="p" /><div className="p" /><div className="p" /></div>
          </div>
        </Link>

        <Link href="/client/chat" className="go-tile chats">
          {chatBadge > 0 ? <div className="gt-badge">{chatBadge}</div> : null}
          <div className="gt-ico"><Icon name="message" /></div>
          <div className="gt-title">Чаты</div>
          <div className="gt-sub">UI чата · голос = stub</div>
          <div className="gt-art art-chat" aria-hidden>
            <div className="bub b1" />
            <div className="bub b2" />
          </div>
        </Link>

        <Link href="/client/faq" className="go-tile faq">
          <div className="gt-ico"><Icon name="file" /></div>
          <div className="gt-title">FAQ</div>
          <div className="gt-sub">Частые вопросы</div>
          <div className="gt-art art-faq" aria-hidden><div className="q">?</div></div>
        </Link>

        <Link href="/client/guide" className="go-tile guide">
          <div className="gt-ico"><Icon name="cpu" /></div>
          <div className="gt-title">Как пользоваться</div>
          <div className="gt-sub">За 4 шага</div>
          <div className="gt-art art-guide" aria-hidden>
            <div className="steps"><div className="s" /><div className="s" /><div className="s" /></div>
          </div>
        </Link>
      </div>

      <Link href="/client/tnved" className="go-tile lookup">
        <span className="gt-kicker">Справочник · визуал</span>
        <div className="gt-title">Справочник ТН ВЭД</div>
        <div className="gt-sub">Дизайнер: первый просмотр бесплатно. Domain: платный/сессионный поиск без freemium.</div>
        <div className="gt-more">Открыть <span>›</span></div>
        <div className="gt-art art-lookup" aria-hidden>
          <div className="code">8471</div>
        </div>
      </Link>

      <div className="go-feed solo">
        <div>
          <div className="go-sec-label">
            <span>В работе</span>
            <Link href="/client/orders">Все ›</Link>
          </div>
          <div className="filter-chips">
            {FEED_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={feedFilter === f.id ? "on" : ""}
                onClick={() => setFeedFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="go-feed-list">
            {feedPreview.length ? feedPreview.map((o) => (
              <Link key={o.id} href={`/client/orders/${o.id}`} className="go-active">
                <div className="ga-art">
                  <OrderCover src={pickOrderCover(o)} />
                </div>
                <div>
                  <strong>{o.title}</strong>
                  <div className="ga-meta">{feedMeta(o)}</div>
                  {o.status !== "done" ? (
                    <div className="ga-progress" aria-hidden>
                      <i style={{ width: `${feedProgress(o.status)}%`, animation: "none" }} />
                    </div>
                  ) : null}
                </div>
                {o.status === "done" && o.hs && o.hs !== "—" ? (
                  <div className="ga-hs">{o.hs}</div>
                ) : null}
                <div className="ga-arrow">›</div>
              </Link>
            )) : (
              <p className="go-feed-empty">В этом фильтре пока нет просчётов.</p>
            )}
            {feed.length > 5 ? (
              <Link href="/client/orders" className="btn btn-ghost go-feed-more">
                Показать все
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="go-svc-wrap">
        <div className="go-sec-label">
          <span>Сопровождение груза</span>
        </div>
        <DesignerStub
          title="Блок сопровождения на главной"
          intent="Дизайнер вынес перевозку, таможенное оформление и «брокер под ключ» как отдельные сервисы суперприложения — рядом с ТН ВЭД, а не спрятанные в меню."
          gap="Перевозка в taurus — domain есть, клиентский UI default off (D27). ТО «под ключ» как отдельный продукт — нет. Брокер QC — есть через pay→queue."
          compact
        />
        <div className="go-svc">
          <Link href="/client/ship" className="go-tile svc ship is-stub">
            <div className="gt-ico"><Icon name="truck" /></div>
            <div className="gt-title">Грузоперевозки</div>
            <div className="gt-sub">Только наземная доставка · фуры · Китай, Турция, ЕС → РФ</div>
            <div className="gt-more">Макет <span>›</span></div>
            <div className="gt-art art-ship" aria-hidden>
              <div className="cab" /><div className="trail" />
            </div>
          </Link>
          <Link href="/client/clearance" className="go-tile svc clear is-stub">
            <div className="gt-ico"><Icon name="shield" /></div>
            <div className="gt-title">Таможенное оформление</div>
            <div className="gt-sub">Декларация, платежи и выпуск груза</div>
            <div className="gt-more">Макет <span>›</span></div>
            <div className="gt-art art-clear" aria-hidden>
              <div className="stamp">ТО</div>
            </div>
          </Link>
          <Link href="/client/brokers" className="go-tile svc turnkey">
            <div className="gt-ico"><Icon name="users" /></div>
            <div className="gt-title">Брокер под ключ</div>
            <div className="gt-sub">UI выбора · domain = очередь после оплаты</div>
            <div className="gt-more">Открыть <span>›</span></div>
            <div className="gt-art art-turn" aria-hidden>
              <div className="p1" /><div className="p2" />
            </div>
          </Link>
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
        Рабочий функционал без смены визуала:{" "}
        <Link href="/cabinet" style={{ color: "var(--blue)", fontWeight: 700 }}>
          /cabinet
        </Link>
        . План: docs/plan-lbm-bro-skin.md
      </p>
    </div>
  );
}
