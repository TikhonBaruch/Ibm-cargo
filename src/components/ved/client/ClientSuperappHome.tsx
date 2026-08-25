"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/lbm-bro/components/icon";
import { OrderCover } from "@/lbm-bro/components/order-cover";
import { DesignerStub } from "@/lbm-bro/components/designer-stub";
import type { Calc } from "./types";
import { calcThumb } from "./types";
import {
  LIVE_FEED_FILTERS,
  liveFeedMatch,
  liveFeedMeta,
  liveFeedProgress,
  type LiveFeedFilter,
} from "../lbm-pane-visual";

function activeLabel(n: number) {
  if (n === 0) return "Нет активных";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} активная`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} активные`;
  return `${n} активных`;
}

export function ClientSuperappHome({
  path,
  calcs,
  unreadCount,
  showShipping,
  showFactory,
  factoryHref,
}: {
  path: (suffix: string) => string;
  calcs: Calc[];
  unreadCount: number;
  showShipping: boolean;
  showFactory: boolean;
  factoryHref?: string;
}) {
  const [markOpen, setMarkOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState<LiveFeedFilter>("all");
  const activeCount = calcs.filter((c) => !["DONE", "CANCELLED"].includes(c.status)).length;
  const feed = useMemo(
    () => calcs.filter((c) => liveFeedMatch(c, feedFilter)),
    [calcs, feedFilter],
  );
  const feedPreview = feed.slice(0, 5);

  return (
    <div className="go-dash">
      <div className="go-greet">
        <div className="go-greet-copy">
          <span className="go-kicker">Кабинет клиента</span>
          <h2>Что сделаем?</h2>
          <p>ТН ВЭД → брокер-QC → PDF. Выберите модуль — как в суперприложении</p>
        </div>

        <div className="go-quick-wrap">
          <div className="go-quick">
            <Link href={`${path("/support")}?open=support`} className="go-quick-btn consult">
              <span className="gq-ico">
                <Icon name="message" />
              </span>
              <span className="gq-txt">
                <strong>Консультация</strong>
                <span>FAQ и обращения</span>
              </span>
              <span className="gq-go" aria-hidden>
                ›
              </span>
            </Link>
            <button
              type="button"
              className={`go-quick-btn mark${markOpen ? " on" : ""}`}
              onClick={() => setMarkOpen((v) => !v)}
              aria-expanded={markOpen}
            >
              <span className="gq-ico cz" aria-hidden>
                ЧЗ
              </span>
              <span className="gq-txt">
                <strong>Честный знак</strong>
                <span>Маркировка в заявке</span>
              </span>
              <span className="gq-go" aria-hidden>
                ›
              </span>
            </button>
          </div>
          {markOpen ? (
            <DesignerStub
              title="Честный знак"
              intent="Дизайнер заложил модуль маркировки: для одежды/обуви брокер отмечает необходимость ЧЗ в заявке и сверяет коды по документам — отдельная плитка на главной."
              gap="В domain LBM модуля «Честный знак» нет (D27). Только визуал и описание замысла."
              compact
            />
          ) : null}
        </div>
      </div>

      <DesignerStub
        title="Тарифная воронка «1-й код бесплатно»"
        intent="Дизайнер: первый просмотр/просчёт одной позиции — 0 ₽, дальше пакеты Код / Таможня / Под ключ."
        gap="В LBM тарифы EXPRESS / STANDARD / PRO (D10), freemium-гейта нет. Оплата с баланса, брокер — после оплаты (D11)."
        compact
      />

      <div className="go-grid">
        <Link href={path("/new")} className="go-tile hero">
          <span className="gt-kicker">ТН ВЭД ЕАЭС</span>
          <div className="gt-title">Определение кода ТН ВЭД ЕАЭС</div>
          <div className="gt-sub">Опишите товар — heuristic подготовит черновик, брокер подтвердит после оплаты.</div>
          <div className="gt-cta">
            Новый просчёт <span>›</span>
          </div>
          <div className="gt-art art-calc" aria-hidden>
            <div className="ring" />
            <div className="box" />
            <div className="chip">HS</div>
          </div>
        </Link>

        <Link href={path("/orders")} className="go-tile orders">
          <div className="gt-ico">
            <Icon name="list" />
          </div>
          <div className="gt-title">Мои заявки</div>
          <div className="gt-sub">{activeLabel(activeCount)}</div>
          <div className="gt-art art-orders" aria-hidden>
            <div className="stack">
              <div className="p" />
              <div className="p" />
              <div className="p" />
            </div>
          </div>
        </Link>

        <Link href={path("/support")} className="go-tile chats">
          {unreadCount > 0 ? <div className="gt-badge">{unreadCount}</div> : null}
          <div className="gt-ico">
            <Icon name="message" />
          </div>
          <div className="gt-title">Чаты</div>
          <div className="gt-sub">{unreadCount > 0 ? `${unreadCount} без ответа` : "Поддержка и брокер по заявке"}</div>
          <div className="gt-art art-chat" aria-hidden>
            <div className="bub b1" />
            <div className="bub b2" />
          </div>
        </Link>

        <Link href={path("/faq")} className="go-tile faq">
          <div className="gt-ico">
            <Icon name="file" />
          </div>
          <div className="gt-title">FAQ</div>
          <div className="gt-sub">Частые вопросы</div>
          <div className="gt-art art-faq" aria-hidden>
            <div className="q">?</div>
          </div>
        </Link>

        <Link href={path("/guide")} className="go-tile guide">
          <div className="gt-ico">
            <Icon name="cpu" />
          </div>
          <div className="gt-title">Как пользоваться</div>
          <div className="gt-sub">За 4 шага</div>
          <div className="gt-art art-guide" aria-hidden>
            <div className="steps">
              <div className="s" />
              <div className="s" />
              <div className="s" />
            </div>
          </div>
        </Link>
      </div>

      <Link href={path("/tnved")} className="go-tile lookup">
        <span className="gt-kicker">Справочник</span>
        <div className="gt-title">Справочник ТН ВЭД</div>
        <div className="gt-sub">Живой поиск `/api/v1/tnved/search`. Freemium peek макета — stub.</div>
        <div className="gt-more">
          Открыть <span>›</span>
        </div>
        <div className="gt-art art-lookup" aria-hidden>
          <div className="code">8471</div>
        </div>
      </Link>

      <div className="go-feed solo">
        <div>
          <div className="go-sec-label">
            <span>В работе</span>
            <Link href={path("/orders")}>Все ›</Link>
          </div>
          <div className="filter-chips">
            {LIVE_FEED_FILTERS.map((f) => (
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
            {feedPreview.length ? (
              feedPreview.map((c, i) => (
                <Link
                  key={c.id}
                  href={`${path("/orders")}?id=${encodeURIComponent(c.id)}`}
                  className="go-active"
                >
                  <div className="ga-art">
                    <OrderCover src={calcThumb(c, i)} />
                  </div>
                  <div>
                    <strong>{c.title}</strong>
                    <div className="ga-meta">{liveFeedMeta(c)}</div>
                    {c.status !== "DONE" ? (
                      <div className="ga-progress" aria-hidden>
                        <i style={{ width: `${liveFeedProgress(c.status)}%`, animation: "none" }} />
                      </div>
                    ) : null}
                  </div>
                  {c.status === "DONE" && (c.hsCodeFinal || c.hsCode) ? (
                    <div className="ga-hs">{c.hsCodeFinal || c.hsCode}</div>
                  ) : null}
                  <div className="ga-arrow">›</div>
                </Link>
              ))
            ) : (
              <p className="go-feed-empty">В этом фильтре пока нет просчётов.</p>
            )}
            {feed.length > 5 ? (
              <Link href={path("/orders")} className="btn btn-ghost go-feed-more">
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
          gap="Перевозка в LBM — domain есть, клиентский UI default off (D27). ТО как отдельный продукт — нет. Брокер QC — через pay→queue."
          compact
        />
        <div className="go-svc">
          <Link
            href={path("/shipping")}
            className={`go-tile svc ship${showShipping ? "" : " is-stub"}`}
          >
            <div className="gt-ico">
              <Icon name="truck" />
            </div>
            <div className="gt-title">Грузоперевозки</div>
            <div className="gt-sub">
              {showShipping ? "После статуса DONE · котировки" : "Макет · клиентский UI default off (D27)"}
            </div>
            <div className="gt-more">
              {showShipping ? "Открыть" : "Макет"} <span>›</span>
            </div>
            <div className="gt-art art-ship" aria-hidden>
              <div className="cab" />
              <div className="trail" />
            </div>
          </Link>
          <Link href={path("/clearance")} className="go-tile svc clear is-stub">
            <div className="gt-ico">
              <Icon name="shield" />
            </div>
            <div className="gt-title">Таможенное оформление</div>
            <div className="gt-sub">Декларация, платежи и выпуск груза</div>
            <div className="gt-more">
              Макет <span>›</span>
            </div>
            <div className="gt-art art-clear" aria-hidden>
              <div className="stamp">ТО</div>
            </div>
          </Link>
          <Link href={path("/brokers")} className="go-tile svc turnkey">
            <div className="gt-ico">
              <Icon name="users" />
            </div>
            <div className="gt-title">Брокер под ключ</div>
            <div className="gt-sub">Preferred-эксперт · очередь после оплаты</div>
            <div className="gt-more">
              Открыть <span>›</span>
            </div>
            <div className="gt-art art-turn" aria-hidden>
              <div className="p1" />
              <div className="p2" />
            </div>
          </Link>
          {showFactory && factoryHref ? (
            <Link href={factoryHref} className="go-tile svc clear">
              <div className="gt-ico">
                <Icon name="box" />
              </div>
              <div className="gt-title">Производитель</div>
              <div className="gt-sub">Сборный заказ и каталог SKU</div>
              <div className="gt-more">
                Открыть <span>›</span>
              </div>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
