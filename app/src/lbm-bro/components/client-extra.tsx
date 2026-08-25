"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lbm-bro/components/icon";
import { OrderCover } from "@/lbm-bro/components/order-cover";
import { pickOrderCover } from "@/lbm-bro/lib/docs";
import { PayMath } from "@/lbm-bro/components/pay-math";
import { VoiceBubble, formatVoiceTime, pickAudioMime } from "@/lbm-bro/components/voice-message";
import { fmt } from "@/lbm-bro/lib/format";
import { historyDelta, ledgerSums } from "@/lbm-bro/lib/ledger";
import { useDemo } from "@/lbm-bro/lib/store";

export function ClientFaq() {
  const [open, setOpen] = useState(0);
  const items = [
    ["Чем отличаются тарифы просчёта кода?", "«Старт» — 1 позиция, первый просчёт бесплатно, дальше 990 ₽. «Стандарт» — мульти до 20 позиций за 3 990 ₽. «Профи» — мульти до 100 позиций за 6 990 ₽. Таможню считаем отдельно, после кода."],
    ["Когда я вижу код ТН ВЭД?", "Одну позицию можно прочитать бесплатно один раз — в справочнике или в заявке. Повторное чтение уже после оплаты. Мультипозиция всегда платная."],
    ["Когда считают пошлину и НДС?", "В тарифах «Таможня» и «Под ключ» — отдельной формой после кода. В тарифе «Код» этого шага нет."],
    ["Как работает мультипозиция?", "Выберите режим «Мультипозиция» и прикрепите invoice, CSV, Excel или фото. Система читает строки с документа: название, количество и цену. Затем после оплаты проставит код каждой строке."],
  ];
  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>FAQ</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Коротко про расчёт, брокера и документы</p>
        </div>
        <Link href="/client" className="btn btn-ghost btn-sm">На главную</Link>
      </div>
      {items.map(([q, a], i) => (
        <div key={q} className={`faq-item${open === i ? " open" : ""}`}>
          <button type="button" className="q" onClick={() => setOpen(open === i ? -1 : i)}>{q} <span>▾</span></button>
          <div className="a">{a}</div>
        </div>
      ))}
    </>
  );
}

export function ClientGuide() {
  const [active, setActive] = useState(0);
  const steps = [
    {
      t: "Можно сначала прочитать код",
      d: "Одну позицию — бесплатно один раз. Повтор уже платный.",
      detail: "Первый просмотр кода в справочнике или заявке бесплатный. Следующий раз код открывается после оплаты. Мультипозицию так не читают.",
      href: "/client/tnved",
      btn: "Открыть справочник",
    },
    {
      t: "Оплатите — получите код",
      d: "Одна позиция или мультипозиция из файла. Читаем реальные строки с CSV, Excel, PDF и фото.",
      detail: "После оплаты AI показывает код. Таможню — пошлину и НДС — считаем отдельно, когда коды уже есть.",
      href: "/client/new",
      btn: "К оплате в просчёте",
    },
    {
      t: "Таможенный расчёт",
      d: "В «Таможне» и «Под ключ»: инвойс, вес → пошлина и НДС.",
      detail: "Форма платежей появляется только если тариф её включает. В пакете «Код» этого шага нет.",
      href: "/client/orders",
      btn: "К моим заявкам",
    },
    {
      t: "Файл или брокер",
      d: "Скачайте PDF. Брокер — только в «Под ключ».",
      detail: "«Передать брокеру» есть в пакете «Под ключ». В остальных тарифах эксперт не включён.",
      href: "/client/orders",
      btn: "Открыть заявки",
    },
  ] as const;

  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Как пользоваться</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Код · Таможня · Под ключ</p>
        </div>
        <Link href="/client/new" className="btn btn-primary btn-sm">Начать</Link>
      </div>

      <div className="two" style={{ alignItems: "start" }}>
        <div>
          {steps.map((s, i) => (
            <div
              key={s.t}
              className="guide-step"
              role="button"
              tabIndex={0}
              onClick={() => setActive(i)}
              onKeyDown={(e) => { if (e.key === "Enter") setActive(i); }}
              style={{
                cursor: "pointer",
                borderColor: active === i ? "rgba(43,114,244,.55)" : undefined,
                boxShadow: active === i ? "0 12px 28px rgba(43,114,244,.14)" : undefined,
              }}
            >
              <div className="n">{i + 1}</div>
              <div><strong>{s.t}</strong><p className="meta">{s.d}</p></div>
            </div>
          ))}
        </div>

        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: 10 }}>{steps[active].t}</h3>
          <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14, lineHeight: 1.55 }}>
            {steps[active].detail}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <Link href={steps[active].href} className="btn btn-primary btn-sm">{steps[active].btn}</Link>
            <Link href="/client/chat" className="btn btn-ghost btn-sm">Если вопросы — в чат</Link>
          </div>
        </div>
      </div>
    </>
  );
}

