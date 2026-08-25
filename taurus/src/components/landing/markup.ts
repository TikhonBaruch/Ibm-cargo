/* Auto-extracted from docs/design/refs/cargo-broker-design.html */
export const landingMarkup = `

<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="i-box" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></symbol>
  <symbol id="i-cpu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></symbol>
  <symbol id="i-scan" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></symbol>
  <symbol id="i-message" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></symbol>
  <symbol id="i-alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></symbol>
  <symbol id="i-truck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></symbol>
  <symbol id="i-file" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></symbol>
  <symbol id="i-chart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></symbol>
  <symbol id="i-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></symbol>
  <symbol id="i-upload" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></symbol>
  <symbol id="i-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></symbol>
  <symbol id="i-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></symbol>
</svg>

<div class="fx-cursor" id="fxCursor" aria-hidden="true"></div>
<div class="fx-layer" id="fxLayer" aria-hidden="true">
  <canvas class="fx-canvas" id="fxCanvas"></canvas>
  <div class="fx-grid"></div>
  <div class="fx-orb o1" data-depth="0.03"></div>
  <div class="fx-orb o2" data-depth="0.05"></div>
  <div class="fx-orb o3" data-depth="0.07"></div>
  <div class="fx-shape s1" data-depth="0.04"></div>
  <div class="fx-shape s2" data-depth="0.08"></div>
  <div class="fx-shape s3" data-depth="0.03"></div>
  <div class="fx-shape s4" data-depth="0.09"></div>
  <div class="fx-line l1" data-depth="0.05"></div>
  <div class="fx-line l2" data-depth="0.06"></div>
  <div class="fx-dot d1" data-depth="0.1"></div>
  <div class="fx-dot d2" data-depth="0.12"></div>
  <div class="fx-dot d3" data-depth="0.08"></div>
  <div class="fx-dot d4" data-depth="0.11"></div>
  <div class="fx-dot d5" data-depth="0.09"></div>
  <div class="fx-icon i1 chip" data-depth="0.08"><span><svg><use href="#i-box"/></svg></span></div>
  <div class="fx-icon i2 ring" data-depth="0.12"><span><svg><use href="#i-globe"/></svg></span></div>
  <div class="fx-icon i3 chip" data-depth="0.07"><span><svg><use href="#i-truck"/></svg></span></div>
  <div class="fx-icon i4 ring" data-depth="0.1"><span><svg><use href="#i-shield"/></svg></span></div>
  <div class="fx-icon i5 chip" data-depth="0.05"><span><svg><use href="#i-cpu"/></svg></span></div>
  <div class="fx-icon i6" data-depth="0.09"><span><svg><use href="#i-file"/></svg></span></div>
  <div class="fx-icon i7 ring" data-depth="0.11"><span><svg><use href="#i-chart"/></svg></span></div>
  <div class="fx-icon i8 chip" data-depth="0.08"><span><svg><use href="#i-scan"/></svg></span></div>
  <div class="fx-icon i9" data-depth="0.06"><span><svg><use href="#i-message"/></svg></span></div>
  <div class="fx-icon i10 ring" data-depth="0.1"><span><svg><use href="#i-upload"/></svg></span></div>
</div>

<div class="toast" id="toast"></div>

<header class="site-header" id="header">
  <div class="wrap hdr-inner">
    <a href="/" class="brand">
      <div class="brand-mark">
        <svg><use href="#i-box"/></svg>
      </div>
      <div>
        LBM БРОКЕР
        <small>AI-платформа для импорта</small>
      </div>
    </a>
    <nav class="nav">
      <a href="#how">Как работает</a>
      <a href="#features">Возможности</a>
      <a href="#cabinet">Кабинет</a>
      <a href="#pricing">Тарифы</a>
    </nav>
    <div class="hdr-actions">
      <a href="/login" class="btn btn-ghost btn-sm">Войти</a>
      <a href="/register" class="btn btn-primary btn-sm">Начать бесплатно</a>
      <button type="button" class="menu-btn" onclick="toggleMobile(true)" aria-label="Меню">
        <svg width="20" height="20"><use href="#i-menu"/></svg>
      </button>
    </div>
  </div>
</header>

<div class="mobile-nav" id="mobileNav" onclick="if(event.target===this)toggleMobile(false)">
  <div class="mobile-panel">
    <button type="button" class="btn btn-ghost btn-sm" style="align-self:flex-end;margin-bottom:8px" onclick="toggleMobile(false)">
      <svg width="18" height="18"><use href="#i-x"/></svg>
    </button>
    <a href="#how" onclick="toggleMobile(false)">Как работает</a>
    <a href="#features" onclick="toggleMobile(false)">Возможности</a>
    <a href="#cabinet" onclick="toggleMobile(false)">Кабинет</a>
    <a href="#app" onclick="toggleMobile(false)">Направления</a>
    <a href="#pricing" onclick="toggleMobile(false)">Тарифы</a>
    <a href="/register" class="btn btn-primary" style="margin-top:16px" onclick="toggleMobile(false)">Начать бесплатно</a>
  </div>
</div>

<!-- HERO -->
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow">
        <svg width="14" height="14"><use href="#i-cpu"/></svg>
        AI + экспертиза брокера
      </div>
      <h1>Импорт без ошибок, лишних затрат и <span>ожидания</span></h1>
      <p class="hero-lead">
        AI готовит черновик кода ТН ВЭД и смету платежей. Живой брокер проверяет результат — вы получаете PDF для декларации.
      </p>
      <div class="hero-cta">
        <a href="/register" class="btn btn-primary">
          <svg width="16" height="16"><use href="#i-chart"/></svg>
          Создать просчёт
        </a>
        <a href="/login" class="btn btn-ghost">
          <svg width="14" height="14"><use href="#i-play"/></svg>
          Войти в кабинет
        </a>
      </div>
      <div class="hero-facts">
        <div><strong>1–3 мин</strong><span>AI-черновик</span></div>
        <div><strong>≤ 4 ч</strong><span>проверка брокером</span></div>
        <div><strong>PDF</strong><span>готовый отчёт</span></div>
        <div><strong>3 тарифа</strong><span>Экспресс · Стандарт · Профи</span></div>
      </div>
    </div>

    <div class="product" aria-label="Превью платформы">
      <div class="product-top">
        <div class="product-dots"><i></i><i></i><i></i></div>
        <span class="pill dark">Расчёт #47892</span>
      </div>
      <div class="product-body">
        <div class="product-head">
          <div>
            <div class="sub">Просчёт импорта</div>
            <strong>Ноутбуки Lenovo ThinkPad</strong>
          </div>
          <span class="pill ok">
            <svg width="12" height="12"><use href="#i-check"/></svg>
            Завершён
          </span>
        </div>
        <div class="metric-row">
          <div class="metric">
            <div class="k">Итого платежей</div>
            <div class="v">1 248 700 ₽</div>
          </div>
          <div class="metric">
            <div class="k">Код ТН ВЭД</div>
            <div class="v" style="font-size:1rem">8471 30 000 0</div>
          </div>
        </div>
        <div class="breakdown">
          <div><span>Таможенная стоимость</span><strong>1 620 000 ₽</strong></div>
          <div><span>Пошлина 7%</span><strong>113 400 ₽</strong></div>
          <div><span>НДС 22%</span><strong>381 348 ₽</strong></div>
          <div><span>Таможенный сбор</span><strong>13 541 ₽</strong></div>
        </div>
        <div class="doc-row">
          <span class="pill ok">Invoice.pdf</span>
          <span class="pill ok">Packing list</span>
          <span class="pill warn">Сертификат</span>
        </div>
        <div class="broker-chip">
          <div class="avatar">
            <img src="/landing/assets/avatar-broker.jpg" alt="">
          </div>
          <div style="flex:1">
            <strong style="font-size:14px">Алексей Иванов</strong>
            <div class="meta">Таможенный брокер · ★ 4.9</div>
          </div>
          <span class="pill blue">В работе</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- TRUST -->
<section class="trust">
  <div class="wrap trust-inner">
    <div class="trust-label">Доверяют импортёры</div>
    <div class="trust-logos">
      <span>NordTrade</span>
      <span>SilkWay Logistics</span>
      <span>EastImport</span>
      <span>Vostok Cargo</span>
      <span>Apex Retail</span>
      <span>Modul Group</span>
    </div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section class="section alt" id="how">
  <div class="section-deco" aria-hidden="true">
    <div class="ring r1"></div>
    <div class="ring r2"></div>
    <div class="blob b1"></div>
  </div>
  <div class="wrap">
    <div class="section-shell reveal">
      <div class="section-h center">
        <div class="label">Процесс</div>
        <h2>Как работает платформа</h2>
        <p>От описания товара до PDF с кодом ТН ВЭД — пять шагов. Кликните или включите автопросмотр.</p>
      </div>
      <div class="how-flow">
        <div class="how-progress">
          <div class="meta"><b id="stepCounter">1</b> / 5 · <span id="stepTitle">Описание</span></div>
          <div class="track"><i id="stepBar"></i></div>
          <div class="how-controls">
            <button type="button" onclick="stepPrev()" aria-label="Предыдущий шаг">‹</button>
            <button type="button" class="play" id="stepPlay" onclick="toggleStepPlay()" aria-label="Автопросмотр">▶</button>
            <button type="button" onclick="stepNext()" aria-label="Следующий шаг">›</button>
          </div>
        </div>
        <div class="steps">
          <div class="step active" data-step="0" onclick="selectStep(0)">
            <div class="pic">
              <img src="/landing/assets/ob-2-docs.jpg" alt="">
              <div class="ico"><svg><use href="#i-upload"/></svg></div>
            </div>
            <div class="n">1</div>
            <strong>Описание</strong>
            <span>Товар и attrs</span>
          </div>
          <div class="step" data-step="1" onclick="selectStep(1)">
            <div class="pic">
              <img src="/landing/assets/product-laptop.jpg" alt="">
              <div class="ico"><svg><use href="#i-cpu"/></svg></div>
            </div>
            <div class="n">2</div>
            <strong>AI-черновик</strong>
            <span>Классификация ТН ВЭД</span>
          </div>
          <div class="step" data-step="2" onclick="selectStep(2)">
            <div class="pic">
              <img src="/landing/assets/ob-3-cargo.jpg" alt="">
              <div class="ico"><svg><use href="#i-chart"/></svg></div>
            </div>
            <div class="n">3</div>
            <strong>Оплата</strong>
            <span>Тариф за просчёт</span>
          </div>
          <div class="step" data-step="3" onclick="selectStep(3)">
            <div class="pic">
              <img src="/landing/assets/avatar-broker.jpg" alt="">
              <div class="ico"><svg><use href="#i-shield"/></svg></div>
            </div>
            <div class="n">4</div>
            <strong>Брокер</strong>
            <span>QC и подтверждение</span>
          </div>
          <div class="step" data-step="4" onclick="selectStep(4)">
            <div class="pic">
              <img src="/landing/assets/ob-2-docs.jpg" alt="">
              <div class="ico"><svg><use href="#i-file"/></svg></div>
            </div>
            <div class="n">5</div>
            <strong>PDF-отчёт</strong>
            <span>Готовый пакет</span>
          </div>
        </div>
        <div class="step-stage">
          <div class="step-detail" id="stepDetail">
            <div class="label-row">
              <span class="pill blue" id="stepPill">Шаг 1</span>
              <span class="pill ok" id="stepTime">~1 мин</span>
            </div>
            <h3 id="stepHeading">Загрузка документов</h3>
            <p id="stepText"></p>
            <div class="actions">
              <a href="/register" class="btn btn-primary btn-sm">Попробовать шаг</a>
              <button type="button" class="btn btn-ghost btn-sm" onclick="stepNext()">Далее ›</button>
            </div>
          </div>
          <div class="step-visual">
            <img id="stepImage" src="/landing/assets/ob-2-docs.jpg" alt="">
            <div class="time" id="stepBadge">Кабинет</div>
            <div class="cap" id="stepCap">Товар готов к AI-черновику</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<div class="divider" aria-hidden="true"></div>

<!-- ABOUT SPLIT -->
<section class="section soft" id="about">
  <div class="section-deco" aria-hidden="true">
    <div class="ring r1"></div>
    <div class="blob b2"></div>
  </div>
  <div class="wrap">
    <div class="split-visual reveal">
      <div class="photo-stack" id="aboutStack">
        <div class="live"><span class="pulse-dot"></span> Платформа онлайн</div>
        <div class="main" onclick="cycleAboutVisual()">
          <img id="aboutMainImg" src="/landing/assets/ob-1-warehouse.jpg" alt="Склад">
        </div>
        <div class="float-top"><img id="aboutTopImg" src="/landing/assets/product-laptop.jpg" alt=""></div>
        <div class="float" onclick="cycleAboutVisual()">
          <img id="aboutFloatImg" src="/landing/assets/ob-3-port.jpg" alt="Порт">
        </div>
        <div class="badge-float" id="aboutBadge">
          <div class="avatar"><img src="/landing/assets/avatar-broker.jpg" alt=""></div>
          <div>
            <strong id="aboutBadgeTitle">Брокер на связи</strong>
            <span id="aboutBadgeText">Ответ за ≤ 4 часа</span>
          </div>
        </div>
      </div>
      <div>
        <div class="section-h" style="margin-bottom:14px">
          <div class="label">О платформе</div>
          <h2>#1 AI-решение для импорта в РФ и ЕАЭС</h2>
          <p id="aboutLead">Мы объединили автоматический расчёт платежей с живой экспертизой таможенного брокера — без Excel, хаоса в чатах и сюрпризов на границе.</p>
        </div>
        <div class="about-pills" id="aboutPills">
          <button type="button" class="on" data-about="0" onclick="setAboutTab(0)">AI-черновик</button>
          <button type="button" data-about="1" onclick="setAboutTab(1)">Живой брокер</button>
          <button type="button" data-about="2" onclick="setAboutTab(2)">PDF-отчёт</button>
        </div>
        <div class="about-points" id="aboutPoints">
          <div class="about-point on">
            <div class="ico"><svg><use href="#i-cpu"/></svg></div>
            <div>
              <strong>Черновик ТН ВЭД за минуты</strong>
              <span>Код, пошлина и НДС с пояснением уверенности — heuristic draft.</span>
            </div>
          </div>
          <div class="about-point">
            <div class="ico"><svg><use href="#i-file"/></svg></div>
            <div>
              <strong>Атрибуты товара</strong>
              <span>Бренд, материал, страна — брокер быстрее подтверждает код.</span>
            </div>
          </div>
          <div class="about-point">
            <div class="ico"><svg><use href="#i-chart"/></svg></div>
            <div>
              <strong>Прозрачная смета</strong>
              <span>Каждая строка платежа видна до оплаты и проверки.</span>
            </div>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">
          <a href="/register" class="btn btn-primary">Получить расчёт</a>
          <button type="button" class="btn btn-ghost" onclick="document.getElementById('features').scrollIntoView({behavior:'smooth'})">Сценарий MVP</button>
        </div>
        <div class="stats-strip" id="aboutStats">
          <div class="stat-card"><strong data-count="12000" data-suffix="k+" data-div="1000">0</strong><span>расчётов</span></div>
          <div class="stat-card"><strong data-count="98" data-suffix="%">0</strong><span>точность ТН ВЭД</span></div>
          <div class="stat-card"><strong data-count="240" data-suffix="+">0</strong><span>брокеров</span></div>
          <div class="stat-card"><strong data-count="30" data-suffix=" мин">0</strong><span>средний цикл</span></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CABINET -->
<section class="section alt" id="cabinet">
  <div class="wrap">
    <div class="split-visual reveal">
      <div>
        <div class="section-h" style="margin-bottom:8px">
          <div class="label">Личный кабинет</div>
          <h2>Весь импорт — в одном рабочем пространстве</h2>
          <p>Дашборд, просчёты, брокеры, документы и баланс. Создайте заявку за минуты и ведите её до PDF и оплаты.</p>
        </div>
        <ul class="feature-list">
          <li>
            <span class="tick"><svg><use href="#i-check"/></svg></span>
            <div><strong>Дашборд и заявки</strong>Активные просчёты, статусы у брокера и быстрый AI-черновик ТН ВЭД.</div>
          </li>
          <li>
            <span class="tick"><svg><use href="#i-check"/></svg></span>
            <div><strong>Чат с брокером</strong>Переписка по кодам, рискам и документам прямо в карточке расчёта.</div>
          </li>
          <li>
            <span class="tick"><svg><use href="#i-check"/></svg></span>
            <div><strong>Баланс и тарифы</strong>Оплата просчётов, история списаний и выбор плана без Excel.</div>
          </li>
        </ul>
        <a href="/login?callbackUrl=%2Fcabinet" class="btn btn-primary">Открыть кабинет</a>
      </div>
      <div class="cabinet-preview" aria-label="Превью личного кабинета">
        <div class="cabinet-ui">
          <aside class="cabinet-side">
            <div class="side-brand">Кабинет<small>Клиент · ООО «Импортёр»</small></div>
            <button type="button" class="on">Дашборд</button>
            <button type="button">Заявки</button>
            <button type="button">Брокеры</button>
            <button type="button">Баланс</button>
            <button type="button">Поддержка</button>
            <button type="button">Настройки</button>
          </aside>
          <div class="cabinet-main">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap">
              <div>
                <strong style="font-size:14px">Дашборд</strong>
                <div class="meta">Сводка по просчётам и платежам</div>
              </div>
              <span class="pill blue">Баланс 12 400 ₽</span>
            </div>
            <div class="cabinet-stats">
              <div class="cabinet-stat"><div class="v">5</div><div class="k">Активные</div></div>
              <div class="cabinet-stat"><div class="v">2</div><div class="k">У брокера</div></div>
              <div class="cabinet-stat"><div class="v">1</div><div class="k">В пути</div></div>
              <div class="cabinet-stat"><div class="v">3</div><div class="k">Сообщения</div></div>
            </div>
            <div class="cabinet-table">
              <div class="row head"><span>№</span><span>Товар</span><span>Сумма</span><span>Статус</span></div>
              <div class="row"><span>#47892</span><span>Ноутбуки · Китай → РФ</span><span>1 248 700 ₽</span><span class="pill ok">Готово</span></div>
              <div class="row"><span>#47880</span><span>Ткани · Турция</span><span>—</span><span class="pill blue">У брокера</span></div>
              <div class="row"><span>#47861</span><span>Автозапчасти · Китай</span><span>2 990 ₽</span><span class="pill warn">Оплата</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- AI FEATURES -->
<section class="section soft" id="features">
  <div class="section-deco" aria-hidden="true">
    <div class="blob b2"></div>
    <div class="ring r1"></div>
  </div>
  <div class="wrap">
    <div class="section-h reveal">
      <div class="label">Сценарий MVP</div>
      <h2>ТН ВЭД → брокер-QC → PDF</h2>
      <p>Черновик кода и смета, оплата тарифа, проверка брокером и готовый отчёт — без «доставки под ключ» как текущего оффера.</p>
    </div>
    <div class="feat-grid reveal">
      <article class="feat">
        <div class="feat-bg"><img src="/landing/assets/product-laptop.jpg" alt=""></div>
        <div class="feat-shade"></div>
        <div class="feat-body">
          <div class="feat-ico"><svg><use href="#i-cpu"/></svg></div>
          <h3>AI Classification</h3>
          <p>Heuristic определяет код ТН ВЭД по описанию товара и показывает уверенность.</p>
        </div>
      </article>
      <article class="feat">
        <div class="feat-bg"><img src="/landing/assets/ob-3-cargo.jpg" alt=""></div>
        <div class="feat-shade"></div>
        <div class="feat-body">
          <div class="feat-ico"><svg><use href="#i-chart"/></svg></div>
          <h3>Смета платежей</h3>
          <p>Пошлина, НДС и сборы в рублях — прозрачная формула по позициям.</p>
        </div>
      </article>
      <article class="feat">
        <div class="feat-bg"><img src="/landing/assets/avatar-broker.jpg" alt=""></div>
        <div class="feat-shade"></div>
        <div class="feat-body">
          <div class="feat-ico"><svg><use href="#i-shield"/></svg></div>
          <h3>Брокер-QC</h3>
          <p>Живой брокер правит HS/платежи и подтверждает результат в кабинете.</p>
        </div>
      </article>
      <article class="feat">
        <div class="feat-bg"><img src="/landing/assets/ob-2-docs.jpg" alt=""></div>
        <div class="feat-shade"></div>
        <div class="feat-body">
          <div class="feat-ico"><svg><use href="#i-file"/></svg></div>
          <h3>PDF-отчёт</h3>
          <p>Скачайте отчёт с кодами и платежами — deliverable MVP для декларации.</p>
        </div>
      </article>
      <article class="feat">
        <div class="feat-bg"><img src="/landing/assets/ob-1-warehouse.jpg" alt=""></div>
        <div class="feat-shade"></div>
        <div class="feat-body">
          <div class="feat-ico"><svg><use href="#i-users"/></svg></div>
          <h3>Кабинет импортёра</h3>
          <p>Заявки, баланс, чат с брокером и поддержка — роли CLIENT / BROKER / ADMIN.</p>
        </div>
      </article>
      <article class="feat">
        <div class="feat-bg"><img src="/landing/assets/ob-2-docs.jpg" alt=""></div>
        <div class="feat-shade"></div>
        <div class="feat-body">
          <div class="feat-ico"><svg><use href="#i-box"/></svg></div>
          <h3>Три тарифа</h3>
          <p>Экспресс, Стандарт и Профи — оплата за просчёт, не подписка «Старт/Бизнес».</p>
        </div>
      </article>
    </div>
  </div>
</section>

<div class="divider" aria-hidden="true"></div>

<!-- COMPARE + EXAMPLE -->
<section class="section soft" id="example-calc">
  <div class="section-deco" aria-hidden="true">
    <div class="ring r1"></div>
    <div class="blob b1"></div>
  </div>
  <div class="wrap">
    <div class="section-h center reveal">
      <div class="label">Эффект</div>
      <h2>Быстрее, прозрачнее, без Excel-хаоса</h2>
      <p>Сравните привычный процесс с работой через платформу — и посмотрите пример реального расчёта по товару.</p>
    </div>

    <div class="effect-kpis reveal" id="effectKpis">
      <div class="effect-kpi">
        <div class="ico"><svg><use href="#i-chart"/></svg></div>
        <strong data-count="90" data-prefix="−" data-suffix="%">0</strong>
        <span>времени на расчёт и согласование</span>
      </div>
      <div class="effect-kpi">
        <div class="ico"><svg><use href="#i-file"/></svg></div>
        <strong data-count="0" data-suffix=" Excel">0</strong>
        <span>таблиц и ручных правок кодов</span>
      </div>
      <div class="effect-kpi">
        <div class="ico"><svg><use href="#i-message"/></svg></div>
        <strong data-count="1" data-suffix=" заявка">0</strong>
        <span>вместо переписки в чатах</span>
      </div>
      <div class="effect-kpi">
        <div class="ico"><svg><use href="#i-check"/></svg></div>
        <strong data-count="30" data-suffix=" мин">0</strong>
        <span>средний цикл до PDF-отчёта</span>
      </div>
    </div>

    <div class="two reveal">
      <div class="panel">
        <h3>До и после</h3>
        <div class="effect-tabs" id="effectTabs">
          <button type="button" data-effect="before" onclick="setEffectMode('before')">До</button>
          <button type="button" class="on" data-effect="after" onclick="setEffectMode('after')">После</button>
          <button type="button" data-effect="both" onclick="setEffectMode('both')">Сравнение</button>
        </div>
        <div class="effect-visual good" id="effectVisual" onclick="cycleEffectMode()">
          <img id="effectImg" src="/landing/assets/product-laptop.jpg" alt="">
          <div class="mode-pill" id="effectModePill">После · ~30 мин</div>
          <div class="tag" id="effectTag">AI + живой брокер</div>
        </div>
        <div class="effect-meter">
          <div class="row">
            <strong id="effectTimeLabel">~30 минут</strong>
            <span id="effectTimeHint">цикл от заявки до PDF</span>
          </div>
          <div class="bar"><i id="effectBar" style="width:12%"></i></div>
          <div class="ticks"><span>5 дней</span><span>1 день</span><span>30 мин</span></div>
        </div>
        <div class="effect-list" id="effectList"></div>
      </div>

      <div class="panel">
        <h3>Пример расчёта</h3>
        <div class="calc-visual" id="calcVisual">
          <img id="calcImg" src="/landing/assets/product-laptop.jpg" alt="Ноутбуки">
          <div class="tag" id="calcTag">Китай → Россия · FOB · ноутбуки</div>
        </div>
        <div class="product-pills" id="productPills">
          <button type="button" class="product-pill on" data-product="laptop" onclick="setCalcProduct('laptop')">
            <strong>Ноутбуки</strong>
            <span>$18 000 · пошлина 7%</span>
          </button>
          <button type="button" class="product-pill" data-product="shoes" onclick="setCalcProduct('shoes')">
            <strong>Обувь</strong>
            <span>$9 500 · пошлина 10%</span>
          </button>
          <button type="button" class="product-pill" data-product="parts" onclick="setCalcProduct('parts')">
            <strong>Автозапчасти</strong>
            <span>$24 000 · пошлина 5%</span>
          </button>
        </div>
        <input type="hidden" id="calcProduct" value="laptop">
        <div class="breakdown rich" id="calcBreakdown"></div>
        <div class="effect-total-row">
          <div>
            <div class="hint">Итого таможенных платежей</div>
            <div class="total" id="calcTotal">0 ₽</div>
          </div>
          <div class="hint" id="calcConfidence">Уверенность AI · 97%</div>
        </div>
        <div class="effect-calc-actions">
          <a href="/register" class="btn btn-primary btn-sm">Получить такой расчёт</a>
          <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('savings').scrollIntoView({behavior:'smooth'})">Считать экономию ›</button>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- DOCS + BROKERS -->
<section class="section alt" id="brokers">
  <div class="wrap">
    <div class="section-shell reveal">
      <div class="section-h">
        <div class="label">Документы и брокеры</div>
        <h2>Проверка комплекта и выбор брокера</h2>
        <p>Загрузите файлы — AI найдёт ошибки. Назначьте проверенного таможенного брокера.</p>
      </div>
      <div class="two">
        <div class="panel" style="box-shadow:none">
          <h3>Проверка документов</h3>
          <div class="dropzone" id="dropzone" onclick="simulateUpload()">
            <svg width="28" height="28" style="margin:0 auto;color:var(--blue)"><use href="#i-upload"/></svg>
            <strong>Перетащите файлы сюда</strong>
            <span>Invoice, packing list, сертификат · PDF / JPG</span>
          </div>
          <div class="file-list" id="fileList">
            <div class="file-item">
              <svg width="16" height="16" style="color:var(--ok)"><use href="#i-check"/></svg>
              <span class="name">Invoice_Lenovo.pdf</span>
              <span class="pill ok">OK</span>
            </div>
            <div class="file-item">
              <svg width="16" height="16" style="color:var(--ok)"><use href="#i-check"/></svg>
              <span class="name">Packing_List.pdf</span>
              <span class="pill ok">OK</span>
            </div>
            <div class="file-item">
              <svg width="16" height="16" style="color:var(--warn)"><use href="#i-alert"/></svg>
              <span class="name">Certificate.pdf</span>
              <span class="pill warn">Ошибка</span>
            </div>
          </div>
          <div class="alert-box" id="docAlert">
            <strong>Найдена ошибка в сертификате</strong>
            Номер партии не совпадает с invoice (INV-47892 ≠ CERT-47110). Рекомендуем запросить исправленный документ.
          </div>
        </div>

        <div>
          <div class="list-title">Топ брокеры</div>
          <div class="person-card selected" onclick="selectBroker(this, 'Алексей Иванов')">
            <div class="photo"><img src="/landing/assets/avatar-broker.jpg" alt=""></div>
            <div style="flex:1">
              <strong>Алексей Иванов</strong>
              <div class="meta">Москва · Китай / ЕАЭС</div>
              <div class="stars">★★★★★ 4.9 · 98% успех</div>
            </div>
            <button type="button" class="btn btn-primary btn-sm" onclick="event.stopPropagation();toast('Заявка отправлена Алексею Иванову')">Выбрать</button>
          </div>
          <div class="person-card" onclick="selectBroker(this, 'Мария Козлова')">
            <div class="photo"><img src="/landing/assets/avatar-support.jpg" alt=""></div>
            <div style="flex:1">
              <strong>Мария Козлова</strong>
              <div class="meta">Владивосток · Азия</div>
              <div class="stars">★★★★★ 4.8 · 96% успех</div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();toast('Заявка отправлена Марии Козловой')">Выбрать</button>
          </div>
          <div class="person-card" onclick="selectBroker(this, 'Дмитрий Ким')">
            <div class="photo"><img src="/landing/assets/avatar-user.jpg" alt=""></div>
            <div style="flex:1">
              <strong>Дмитрий Ким</strong>
              <div class="meta">Санкт-Петербург · Корея / Китай</div>
              <div class="stars">★★★★☆ 4.7 · 95% успех</div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();toast('Заявка отправлена Дмитрию Киму')">Выбрать</button>
          </div>
          <div style="margin-top:14px;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)">
            <span class="pulse-dot"></span>
            <span>2 брокера онлайн · среднее время ответа 38 мин</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- SAVINGS -->
<section class="section" id="savings">
  <div class="wrap">
    <div class="section-h reveal">
      <div class="label">Калькулятор экономии</div>
      <h2>Сколько вы экономите в год</h2>
      <p>Подстройте параметры под свой импорт — результат обновится мгновенно.</p>
    </div>
    <div class="save-grid reveal">
      <div class="panel">
        <div class="save-inputs">
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--muted)">Отправок в месяц</label>
            <div class="range-val" id="shipVal">12</div>
            <input type="range" id="shipRange" min="1" max="60" value="12" oninput="calcSavings()">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--muted)">Менеджеров на импорте</label>
            <div class="range-val" id="mgrVal">2</div>
            <input type="range" id="mgrRange" min="1" max="10" value="2" oninput="calcSavings()">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--muted)">Средняя цена ошибки, ₽</label>
            <div class="range-val" id="errVal">85 000</div>
            <input type="range" id="errRange" min="10000" max="300000" step="5000" value="85000" oninput="calcSavings()">
          </div>
        </div>
      </div>
      <div class="save-result">
        <div class="k">Экономия в год</div>
        <div class="v" id="saveTotal">4 820 000 ₽</div>
        <div class="hint">Время менеджеров + предотвращённые ошибки + ускорение цикла</div>
      </div>
    </div>
  </div>
</section>

<!-- PRICING -->
<section class="section alt" id="pricing">
  <div class="section-deco" aria-hidden="true">
    <div class="ring r1"></div>
    <div class="blob b2"></div>
  </div>
  <div class="wrap">
    <div class="section-h center reveal">
      <div class="label">Тарифы</div>
      <h2>Оплата за просчёт</h2>
      <p>Экспресс, Стандарт и Профи — лимиты позиций по тарифу. Подписки «Старт/Бизнес» на лендинге больше не продаём как текущий продукт.</p>
    </div>
    <div class="tariffs reveal">
      <div class="tariff">
        <h3>Экспресс</h3>
        <div class="desc">1 позиция · только AI при высокой уверенности</div>
        <div class="price">от тарифа <small>/ просчёт</small></div>
        <ul>
          <li><svg><use href="#i-check"/></svg> 1 позиция товара</li>
          <li><svg><use href="#i-check"/></svg> AI-черновик ТН ВЭД</li>
          <li><svg><use href="#i-check"/></svg> PDF при авто-DONE</li>
          <li><svg><use href="#i-check"/></svg> Без очереди брокера (high conf.)</li>
        </ul>
        <a href="/register" class="btn btn-ghost" style="width:100%">Начать</a>
      </div>
      <div class="tariff featured">
        <div class="badge">Популярный</div>
        <h3>Стандарт</h3>
        <div class="desc">До 3 позиций · брокер-QC</div>
        <div class="price">от тарифа <small>/ просчёт</small></div>
        <ul>
          <li><svg><use href="#i-check"/></svg> До 3 позиций</li>
          <li><svg><use href="#i-check"/></svg> Очередь брокера после оплаты</li>
          <li><svg><use href="#i-check"/></svg> Правки HS / платежей</li>
          <li><svg><use href="#i-check"/></svg> PDF после approve</li>
        </ul>
        <a href="/register" class="btn btn-primary" style="width:100%">Выбрать Стандарт</a>
      </div>
      <div class="tariff">
        <h3>Профи</h3>
        <div class="desc">До 10 позиций · сложные партии</div>
        <div class="price">от тарифа <small>/ просчёт</small></div>
        <ul>
          <li><svg><use href="#i-check"/></svg> До 10 позиций</li>
          <li><svg><use href="#i-check"/></svg> Preferred broker</li>
          <li><svg><use href="#i-check"/></svg> Чат по заявке</li>
          <li><svg><use href="#i-check"/></svg> PDF и история событий</li>
        </ul>
        <a href="/register" class="btn btn-dark" style="width:100%">Выбрать Профи</a>
      </div>
    </div>
  </div>
</section>

<div class="divider" aria-hidden="true"></div>

<!-- SCENARIOS (was mobile app — D27: no app-store CTA) -->
<section class="section alt" id="app">
  <div class="wrap">
    <div class="section-h center reveal">
      <div class="label">Направления</div>
      <h2>Для частного импортёра и SMB</h2>
      <p>Нужен код ТН ВЭД и контроль брокера — не «логистика под ключ». Перевозка в продукте на hold.</p>
    </div>
    <div class="feat-grid reveal" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
      <article class="feat" style="min-height:180px">
        <div class="feat-body">
          <h3>Частник / ИП</h3>
          <p>Экспресс или Стандарт: один товар → черновик → PDF после QC.</p>
          <a href="/register" class="btn btn-primary btn-sm" style="margin-top:12px">Зарегистрироваться</a>
        </div>
      </article>
      <article class="feat" style="min-height:180px">
        <div class="feat-body">
          <h3>Регулярный импорт</h3>
          <p>Профи до 10 позиций, preferred broker и чат по заявке.</p>
          <a href="/login" class="btn btn-ghost btn-sm" style="margin-top:12px">Войти в кабинет</a>
        </div>
      </article>
      <article class="feat" style="min-height:180px">
        <div class="feat-body">
          <h3>Брокер</h3>
          <p>Очередь после оплаты, mapping HS/платежей, approve → DONE.</p>
          <a href="/login" class="btn btn-ghost btn-sm" style="margin-top:12px">Кабинет брокера</a>
        </div>
      </article>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="section">
  <div class="wrap reveal">
    <div class="cta-banner">
      <div class="cta-copy">
        <div class="eyebrow" style="margin-bottom:14px;width:fit-content">Регистрация импортёра</div>
        <h2>Создайте первый просчёт ТН ВЭД</h2>
        <p>Опишите товар — AI подготовит черновик кода и платежей. После оплаты брокер подтвердит результат. PDF — deliverable MVP.</p>
        <div class="cta-perks">
          <span>✓ 1–3 минуты на черновик</span>
          <span>✓ Живой брокер ≤ 4 ч</span>
          <span>✓ PDF после проверки</span>
        </div>
        <div class="cta-actions">
          <a href="/register" class="btn btn-primary">Зарегистрироваться</a>
          <a href="/login" class="btn btn-outline-light">Войти в кабинет</a>
        </div>
      </div>
      <div class="cta-visual">
        <div class="cta-float">
          <strong>Экономия от 4,8 млн ₽/год</strong>
          <span>по среднему сценарию калькулятора</span>
        </div>
      </div>
    </div>
  </div>
</section>

<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <div class="footer-brand">LBM БРОКЕР</div>
        <p>AI-платформа для импорта: черновик ТН ВЭД, проверка брокером и PDF. Перевозка — позже.</p>
      </div>
      <div>
        <strong>Продукт</strong>
        <a href="#features">Возможности</a>
        <a href="#cabinet">Кабинет</a>
        <a href="#app">Направления</a>
        <a href="#pricing">Тарифы</a>
      </div>
      <div>
        <strong>Компания</strong>
        <a href="#">О нас</a>
        <a href="#">Блог</a>
        <a href="#">Карьера</a>
        <a href="#">Контакты</a>
      </div>
      <div>
        <strong>Документы</strong>
        <a href="#">Политика конфиденциальности</a>
        <a href="#">Пользовательское соглашение</a>
        <a href="#">152-ФЗ</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 LBM Брокер. Все права защищены.</span>
      <span>Интерактивный дизайн-макет · broker-ref × Cargo broker</span>
    </div>
  </div>
</footer>

<!-- Modal -->
<div class="modal-overlay" id="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <h3 id="modalTitle">Начать бесплатно</h3>
    <p id="modalText">Оставьте email — откроем доступ к 3 AI-расчётам и демо кабинета.</p>
    <div class="field">
      <label>Email</label>
      <input type="email" id="modalEmail" placeholder="you@company.ru">
    </div>
    <div class="field">
      <label>Компания</label>
      <input type="text" id="modalCompany" placeholder="ООО «Импорт»">
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Отмена</button>
      <button type="button" class="btn btn-primary" onclick="submitModal()">Получить доступ</button>
    </div>
  </div>
</div>


`;
