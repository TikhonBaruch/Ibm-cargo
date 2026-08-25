"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/lbm-bro/components/icon";
import { useDemo } from "@/lbm-bro/lib/store";

export function AdminDash() {
  return (
    <>
      <div className="stats">
        <div className="stat"><div className="v">1 284</div><div className="k">Просчётов за месяц</div><div className="delta up">↑ 12% к прошлому</div></div>
        <div className="stat"><div className="v">2.1 млн ₽</div><div className="k">Выручка GMV</div><div className="delta up">↑ 8%</div></div>
        <div className="stat"><div className="v">98%</div><div className="k">Точность ТН ВЭД</div><div className="delta up">↑ 1.2 п.п.</div></div>
        <div className="stat"><div className="v">3.2 ч</div><div className="k">Средний SLA брокера</div><div className="delta down">↓ 0.4 ч</div></div>
      </div>
      <div className="detail-grid">
        <div className="card">
          <div className="card-head"><div><h3>Просчёты по дням</h3><p>Последние 7 дней · AI + брокер</p></div><span className="pill ok">Живой</span></div>
          <div className="chart-bars">
            {[["Ср", 45], ["Чт", 62], ["Пт", 38], ["Сб", 28], ["Вс", 22], ["Пн", 78], ["Вт", 92]].map(([d, h]) => (
              <div key={String(d)} className="bar-col"><div className="bar" style={{ height: `${h}%` }} /><span>{d}</span></div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Требуют внимания</h3>
          <div className="activity-list">
            <div className="activity-item"><div className="dot danger" /><div><strong>SLA просрочен · #47890</strong><span>Химия · брокер не ответил 4 ч 20 мин</span></div></div>
            <div className="activity-item"><div className="dot warn" /><div><strong>AI confidence 61%</strong><span>#47894 · нужна эскалация эксперту</span></div></div>
            <div className="activity-item"><div className="dot" /><div><strong>Новый брокер на модерации</strong><span>Е. Соколова · сертификат загружен</span></div></div>
            <div className="activity-item"><div className="dot ok" /><div><strong>Выплата брокерам</strong><span>Июль · 312 400 ₽ готово к выплате</span></div></div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div><h3>Последние заявки</h3><p>Статусы по всей платформе</p></div><Link href="/admin/orders" className="btn btn-ghost btn-sm">Все заявки</Link></div>
        <table className="data">
          <thead><tr><th>№</th><th>Клиент</th><th>Товар</th><th>Брокер</th><th>Тариф</th><th>Статус</th></tr></thead>
          <tbody>
            <tr className="clickable"><td>#47895</td><td>ООО «Альфа»</td><td>Серверы</td><td>—</td><td>Таможня</td><td><span className="pill blue">Очередь</span></td></tr>
            <tr className="clickable"><td>#47892</td><td>ООО «Импортёр»</td><td>Ноутбуки</td><td>Иванов</td><td>Таможня</td><td><span className="pill ok">Готово</span></td></tr>
            <tr className="clickable"><td>#47890</td><td>ООО «Бета»</td><td>Химия</td><td>Петрова</td><td>Под ключ</td><td><span className="pill danger">SLA</span></td></tr>
            <tr className="clickable"><td>#47880</td><td>ООО «Текстиль»</td><td>Ткани</td><td>Иванов</td><td>Под ключ</td><td><span className="pill blue">У брокера</span></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

const ADMIN_ORDERS = [
  { id: "47895", client: "ООО Альфа", item: "Серверы", ai: "92%", broker: "—", status: "queue", pill: "Очередь", cls: "blue", act: "Назначить" },
  { id: "47880", client: "ООО Текстиль", item: "Ткани", ai: "84%", broker: "Иванов", status: "broker", pill: "У брокера", cls: "blue", act: "Сменить" },
  { id: "47890", client: "ООО Бета", item: "Химия", ai: "61%", broker: "Петрова", status: "sla", pill: "SLA", cls: "danger", act: "Эскалировать" },
  { id: "47892", client: "ООО Импортёр", item: "Ноутбуки", ai: "94%", broker: "Иванов", status: "done", pill: "Готово", cls: "ok", act: "PDF" },
  { id: "47894", client: "ИП Смирнов", item: "Станки", ai: "71%", broker: "—", status: "queue", pill: "Очередь", cls: "blue", act: "Назначить" },
];

export function AdminOrders() {
  const { showToast } = useDemo();
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const rows = useMemo(() => ADMIN_ORDERS.filter((r) => {
    const okS = f === "all" || r.status === f;
    const okQ = !q || `${r.id} ${r.client} ${r.item}`.toLowerCase().includes(q.toLowerCase());
    return okS && okQ;
  }), [q, f]);
  return (
    <div className="card">
      <div className="card-head"><div><h3>Все заявки на просчёт</h3><p>Фильтр по статусу, тарифу и брокеру</p></div></div>
      <div className="search-row">
        <input type="search" placeholder="Поиск по №, клиенту, товару…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={f} onChange={(e) => setF(e.target.value)}>
          <option value="all">Все статусы</option>
          <option value="queue">Очередь</option>
          <option value="broker">У брокера</option>
          <option value="done">Готово</option>
          <option value="sla">SLA risk</option>
        </select>
      </div>
      <table className="data">
        <thead><tr><th>№</th><th>Клиент</th><th>Товар</th><th>AI</th><th>Брокер</th><th>Статус</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>#{r.id}</td><td>{r.client}</td><td>{r.item}</td><td>{r.ai}</td><td>{r.broker}</td>
              <td><span className={`pill ${r.cls}`}>{r.pill}</span></td>
              <td><button type="button" className={`btn btn-sm ${r.act === "Эскалировать" ? "btn-danger" : "btn-ghost"}`} onClick={() => showToast(`${r.act} #${r.id}`)}>{r.act}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminClients() {
  const { showToast } = useDemo();
  return (
    <>
      <div className="stats">
        <div className="stat"><div className="v">842</div><div className="k">Активных клиентов</div></div>
        <div className="stat"><div className="v">64</div><div className="k">Новых за месяц</div></div>
        <div className="stat"><div className="v">12 400 ₽</div><div className="k">Средний баланс</div></div>
        <div className="stat"><div className="v">3.4</div><div className="k">Просчётов / клиент</div></div>
      </div>
      <div className="card">
        <div className="search-row">
          <input type="search" placeholder="Найти компанию или ИНН…" onChange={(e) => showToast(`Поиск: ${e.target.value}`)} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => showToast("Приглашение отправлено")}><Icon name="plus" /> Пригласить</button>
        </div>
        <table className="data">
          <thead><tr><th>Компания</th><th>Контакт</th><th>Тариф</th><th>Баланс</th><th>Заявок</th><th>Статус</th></tr></thead>
          <tbody>
            <tr><td>ООО «Импортёр»</td><td>ved@importyor.ru</td><td>Таможня</td><td>12 400 ₽</td><td>18</td><td><span className="pill ok">Активен</span></td></tr>
            <tr><td>ООО «Альфа»</td><td>ops@alfa.ru</td><td>Под ключ</td><td>48 200 ₽</td><td>42</td><td><span className="pill ok">Активен</span></td></tr>
            <tr><td>ООО «Бета»</td><td>ved@beta.ru</td><td>Таможня</td><td>1 100 ₽</td><td>9</td><td><span className="pill warn">Низкий баланс</span></td></tr>
            <tr><td>ИП Смирнов</td><td>smirnov@mail.ru</td><td>Код</td><td>3 500 ₽</td><td>4</td><td><span className="pill ok">Активен</span></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AdminBrokers() {
  const { showToast } = useDemo();
  return (
    <>
      <div className="alert-box warn-box"><strong>1 брокер на модерации</strong>Проверьте сертификат и направления перед публикацией в каталоге.</div>
      <div className="three">
        <div className="person-card col">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><div className="photo"><img src="/lbm-bro/assets/avatar-broker.svg" alt="" /></div><div><strong>Алексей Иванов</strong><div className="stars">★★★★★ 4.9</div></div></div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "10px 0" }}>Китай / ЕАЭС · 28 закрыто / нед · SLA 3.1 ч</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><span className="pill ok">Онлайн</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast("Профиль Иванова")}>Карточка</button></div>
        </div>
        <div className="person-card col">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><div className="photo"><img src="/lbm-bro/assets/avatar-support.svg" alt="" /></div><div><strong>Мария Петрова</strong><div className="stars">★★★★★ 4.8</div></div></div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "10px 0" }}>Текстиль · сертификация · 1 SLA risk</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><span className="pill warn">Занята</span><button type="button" className="btn btn-danger btn-sm" onClick={() => showToast("SLA эскалация: Петрова")}>Эскалировать</button></div>
        </div>
        <div className="person-card col">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><div className="photo"><img src="/lbm-bro/assets/avatar-support.svg" alt="" /></div><div><strong>Елена Соколова</strong><div className="stars">Новый</div></div></div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "10px 0" }}>ЕС / химия · сертификат на проверке</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => showToast("Брокер Соколова одобрена")}>Одобрить</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast("Заявка отклонена")}>Отклонить</button>
          </div>
        </div>
      </div>
    </>
  );
}