export function ClientBrokers() {
  const { assignBroker, showToast, currentOrderId, orders } = useDemo();
  const [on, setOn] = useState("Иванов");
  const order = orders.find((o) => o.id === currentOrderId);
  const [pkg, setPkg] = useState({
    code: true,
    docs: true,
    release: true,
  });
  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Брокеры</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Назначьте специалиста на активную заявку или напишите в чат</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 10 }}>Брокер под ключ — что вы получаете</h3>
        <p className="meta" style={{ marginTop: 0, marginBottom: 12 }}>
          Эксперт берёт вашу заявку в работу и доводит до результата: сверка кода ТН ВЭД, проверка документов и сопровождение до выпуска (в демо — до статусов/подготовки PDF).
        </p>

        <div className="set-row">
          <div>
            <strong>Проверка ТН ВЭД</strong>
            <div className="meta">Сверяем код и риски по материалам из заявки</div>
          </div>
          <button
            type="button"
            className={`switch${pkg.code ? " on" : ""}`}
            onClick={() => setPkg((p) => ({ ...p, code: !p.code }))}
            aria-label="Тумблер: проверка ТН ВЭД"
          >
            <i />
          </button>
        </div>
        <div className="set-row">
          <div>
            <strong>Проверка документов</strong>
            <div className="meta">Инвойсы/пэкинг-листы/фото — чтобы всё было готово для декларации</div>
          </div>
          <button
            type="button"
            className={`switch${pkg.docs ? " on" : ""}`}
            onClick={() => setPkg((p) => ({ ...p, docs: !p.docs }))}
            aria-label="Тумблер: проверка документов"
          >
            <i />
          </button>
        </div>
        <div className="set-row">
          <div>
            <strong>Сопровождение до выпуска</strong>
            <div className="meta">Актуализация данных и согласование следующего шага</div>
          </div>
          <button
            type="button"
            className={`switch${pkg.release ? " on" : ""}`}
            onClick={() => setPkg((p) => ({ ...p, release: !p.release }))}
            aria-label="Тумблер: сопровождение до выпуска"
          >
            <i />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => showToast(`Пакет под ключ настроен (демо)`)}
          >
            Подтвердить пакет
          </button>
          {order ? (
            <span className="meta" style={{ alignSelf: "center" }}>
              Назначение на заявку <b>#{order.id}</b> · {order.title}
            </span>
          ) : (
            <span className="meta" style={{ alignSelf: "center" }}>Выберите активную заявку в «Моих заявках»</span>
          )}
        </div>
      </div>

      <div className="three">
        <article className={`cl-broker-card${on === "Иванов" ? " on" : ""}`}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="photo" style={{ width: 56, height: 56, borderRadius: 16, overflow: "hidden" }}><img src="/lbm-bro/assets/avatar-broker.svg" alt="" /></div>
            <div><strong>Алексей Иванов</strong><div className="stars">★★★★★ 4.9</div><span className="pill ok" style={{ marginTop: 6 }}>Онлайн</span></div>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Электроника, Китай / ЕАЭС · 2 ваши заявки</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/client/chat" className="btn btn-primary btn-sm" onClick={() => showToast("Чат с Ивановым")}>Написать</Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOn("Иванов"); assignBroker("Иванов"); }}>Назначить на #{currentOrderId}</button>
          </div>
        </article>
        <article className={`cl-broker-card${on === "Петрова" ? " on" : ""}`}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="photo" style={{ width: 56, height: 56, borderRadius: 16, overflow: "hidden" }}><img src="/lbm-bro/assets/avatar-support.svg" alt="" /></div>
            <div><strong>Мария Петрова</strong><div className="stars">★★★★★ 4.8</div><span className="pill blue" style={{ marginTop: 6 }}>Свободна</span></div>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Текстиль и сертификация · ответ ~38 мин</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOn("Петрова"); assignBroker("Петрова"); }}>Назначить</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast("Профиль Петровой")}>Профиль</button>
          </div>
        </article>
        <article className="cl-broker-card">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="photo" style={{ width: 56, height: 56, borderRadius: 16, overflow: "hidden" }}><img src="/lbm-bro/assets/avatar-user.svg" alt="" /></div>
            <div><strong>Дмитрий Ким</strong><div className="stars">★★★★☆ 4.7</div><span className="pill muted" style={{ marginTop: 6 }}>Занят</span></div>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Сложная электроника · Корея / Китай</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast("Заявка в очередь к Киму")}>Встать в очередь</button>
        </article>
      </div>
    </>
  );
}

