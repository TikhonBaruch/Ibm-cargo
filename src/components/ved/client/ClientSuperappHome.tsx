"use client";

import Link from "next/link";
import { Icon } from "@/lbm-bro/components/icon";
import type { Calc } from "./types";

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
  const activeCount = calcs.filter((c) => !["DONE", "CANCELLED"].includes(c.status)).length;
  const feed = calcs.filter((c) => !["DONE", "CANCELLED"].includes(c.status)).slice(0, 5);

  return (
    <div className="go-dash">
      <div className="go-greet">
        <div className="go-greet-copy">
          <span className="go-kicker">Кабинет клиента</span>
          <h2>Что сделаем?</h2>
          <p>ТН ВЭД → брокер-QC → PDF. Модули без domain подписаны отдельно.</p>
        </div>
      </div>

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
          <div className="gt-title">Поддержка</div>
          <div className="gt-sub">{unreadCount > 0 ? `${unreadCount} без ответа` : "FAQ и обращения"}</div>
          <div className="gt-art art-chat" aria-hidden>
            <div className="bub b1" />
            <div className="bub b2" />
          </div>
        </Link>
      </div>

      <Link href={path("/new")} className="go-tile lookup">
        <span className="gt-kicker">Справочник</span>
        <div className="gt-title">Поиск кода ТН ВЭД</div>
        <div className="gt-sub">Combobox справочника на форме нового просчёта — не бесплатный peek.</div>
        <div className="gt-more">
          Открыть <span>›</span>
        </div>
        <div className="gt-art art-lookup" aria-hidden>
          <div className="code">8471</div>
        </div>
      </Link>

      {feed.length ? (
        <div className="go-feed solo">
          <div>
            <div className="go-sec-label">
              <span>В работе</span>
              <Link href={path("/orders")}>Все ›</Link>
            </div>
            <div className="go-feed-list">
              {feed.map((c) => (
                <Link key={c.id} href={`${path("/orders")}?id=${encodeURIComponent(c.id)}`} className="go-active">
                  <div>
                    <strong>{c.title}</strong>
                    <div className="ga-meta">
                      {c.number} · {c.status}
                      {c.hsCodeFinal || c.hsCode ? ` · ${c.hsCodeFinal || c.hsCode}` : ""}
                    </div>
                  </div>
                  <div className="ga-arrow">›</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="go-svc-wrap">
        <div className="go-sec-label">
          <span>Ещё в кабинете</span>
        </div>
        <div className="go-svc">
          <Link href={path("/brokers")} className="go-tile svc turnkey">
            <div className="gt-ico">
              <Icon name="users" />
            </div>
            <div className="gt-title">Брокеры</div>
            <div className="gt-sub">Предпочтительный эксперт · очередь после оплаты</div>
            <div className="gt-more">
              Открыть <span>›</span>
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
          {showShipping ? (
            <Link href={path("/shipping")} className="go-tile svc ship">
              <div className="gt-ico">
                <Icon name="truck" />
              </div>
              <div className="gt-title">Перевозка</div>
              <div className="gt-sub">После статуса DONE</div>
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