export function AdminTariffs() {
  const { showToast } = useDemo();
  return (
    <>
      <div style={{ marginBottom: 14, color: "var(--muted)", fontSize: 14 }}>Тарифы: Код · Таможня · Под ключ. Комиссия платформы и доля брокера настраиваются ниже.</div>
      <div className="three">
        <div className="tariff-mini"><h4>Код</h4><div style={{ fontSize: 13, color: "var(--muted)" }}>Только ТН ВЭД</div><div className="price">990 ₽ <small>/ просчёт</small></div><div className="field"><label>Цена, ₽</label><input type="number" defaultValue={990} /></div><button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast("Тариф Код сохранён")}>Сохранить</button></div>
        <div className="tariff-mini featured"><span className="pill blue" style={{ marginBottom: 8 }}>Популярный</span><h4>Таможня</h4><div style={{ fontSize: 13, color: "var(--muted)" }}>ТН ВЭД + расчёт платежей</div><div className="price">2 990 ₽ <small>/ просчёт</small></div><div className="field"><label>Цена, ₽</label><input type="number" defaultValue={2990} /></div><button type="button" className="btn btn-primary btn-sm" onClick={() => showToast("Тариф Таможня сохранён")}>Сохранить</button></div>
        <div className="tariff-mini"><h4>Под ключ</h4><div style={{ fontSize: 13, color: "var(--muted)" }}>Код, платежи и брокер</div><div className="price">5 990 ₽ <small>/ просчёт</small></div><div className="field"><label>Цена, ₽</label><input type="number" defaultValue={5990} /></div><div className="field"><label>Доля брокера, %</label><input type="number" defaultValue={40} /></div><button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast("Тариф Под ключ сохранён")}>Сохранить</button></div>
      </div>
    </>
  );
}