const SHIPS = [
  { name: "Сборная фура (LTL)", eta: "7–12 дней", sum: "149 000 ₽", img: "/lbm-bro/assets/ship-cover.svg" },
  { name: "Рейсовая фура (FTL)", eta: "5–9 дней", sum: "210 000 ₽", img: "/lbm-bro/assets/ship-cover.svg" },
];

export function ClientShip() {
  const { showToast, orders, currentOrderId } = useDemo();
  const [i, setI] = useState(0);
  const s = SHIPS[i];
  const [orderOverride, setOrderOverride] = useState<string | null>(null);
  const orderId = orderOverride ?? currentOrderId;

  const order = orders.find((o) => o.id === orderId);
  const orderStatusLabel =
    order?.status === "draft" ? "черновик" :
    order?.status === "pay" ? "оплата" :
    order?.status === "ai" ? "код готов" :
    order?.status === "ready" ? "платежи готовы" :
    order?.status === "broker" ? "в работе" :
    order?.status === "done" ? "готово" :
    "—";

  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Заказать перевозку</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Выберите способ — ориентир по цене обновится сразу</p>
        </div>
      </div>
      <div className="two" style={{ marginBottom: 14 }}>
        {SHIPS.map((opt, idx) => (
          <button key={opt.name} type="button" className={`ship-opt${i === idx ? " on" : ""}`} onClick={() => { setI(idx); showToast(`Выбран ${opt.name}`); }}>
            <div className="ph"><img src={opt.img} alt="" /></div>
            <strong>{opt.name}</strong>
            <span className="meta">{opt.eta}</span>
            <div className="price">от {opt.sum}</div>
          </button>
        ))}
      </div>
      <div className="two">
        <div className="card">
          <div className="field">
            <label>Связанный просчёт</label>
            <select value={orderId} onChange={(e) => setOrderOverride(e.target.value)}>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} · {o.title} · {o.status === "draft" ? "черновик" : o.status === "pay" ? "оплата" : o.status === "ai" ? "код готов" : o.status === "ready" ? "платежи готовы" : o.status === "broker" ? "в работе" : "готово"}
                </option>
              ))}
            </select>
          </div>
          <div className="field"><label>Откуда</label><input defaultValue="Шэньчжэнь, Китай" /></div>
          <div className="field"><label>Куда</label><input defaultValue="Москва, склад клиента" /></div>
          <div className="field"><label>Комментарий</label><textarea rows={2} placeholder="Сроки, температурный режим…" /></div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => showToast(`Заявка на ${s.name} отправлена логистам · для #${orderId} (${orderStatusLabel})`)}
            disabled={!orderId}
          >
            Отправить заявку логистам
          </button>
        </div>
        <div className="card">
          <h3>Итого по маршруту</h3>
          <div className="pay-row"><span>Способ</span><strong>{s.name}</strong></div>
          <div className="pay-row"><span>Срок</span><strong>{s.eta}</strong></div>
          <div className="pay-row"><span>Ориентир</span><strong>{s.sum}</strong></div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>Это демо-оценка. Точную ставку подтвердит перевозчик после веса и объёма.</p>
        </div>
      </div>
    </>
  );
}

