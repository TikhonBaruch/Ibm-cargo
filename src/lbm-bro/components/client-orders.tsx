"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/lbm-bro/components/icon";
import { OrderCover } from "@/lbm-bro/components/order-cover";
import { pickOrderCover } from "@/lbm-bro/lib/docs";
import { FEED_FILTERS, feedMatch, type FeedFilter } from "@/lbm-bro/lib/order-feed";
import { tariffShowsRoute } from "@/lbm-bro/lib/tariffs";
import { useDemo } from "@/lbm-bro/lib/store";

export function ClientOrders() {
  const { orders, beginNewCalculation } = useDemo();
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string>("");
  const router = useRouter();

  const nq = q.trim().toLowerCase();
  const list = orders.filter((o) => {
    if (!feedMatch(o, filter)) return false;
    if (!nq) return true;
    return [
      o.id,
      o.title,
      o.route,
      o.broker,
      o.hs,
      o.status,
      ...o.docs.map((d) => d.name),
    ].join(" ").toLowerCase().includes(nq);
  });

  function nextStep(o: (typeof orders)[number]) {
    return o.status === "draft"
      ? "Продолжить просчёт"
      : o.status === "pay"
        ? "Оплатить тариф — затем код"
        : o.status === "ai"
          ? "Код есть · рассчитать стоимость и налоги"
          : o.status === "ready"
            ? "Скачать, поделиться или отправить брокеру"
            : o.status === "broker"
              ? "Ожидайте брокера · можно чат"
              : "PDF готов · скачать и отправить на таможню";
  }

  function hsLabel(o: (typeof orders)[number]) {
    if (o.status === "pay" || o.status === "draft") return "после оплаты";
    return o.hs && o.hs !== "—" ? o.hs : "—";
  }

  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Заявки на просчёт</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Карточки вместо таблицы — откройте любую, чтобы увидеть код, платежи и чат</p>
        </div>
        <Link href="/client/new" className="btn btn-primary btn-sm" onClick={() => beginNewCalculation()}><Icon name="plus" /> Создать</Link>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ flex: 1, minWidth: 260 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
            Поиск по №, товару, брокеру, HS и документам
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Например: #47880, ноутбуки, Invoice..."
            style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1.5px solid var(--line)", background: "#fff", outline: "none" }}
          />
        </label>
        {q ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQ("")}>
            Сбросить
          </button>
        ) : null}
      </div>

      <div className="filter-chips">
        {FEED_FILTERS.map((f) => (
          <button key={f.id} type="button" className={filter === f.id ? "on" : ""} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>
      <div className="cl-order-grid">
        {list.length ? list.map((o) => (
          <div
            key={o.id}
            className="cl-order"
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/client/orders/${o.id}`)}
            onKeyDown={(e) => { if (e.key === "Enter") router.push(`/client/orders/${o.id}`); }}
          >
            <div className="ph"><OrderCover src={pickOrderCover(o)} /></div>
            <div>
              <h4>{o.title}</h4>
              <div className="meta">
                #{o.id}
                {tariffShowsRoute(o.tariff) && o.route ? ` · ${o.route}` : o.country ? ` · ${o.country}` : ""}
                {" · "}брокер {o.broker}
              </div>
              <div className="meta">
                HS: {hsLabel(o)} · документы: {o.docs?.length || 0}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="meta" style={{ marginTop: 0 }}><b>{nextStep(o)}</b></span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.stopPropagation(); setOpenId((cur) => cur === o.id ? "" : o.id); }}
                >
                  {openId === o.id ? "Свернуть" : "Подробнее"}
                </button>
              </div>
              {openId === o.id ? (
                <div style={{ marginTop: 12 }}>
                  <div className="meta" style={{ marginTop: 0 }}>
                    Документы (демо): {o.docs?.slice(0, 4).map((d) => d.name).join(", ") || "нет"}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="right">
              <span className={`pill ${o.pillClass}`}>{o.pill}</span>
              <div className="sum">{o.sum}</div>
            </div>
          </div>
        )) : <p style={{ color: "var(--muted)" }}>Нет заявок в этом фильтре. Создайте первый просчёт.</p>}
      </div>
    </>
  );
}