export function AdminFinance() {
  const { showToast } = useDemo();
  return (
    <>
      <div className="stats">
        <div className="stat"><div className="v">2.1 млн ₽</div><div className="k">GMV за месяц</div></div>
        <div className="stat"><div className="v">742 тыс ₽</div><div className="k">Комиссия платформы</div></div>
        <div className="stat"><div className="v">312 тыс ₽</div><div className="k">К выплате брокерам</div></div>
        <div className="stat"><div className="v">48</div><div className="k">Возвратов / диспутов</div></div>
      </div>
      <div className="two">
        <div className="card">
          <h3>Очередь выплат</h3>
          <table className="data">
            <thead><tr><th>Брокер</th><th>Период</th><th>Сумма</th><th /></tr></thead>
            <tbody>
              <tr><td>А. Иванов</td><td>Июль</td><td>84 000 ₽</td><td><button type="button" className="btn btn-primary btn-sm" onClick={() => showToast("Выплата Иванову отправлена")}>Выплатить</button></td></tr>
              <tr><td>М. Петрова</td><td>Июль</td><td>71 500 ₽</td><td><button type="button" className="btn btn-primary btn-sm" onClick={() => showToast("Выплата Петровой отправлена")}>Выплатить</button></td></tr>
              <tr><td>Д. Ким</td><td>Июль</td><td>62 200 ₽</td><td><button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast("Документы запрошены")}>Документы</button></td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Структура выручки</h3>
          <div className="breakdown" style={{ marginTop: 8 }}>
            <div><span>Код</span><strong>18%</strong></div><div className="progress-line"><i style={{ width: "18%" }} /></div>
            <div style={{ marginTop: 10 }}><span>Таможня</span><strong>54%</strong></div><div className="progress-line"><i style={{ width: "54%" }} /></div>
            <div style={{ marginTop: 10 }}><span>Под ключ</span><strong>28%</strong></div><div className="progress-line"><i style={{ width: "28%" }} /></div>
          </div>
        </div>
      </div>
    </>
  );
}

