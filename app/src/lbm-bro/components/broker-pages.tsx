"use client";

import Link from "next/link";
import { useState } from "react";
import { OrderCover } from "@/lbm-bro/components/order-cover";
import { Icon } from "@/lbm-bro/components/icon";
import { VoiceBubble } from "@/lbm-bro/components/voice-message";
import { useDemo } from "@/lbm-bro/lib/store";

export function BrokerDash() {
  const { queueCount, workCount, takeJob, queue } = useDemo();
  return (
    <>
      <div className="stats">
        <div className="stat"><div className="v">{queueCount}</div><div className="k">В общей очереди</div></div>
        <div className="stat"><div className="v">{workCount}</div><div className="k">У вас в работе</div></div>
        <div className="stat"><div className="v">1</div><div className="k">Просрочен SLA</div></div>
        <div className="stat"><div className="v">3.1 ч</div><div className="k">Среднее время ответа</div></div>
      </div>
      <div className="alert-box warn-box"><strong>SLA risk · #47890</strong>Заявка «Химия» у коллеги — при необходимости возьмите в работу после эскалации.</div>
      <div className="card">
        <h3>Требуют внимания</h3>
        <table className="data">
          <thead><tr><th>№</th><th>Клиент</th><th>Товар</th><th>AI confidence</th><th>Действие</th></tr></thead>
          <tbody>
            {queue.slice(0, 2).map((j) => (
              <tr key={j.id}>
                <td>#{j.id}</td><td>{j.client}</td><td>{j.tariff}</td><td>{j.conf}%</td>
                <td>{j.taken ? <span className="pill muted">В работе</span> : <button type="button" className="btn btn-primary btn-sm" onClick={() => takeJob(j.id)}>Взять</button>}</td>
              </tr>
            ))}
            <tr><td>#47890</td><td>ООО «Бета»</td><td>Химия</td><td>61%</td><td><span className="pill warn">SLA risk</span></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

export function BrokerQueue() {
  const { queue, takeJob, activeJobId, orders, hsEdit, setHsEdit, hsComment, setHsComment, approveJob } = useDemo();
  const o = orders.find((x) => x.id === activeJobId);
  return (
    <div className="detail-grid">
      <div className="card">
        <h3>Очередь оплаченных заявок</h3>
        <table className="data">
          <thead><tr><th>№</th><th>Клиент</th><th>Тариф</th><th>AI</th><th /></tr></thead>
          <tbody>
            {queue.map((j) => (
              <tr key={j.id}>
                <td>#{j.id}</td><td>{j.client}</td><td>{j.tariff}</td><td>{j.conf}%</td>
                <td>
                  {j.taken
                    ? <span className="pill muted">В работе</span>
                    : <button type="button" className="btn btn-primary btn-sm" onClick={() => takeJob(j.id)}>Взять</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Карточка <span>#{activeJobId}</span></h3>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
          {o ? `${o.title} · ${o.route} · тариф ${o.tariff}` : "ООО «Импортёр» · Китай · тариф Таможня"}
        </div>
        <div className="thumb-row" style={{ marginBottom: 12 }}>
          <div className="thumb"><OrderCover src="/lbm-bro/assets/order-placeholder.svg" /></div>
          <div className="thumb"><OrderCover src="/lbm-bro/assets/order-placeholder.svg" /></div>
        </div>
        <div className="metric-row">
          <div className="metric"><div className="k">ТН ВЭД (AI)</div><div className="v" style={{ fontSize: "1rem" }}>{o?.hs || hsEdit}</div></div>
          <div className="metric"><div className="k">Уверенность</div><div className="v" style={{ fontSize: "1.2rem" }}>{o?.conf ?? 94}%</div></div>
        </div>
        <div className="breakdown" style={{ marginBottom: 12 }}>
          <div><span>Пошлина</span><strong>{o && o.duty !== "—" ? `${o.duty} ₽` : "113 400 ₽"}</strong></div>
          <div><span>НДС</span><strong>{o && o.vat !== "—" ? `${o.vat} ₽` : "346 680 ₽"}</strong></div>
          <div><span>Сбор</span><strong>15 000 ₽</strong></div>
          <div><span>Итого</span><strong>{o?.sum && o.sum !== "—" ? o.sum : "1 248 700 ₽"}</strong></div>
        </div>
        <div className="field"><label>Код ТН ВЭД (правка брокера)</label><input value={hsEdit} onChange={(e) => setHsEdit(e.target.value)} /></div>
        <div className="field"><label>Комментарий клиенту / в журнал</label><input value={hsComment} onChange={(e) => setHsComment(e.target.value)} placeholder="Уточнён код по описанию процессора и экрана" /></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={approveJob}>Утвердить и отправить</button>
          <Link href="/broker/chat" className="btn btn-ghost">Чат</Link>
        </div>
      </div>
    </div>
  );
}

export function BrokerWork() {
  const { work } = useDemo();
  return (
    <div className="card">
      <h3>Заявки в вашей работе</h3>
      <table className="data">
        <thead><tr><th>№</th><th>Клиент</th><th>Взято</th><th>Осталось SLA</th><th>Статус</th></tr></thead>
        <tbody>
          {work.map((w) => (
            <tr key={`${w.id}-${w.taken}`}><td>#{w.id}</td><td>{w.client}</td><td>{w.taken}</td><td>{w.sla}</td><td><span className={`pill ${w.pill}`}>{w.status}</span></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BrokerChat() {
  const { brokerChat, sendBrokerChat } = useDemo();
  const [text, setText] = useState("");
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h3>Чат · заявка #47880 · ткани</h3>
      <div className="chat-box">
        {brokerChat.map((m, i) => (
          m.kind === "voice" ? (
            <div key={i} style={{ display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
              <VoiceBubble msg={m} mine={m.from === "me"} />
            </div>
          ) : (
            <div key={i} className={`bubble${m.from === "me" ? " me" : ""}`}>{m.text}</div>
          )
        ))}
      </div>
      <div className="chat-row">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ответ клиенту…" style={{ flex: 1, padding: "12px 14px", borderRadius: 14, border: "1.5px solid var(--line)", background: "#f5f7fa", outline: "none" }} onKeyDown={(e) => { if (e.key === "Enter") { sendBrokerChat(text); setText(""); } }} />
        <button type="button" className="btn btn-primary" onClick={() => { sendBrokerChat(text); setText(""); }}><Icon name="send" /></button>
      </div>
    </div>
  );
}

export function BrokerSla() {
  return (
    <>
      <div className="stats">
        <div className="stat"><div className="v">3.1 ч</div><div className="k">Средний SLA</div></div>
        <div className="stat"><div className="v">96%</div><div className="k">Заявок в срок</div></div>
        <div className="stat"><div className="v">4.9</div><div className="k">Рейтинг клиентов</div></div>
        <div className="stat"><div className="v">128</div><div className="k">Закрыто за месяц</div></div>
      </div>
      <div className="card">
        <h3>Качество AI vs ваши правки</h3>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>За месяц вы скорректировали код ТН ВЭД в 18% заявок. Средняя уверенность AI на принятых без правок — 91%.</p>
        <div className="breakdown">
          <div><span>Принято без правок</span><strong>82%</strong></div>
          <div className="progress-line"><i style={{ width: "82%" }} /></div>
          <div style={{ marginTop: 10 }}><span>Скорректировано вами</span><strong>18%</strong></div>
          <div className="progress-line"><i style={{ width: "18%", background: "linear-gradient(90deg,#c2410c,#f59e0b)" }} /></div>
        </div>
      </div>
    </>
  );
}

export function BrokerPay() {
  return (
    <div className="card">
      <h3>Выплаты (30–40% от просчёта)</h3>
      <table className="data">
        <thead><tr><th>Период</th><th>Заявок</th><th>Сумма</th><th>Статус</th></tr></thead>
        <tbody>
          <tr><td>Июль 2026</td><td>28</td><td>84 000 ₽</td><td><span className="pill blue">Начисление</span></td></tr>
          <tr><td>Июнь 2026</td><td>31</td><td>92 500 ₽</td><td><span className="pill ok">Выплачено</span></td></tr>
          <tr><td>Май 2026</td><td>24</td><td>71 200 ₽</td><td><span className="pill ok">Выплачено</span></td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function BrokerProfile() {
  const { showToast } = useDemo();
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
        <div className="avatar" style={{ width: 64, height: 64 }}><img src="/lbm-bro/assets/avatar-broker.svg" alt="" /></div>
        <div>
          <strong style={{ fontSize: "1.1rem", fontFamily: "var(--display)" }}>Алексей Иванов</strong>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Сертифицированный таможенный брокер</div>
        </div>
      </div>
      <div className="field"><label>Специализация</label><input defaultValue="Импорт из Китая, электроника, ЕАЭС" /></div>
      <div className="field"><label>Языки</label><input defaultValue="Русский, English, 中文 (базовый)" /></div>
      <div className="field"><label>О себе</label><textarea rows={3} defaultValue="12 лет в ВЭД, фокус на сложной классификации IT-оборудования и проверке комплектов документов." /></div>
      <label className="toggle-row"><input type="checkbox" defaultChecked /> Принимаю новые заявки из очереди</label>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => showToast("Профиль брокера сохранён")}>Сохранить</button>
    </div>
  );
}