export function ClientBalance() {
  const { balance, history, topup } = useDemo();
  const [amt, setAmt] = useState(5000);
  const { spent, added } = ledgerSums(history);
  return (
    <>
      <div className="two">
        <div className="cl-wallet">
          <div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Доступно к списанию</div>
            <div className="v">{fmt(balance)} ₽</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.85, gap: 12 }}>
            <span>Пополнено {fmt(added)} ₽</span>
            <span>Списано {fmt(spent)} ₽</span>
          </div>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <h3>Пополнить</h3>
          <div className="amt-chips">
            {[5000, 10000, 25000].map((v) => (
              <button key={v} type="button" className={amt === v ? "on" : ""} onClick={() => setAmt(v)}>{v.toLocaleString("ru-RU")}</button>
            ))}
          </div>
          <div className="field"><label>Сумма, ₽</label><input type="number" value={amt} onChange={(e) => setAmt(Number(e.target.value) || 0)} /></div>
          <div className="field"><label>Способ</label>
            <select><option>Банковская карта</option><option>СБП</option><option>Счёт для юрлица</option></select>
          </div>
          {amt > 0 ? <PayMath balance={balance} amount={amt} credit /> : null}
          <button type="button" className="btn btn-primary" onClick={() => topup(amt)} disabled={amt <= 0} style={{ marginTop: 12 }}>
            Оплатить · на счёте {fmt(balance + Math.max(0, amt))} ₽
          </button>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>История</h3>
        <div className="activity-list">
          {history.map((h, i) => {
            const after = history.slice(0, i).reduce((sum, row) => sum - historyDelta(row), balance);
            return (
              <div key={`${h.title}-${i}`} className="activity-item">
                <div className={`dot ${h.tone}`} />
                <div>
                  <strong>{h.title}</strong>
                  <span>{h.text} · остаток {fmt(after)} ₽</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function orderStatusRu(status: string) {
  if (status === "draft") return "Черновик";
  if (status === "pay") return "Оплата";
  if (status === "ai") return "Код готов";
  if (status === "ready") return "Платежи готовы";
  if (status === "broker") return "В работе";
  if (status === "done") return "Готово";
  return status;
}

export function ClientChat() {
  const { support, sendSupport, brokerChat, sendBrokerChat, orders, currentOrderId, chatBadge, showToast } = useDemo();
  const [text, setText] = useState("");
  const [listQ, setListQ] = useState("");
  const [activeChat, setActiveChat] = useState<{ type: "support" } | { type: "broker"; orderId: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search);
    return q.get("open") === "support" ? { type: "support" } : null;
  });
  const [supportOrderOverride, setSupportOrderOverride] = useState<string | null>(null);
  const supportOrderId = supportOrderOverride ?? currentOrderId;
  const threadRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recStarted = useRef(0);
  const recTick = useRef(0);
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (recTick.current) window.clearInterval(recTick.current);
  }, []);

  const brokerOrders = orders.filter((o) => o.broker && o.broker !== "—");
  const needle = listQ.trim().toLowerCase();
  const visibleBrokers = brokerOrders.filter((o) => {
    if (!needle) return true;
    return `${o.title} ${o.id} ${o.broker}`.toLowerCase().includes(needle);
  });
  const showSupport = !needle || "поддержка платформа lbm".includes(needle);

  const activeOrder = activeChat?.type === "broker"
    ? orders.find((o) => o.id === activeChat.orderId)
    : orders.find((o) => o.id === supportOrderId);

  const msgs = activeChat?.type === "broker" ? brokerChat : support;
  const last = support[support.length - 1];
  const lastSupport = last?.kind === "voice" ? "Голосовое сообщение" : last?.text;

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs.length, activeChat]);

  const quick = activeChat?.type === "support"
    ? [
      `Когда будет PDF по #${supportOrderId}?`,
      "Как пополнить баланс?",
      `Сменить брокера по #${supportOrderId}?`,
    ]
    : activeChat?.type === "broker"
      ? [
        "Нужна правка по документам",
        `Когда PDF по #${activeChat.orderId}?`,
        "Проверьте код и риски",
      ]
      : [];

  function sendQuick(msg: string) {
    if (!activeChat) return;
    if (activeChat.type === "support") sendSupport(msg);
    else sendBrokerChat(msg);
  }

  function send() {
    const msg = text.trim();
    if (!msg || !activeChat) return;
    sendQuick(msg);
    setText("");
  }

  function sendVoice(audioUrl: string, durationSec: number) {
    if (!activeChat) return;
    const payload = { audioUrl, durationSec, text: "Голосовое сообщение" };
    if (activeChat.type === "support") sendSupport(payload);
    else sendBrokerChat(payload);
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (recTick.current) window.clearInterval(recTick.current);
    recTick.current = 0;
  }

  function cancelRec() {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    stopTracks();
    recRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setRecSec(0);
  }

  async function startRec() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showToast("Голосовые сообщения недоступны в этом браузере");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickAudioMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.start(120);
      recStarted.current = Date.now();
      setRecording(true);
      setRecSec(0);
      recTick.current = window.setInterval(() => {
        setRecSec(Math.floor((Date.now() - recStarted.current) / 1000));
      }, 200);
    } catch {
      showToast("Разрешите доступ к микрофону");
    }
  }

  function finishRec() {
    const rec = recRef.current;
    if (!rec) return;
    rec.onstop = () => {
      const durationSec = Math.max(1, Math.round((Date.now() - recStarted.current) / 1000));
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      stopTracks();
      recRef.current = null;
      chunksRef.current = [];
      setRecording(false);
      setRecSec(0);
      if (blob.size < 800 || durationSec < 1) {
        showToast("Слишком коротко — запишите ещё раз");
        return;
      }
      sendVoice(URL.createObjectURL(blob), durationSec);
    };
    if (rec.state !== "inactive") rec.stop();
  }

  const peerName = activeChat?.type === "support" ? "Поддержка LBM" : activeOrder?.broker || "Брокер";
  const peerRole = activeChat?.type === "support" ? "Платформа · ответ за 15 мин" : `По заявке #${activeOrder?.id || ""}`;

  return (
    <div className={`im-shell${activeChat ? " open" : ""}`}>
      <aside className="im-list">
        <div className="im-list-head">
          <div>
            <h3>Диалоги</h3>
            <p>Сначала выберите, кому писать</p>
          </div>
        </div>
        <label className="im-search">
          <Icon name="search" />
          <input
            value={listQ}
            onChange={(e) => setListQ(e.target.value)}
            placeholder="Заявка, товар или брокер"
          />
        </label>

        <div className="im-scroll">
          {showSupport ? (
            <button
              type="button"
              className={`im-row pin${activeChat?.type === "support" ? " on" : ""}`}
              onClick={() => setActiveChat({ type: "support" })}
            >
              <span className="im-ava support"><Icon name="message" /></span>
              <span className="im-row-body">
                <span className="im-row-top">
                  <strong>Поддержка</strong>
                  <em>сейчас</em>
                </span>
                <span className="im-row-sub">{lastSupport || "Всегда на связи по кабинету и оплате"}</span>
              </span>
              {chatBadge > 0 && activeChat?.type !== "support" ? <span className="im-unread">{chatBadge}</span> : null}
            </button>
          ) : null}

          <div className="im-label">Брокеры по заявкам</div>

          {visibleBrokers.length ? (
            visibleBrokers.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`im-row${activeChat?.type === "broker" && activeChat.orderId === o.id ? " on" : ""}`}
                onClick={() => setActiveChat({ type: "broker", orderId: o.id })}
              >
                <span className="im-ava photo"><OrderCover src={pickOrderCover(o)} alt="" /></span>
                <span className="im-row-body">
                  <span className="im-row-top">
                    <strong>{o.broker}</strong>
                    <span className={`pill ${o.pillClass}`}>{o.pill}</span>
                  </span>
                  <span className="im-row-sub">{o.title}</span>
                  <span className="im-row-meta">#{o.id} · {orderStatusRu(o.status)}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="im-empty-hint">
              {brokerOrders.length ? "Ничего не найдено" : "Назначьте брокера на заявку — чат появится здесь"}
            </p>
          )}
        </div>
      </aside>

      <section className="im-thread">
        {!activeChat ? (
          <div className="im-blank">
            <span className="im-ava lg support"><Icon name="message" lg /></span>
            <h3>Кому написать?</h3>
            <p>Поддержка — по кабинету, оплате и срокам. Брокер — только по своей заявке.</p>
            <div className="im-blank-acts">
              <button type="button" className="btn btn-primary" onClick={() => setActiveChat({ type: "support" })}>
                <Icon name="message" /> Открыть поддержку
              </button>
              {brokerOrders[0] ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setActiveChat({ type: "broker", orderId: brokerOrders[0].id })}
                >
                  <Icon name="user" /> Чат с {brokerOrders[0].broker}
                </button>
              ) : (
                <Link href="/client/brokers" className="btn btn-ghost">
                  <Icon name="users" /> Назначить брокера
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <header className="im-head">
              <button type="button" className="im-back" onClick={() => setActiveChat(null)} aria-label="К списку">
                ‹
              </button>
              <span className={`im-ava${activeChat.type === "support" ? " support" : " photo"}`}>
                {activeChat.type === "support"
                  ? <Icon name="message" />
                  : <OrderCover src={pickOrderCover(activeOrder || {})} alt="" />}
              </span>
              <div className="im-head-txt">
                <strong>{peerName}</strong>
                <span><i className="im-dot" /> {peerRole}</span>
              </div>
            </header>

            {activeChat.type === "support" ? (
              <div className="im-ctx">
                <span className="im-ctx-k">Вопрос по заявке</span>
                <div className="im-chips">
                  {orders.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={supportOrderId === o.id ? "on" : ""}
                      onClick={() => setSupportOrderOverride(o.id)}
                    >
                      #{o.id} · {o.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : activeOrder ? (
              <Link href={`/client/orders/${activeOrder.id}`} className="im-order">
                <OrderCover src={pickOrderCover(activeOrder)} alt="" />
                <span>
                  <strong>{activeOrder.title}</strong>
                  <em>#{activeOrder.id} · {activeOrder.hs && activeOrder.hs !== "—" ? `ТН ВЭД ${activeOrder.hs}` : "код позже"} · {activeOrder.docs?.length || 0} док.</em>
                </span>
                <span className="im-order-go">Открыть ›</span>
              </Link>
            ) : null}

            <div className="im-msgs" ref={threadRef}>
              {msgs.map((m, i) => (
                <div key={`${m.from}-${i}`} className={`im-msg${m.from === "me" ? " me" : ""}`}>
                  {m.from !== "me" ? (
                    <span className={`im-ava sm${activeChat.type === "support" ? " support" : " photo"}`}>
                      {activeChat.type === "support" ? <Icon name="message" /> : <OrderCover src={pickOrderCover(activeOrder || {})} alt="" />}
                    </span>
                  ) : null}
                  <div className="im-bubble-wrap">
                    <div className="im-who">{m.from === "me" ? "Вы" : peerName}</div>
                    {m.kind === "voice" ? <VoiceBubble msg={m} mine={m.from === "me"} /> : <div className="im-bubble">{m.text}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="im-compose">
              <div className="im-chips quick">
                {quick.map((item) => (
                  <button key={item} type="button" onClick={() => sendQuick(item)}>{item}</button>
                ))}
              </div>
              {recording ? (
                <div className="im-input rec">
                  <button type="button" className="im-rec-cancel" onClick={cancelRec} aria-label="Отменить запись">×</button>
                  <i className="im-rec-dot" aria-hidden />
                  <span className="im-rec-time">{formatVoiceTime(recSec)}</span>
                  <div className="im-rec-wave" aria-hidden>
                    {Array.from({ length: 14 }, (_, i) => <i key={i} />)}
                  </div>
                  <button type="button" className="im-send" onClick={finishRec} aria-label="Отправить голосовое">
                    <Icon name="send" />
                  </button>
                </div>
              ) : (
                <div className="im-input">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={activeChat.type === "support" ? "Написать в поддержку…" : `Написать брокеру ${peerName}…`}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      send();
                    }}
                  />
                  <button
                    type="button"
                    className="im-mic"
                    onClick={() => void startRec()}
                    aria-label="Голосовое сообщение"
                    title="Записать голосовое"
                  >
                    <Icon name="mic" />
                  </button>
                  <button type="button" className="im-send" onClick={send} disabled={!text.trim()} aria-label="Отправить">
                    <Icon name="send" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function ClientCompany() {
  const { showToast } = useDemo();
  const [sw, setSw] = useState([true, true, false, true]);
  return (
    <div className="two">
      <div className="card" style={{ margin: 0 }}>
        <h3>Профиль компании</h3>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
          <div className="avatar" style={{ width: 72, height: 72 }}><img src="/lbm-bro/assets/avatar-user.svg" alt="" /></div>
          <div><strong>ООО «Импортёр»</strong><div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Иван Михайлов · ВЭД</div></div>
        </div>
        <div className="field"><label>Наименование</label><input defaultValue="ООО «Импортёр»" /></div>
        <div className="field"><label>ИНН / КПП</label><input defaultValue="7701234567 / 770101001" /></div>
        <div className="field"><label>Email</label><input defaultValue="ved@importyor.ru" /></div>
        <div className="field"><label>Телефон</label><input defaultValue="+7 495 000-00-00" /></div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => showToast("Профиль обновлён")}>Сохранить</button>
      </div>
      <div className="card" style={{ margin: 0 }}>
        <h3>Уведомления</h3>
        {[
          ["Статус заявки", "Push при смене этапа"],
          ["PDF на почту", "После утверждения брокером"],
          ["SMS от брокера", "Только срочные сообщения"],
          ["Двухфакторный вход", "SMS-код при входе"],
        ].map(([t, d], i) => (
          <div key={t} className="set-row">
            <div><strong>{t}</strong><div className="meta">{d}</div></div>
            <button type="button" className={`switch${sw[i] ? " on" : ""}`} onClick={() => setSw((s) => s.map((v, j) => j === i ? !v : v))}><i /></button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => showToast("Настройки сохранены")}>Сохранить настройки</button>
      </div>
    </div>
  );
}

export function ClientClearance() {
  const { showToast, orders, currentOrderId } = useDemo();
  const routerOrder = orders.find((o) => o.id === currentOrderId);

  function money(v: string) {
    if (!v || v === "—" || v === "тариф") return v || "—";
    return v.includes("₽") ? v : `${v} ₽`;
  }

  const initChecks = [
    Boolean(routerOrder?.hs && routerOrder.hs !== "—"),
    Boolean(routerOrder?.duty && routerOrder.duty !== "—" && routerOrder?.vat && routerOrder.vat !== "—"),
    routerOrder?.status === "done",
  ];

  const CHECKS = [
    { t: "Код ТН ВЭД", d: "Сверяем AI-черновик и подтверждаем код для декларации." },
    { t: "Платежи", d: "Пошлина, НДС и сборы по партии — в составе заявки." },
    { t: "Выпуск", d: "Пакет документов и сопровождение до выпуска." },
  ] as const;

  const [checks, setChecks] = useState<boolean[]>(initChecks);
  const [checksOrderId, setChecksOrderId] = useState(currentOrderId);
  if (checksOrderId !== currentOrderId) {
    setChecksOrderId(currentOrderId);
    setChecks(initChecks);
  }

  const docScope = `${currentOrderId}:${routerOrder?.docs?.length ?? 0}`;
  const [selectedDocId, setSelectedDocId] = useState<string>(routerOrder?.docs?.[0]?.id || "");
  const [docScopeKey, setDocScopeKey] = useState(docScope);
  if (docScopeKey !== docScope) {
    setDocScopeKey(docScope);
    setSelectedDocId(routerOrder?.docs?.[0]?.id || "");
  }

  const selectedDoc = routerOrder?.docs?.find((d) => d.id === selectedDocId);

  return (
    <>
      <div className="card-head">
        <div>
          <h3 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Таможенное оформление</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Декларация, платежи и выпуск — после кода ТН ВЭД</p>
        </div>
        <Link href="/client/new" className="btn btn-primary btn-sm">Начать с кода</Link>
      </div>

      <div className="two" style={{ marginBottom: 14 }}>
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: 10 }}>Активная заявка</h3>
          {routerOrder ? (
            <>
              <div className="pay-row"><span>№ заявки</span><strong>#{routerOrder.id}</strong></div>
              <div className="pay-row"><span>ТН ВЭД</span><strong>{routerOrder.hs && routerOrder.hs !== "—" ? routerOrder.hs : "—"}</strong></div>
              <div className="pay-row"><span>Документы</span><strong>{routerOrder.docs?.length || 0}</strong></div>
              <div className="pay-row"><span>Риск</span><strong>{routerOrder.risk || "—"}</strong></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <Link href={`/client/orders/${routerOrder.id}`} className="btn btn-ghost btn-sm">Открыть</Link>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => showToast(`Запрос на оформление отправлен · #${routerOrder.id} (демо)`)}
                >
                  Запросить оформление
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="meta" style={{ marginBottom: 12 }}>
                Пока нет активной заявки для оформления. Откройте нужный просчёт в «Мои заявки».
              </p>
              <Link href="/client/orders" className="btn btn-primary btn-sm">К заявкам</Link>
            </>
          )}
        </div>

        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: 10 }}>План оформления</h3>
          {CHECKS.map((c, idx) => {
            const disabled = !routerOrder;
            return (
              <div key={c.t} className="set-row" style={{ opacity: disabled ? 0.7 : 1 }}>
                <div>
                  <strong>{c.t}</strong>
                  <div className="meta">{c.d}</div>
                </div>
                <button
                  type="button"
                  className={`switch${checks[idx] ? " on" : ""}`}
                  aria-label={`Отметить: ${c.t}`}
                  disabled={disabled}
                  onClick={() => setChecks((s) => s.map((v, i) => i === idx ? !v : v))}
                >
                  <i />
                </button>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!routerOrder}
              onClick={() => {
                if (!routerOrder) return;
                setChecks([true, true, true]);
                showToast(`Оформление запущено · #${routerOrder.id} (демо)`);
              }}
            >
              Отправить в обработку
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!routerOrder}
              onClick={() => {
                if (!routerOrder) return;
                showToast(`Документы отправлены на согласование · #${routerOrder.id} (демо)`);
              }}
            >
              Согласовать документы
            </button>
          </div>
        </div>
      </div>

      <div className="two">
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: 10 }}>Документы по заявке</h3>
          {routerOrder && routerOrder.docs?.length ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {routerOrder.docs.map((d) => {
                  const isOn = d.id === selectedDocId;
                  const pill = d.kind === "photo" ? "Фото" : d.kind === "pdf" ? "PDF" : "Файл";
                  return (
                    <button
                      key={d.id}
                      type="button"
                      className="doc-chip"
                      style={{
                        borderColor: isOn ? "var(--blue)" : undefined,
                        boxShadow: isOn ? "0 0 0 3px rgba(43,114,244,.12)" : undefined,
                      }}
                      onClick={() => setSelectedDocId(d.id)}
                    >
                      {d.preview ? (
                        <span className="doc-thumb" style={{ width: 34, height: 34 }}>
                          <img src={d.preview} alt="" />
                        </span>
                      ) : (
                        <span className="doc-ico" style={{ width: 30, height: 30 }}><Icon name="file" /></span>
                      )}
                      <span className="doc-info" style={{ flex: 1 }}>
                        <b style={{ display: "block" }}>{d.name}</b>
                      </span>
                      <span className="pill ok">{pill}</span>
                    </button>
                  );
                })}
              </div>

              <div className="card" style={{ margin: 0, background: "rgba(247,249,252,.7)" }}>
                <h3 style={{ marginBottom: 10, fontSize: "1.02rem" }}>Предпросмотр</h3>
                {selectedDoc ? (
                  selectedDoc.preview ? (
                    <img
                      src={selectedDoc.preview}
                      alt=""
                      style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 16, display: "block" }}
                    />
                  ) : (
                    <div className="meta">
                      Это документ типа <b>{selectedDoc.kind === "pdf" ? "PDF" : "Файл"}</b>. В демо-превью доступно только для фото.
                    </div>
                  )
                ) : (
                  <p className="meta">Выберите документ из списка выше.</p>
                )}
              </div>
            </>
          ) : (
            <p className="meta">Пока документы не приложены. Вернитесь к шагу «Товар».</p>
          )}
        </div>

        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: 10 }}>Платежи и суммы</h3>
          {routerOrder ? (
            <>
              <div className="pay-row"><span>Пошлина</span><strong>{money(routerOrder.duty)}</strong></div>
              <div className="pay-row"><span>НДС</span><strong>{money(routerOrder.vat)}</strong></div>
              <div className="pay-row"><span>Сбор / тариф</span><strong>{money(routerOrder.fee)}</strong></div>
              <div className="pay-row total"><span>Итого</span><strong>{routerOrder.sum}</strong></div>
              <p className="meta" style={{ marginTop: 12 }}>
                Суммы берутся из заявки. После подтверждения брокером расчёт уходит на декларацию (демо).
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <Link href={`/client/orders/${routerOrder.id}`} className="btn btn-primary btn-sm">К заявке</Link>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => showToast(`Напоминание о платежах включено · #${routerOrder.id} (демо)`)}
                >
                  Напомнить
                </button>
              </div>
            </>
          ) : (
            <p className="meta">Откройте активную заявку — и мы покажем платежи автоматически.</p>
          )}
        </div>
      </div>
    </>
  );
}