export function AdminAi() {
  const { showToast } = useDemo();
  const [th, setTh] = useState(75);
  return (
    <>
      <div className="stats">
        <div className="stat"><div className="v">98%</div><div className="k">Точность после брокера</div></div>
        <div className="stat"><div className="v">91%</div><div className="k">AI без правок</div></div>
        <div className="stat"><div className="v">18%</div><div className="k">Кодов скорректировано</div></div>
        <div className="stat"><div className="v">1–3 мин</div><div className="k">Среднее время AI</div></div>
      </div>
      <div className="two">
        <div className="card">
          <h3>Модули AI</h3>
          <table className="data">
            <thead><tr><th>Модуль</th><th>Статус</th><th>Uptime</th></tr></thead>
            <tbody>
              {[["AI Classification", "ok", "99.9%"], ["AI OCR", "ok", "99.7%"], ["AI Broker chat", "ok", "99.8%"], ["AI Risk", "warn", "98.1%"], ["AI Logistics", "ok", "99.5%"], ["AI Documents", "ok", "99.6%"]].map(([m, s, u]) => (
                <tr key={m}><td>{m}</td><td><span className={`pill ${s}`}>{s === "ok" ? "OK" : "Деградация"}</span></td><td>{u}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Порог эскалации</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>Если уверенность модели ниже порога — заявка сразу в очередь брокера.</p>
          <div className="field"><label>Порог confidence, %</label><input type="range" min={50} max={95} value={th} onChange={(e) => setTh(Number(e.target.value))} style={{ accentColor: "var(--blue)", width: "100%" }} /></div>
          <div style={{ fontFamily: "var(--display)", fontSize: "1.4rem", fontWeight: 700, color: "var(--blue)" }}>{th}%</div>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => showToast(`Порог эскалации сохранён: ${th}%`)}>Применить</button>
        </div>
      </div>
    </>
  );
}

export function AdminAudit() {
  const { showToast } = useDemo();
  return (
    <div className="card">
      <div className="card-head"><div><h3>Журнал действий</h3><p>Изменения расчётов, ролей и выплат · 152-ФЗ</p></div><button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast("Audit log выгружен")}>Скачать</button></div>
      <table className="data">
        <thead><tr><th>Время</th><th>Актор</th><th>Действие</th><th>Объект</th></tr></thead>
        <tbody>
          <tr><td>29.07 18:42</td><td>Иванов</td><td>Утвердил ТН ВЭД</td><td>#47892</td></tr>
          <tr><td>29.07 18:10</td><td>Admin</td><td>Эскалация SLA</td><td>#47890</td></tr>
          <tr><td>29.07 17:55</td><td>Система</td><td>AI-расчёт завершён</td><td>#47895</td></tr>
          <tr><td>29.07 16:20</td><td>ООО Импортёр</td><td>Пополнение баланса</td><td>+5 000 ₽</td></tr>
          <tr><td>29.07 15:01</td><td>Admin</td><td>Изменён тариф Таможня</td><td>2 990 ₽</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function AdminSettings() {
  const { showToast } = useDemo();
  return (
    <div className="two">
      <div className="card" style={{ maxWidth: "100%" }}>
        <h3>Платформа</h3>
        <div className="field"><label>Название</label><input defaultValue="LBM Брокер" /></div>
        <div className="field"><label>SLA брокера по умолчанию, часов</label><input type="number" defaultValue={4} /></div>
        <div className="field"><label>Курс USD (демо)</label><input type="number" defaultValue={90} /></div>
        <label className="toggle-row"><input type="checkbox" defaultChecked /> Маркетплейс брокеров включён</label>
        <label className="toggle-row"><input type="checkbox" defaultChecked /> Автоназначение брокера по очереди</label>
        <label className="toggle-row"><input type="checkbox" /> Режим обслуживания</label>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => showToast("Настройки платформы сохранены")}>Сохранить</button>
      </div>
      <div className="card">
        <h3>Безопасность</h3>
        <label className="toggle-row"><input type="checkbox" defaultChecked /> Обязательный 2FA для админов</label>
        <label className="toggle-row"><input type="checkbox" defaultChecked /> Audit log изменений расчёта</label>
        <label className="toggle-row"><input type="checkbox" defaultChecked /> Шифрование документов at rest</label>
        <div className="alert-box ok-box" style={{ marginTop: 8 }}><strong>Соответствие 152-ФЗ</strong>Роли, журналирование и разграничение доступа активны.</div>
      </div>
    </div>
  );
}
