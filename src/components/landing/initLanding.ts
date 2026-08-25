/* eslint-disable */
// @ts-nocheck
/* Ported from cargo-broker-design.html */
export function initLanding(root: HTMLElement): () => void {
  const document = root.ownerDocument;
  const win = document.defaultView;
  if (!win) return () => {};
  const window = win as Window & typeof globalThis;
  const cleaned: Array<() => void> = [];

  /** Scope lookups to landing root — avoid null throws if DOM is partial. */
  const $ = <T extends Element = HTMLElement>(sel: string): T | null =>
    root.querySelector(sel) as T | null;
  const $id = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
    root.querySelector(`#${CSS.escape(id)}`) as T | null;
  const $$ = (sel: string) => root.querySelectorAll(sel);

  if (!$id("stepCounter") || !$id("stepDetail") || !$id("aboutLead")) {
    console.warn("[landing] critical nodes missing — skipping FX init");
    return () => {};
  }

  const stepData = [
    {
      title: 'Описание',
      heading: 'Описание товара',
      text: 'Укажите название, страну, стоимость и attrs (бренд, материал, вес). Этого достаточно для AI-черновика — полная база ТН ВЭД и LLM не обязательны.',
      time: '~2 мин',
      badge: 'Кабинет',
      cap: 'Товар готов к AI-черновику',
      image: '/landing/assets/ob-2-docs.jpg'
    },
    {
      title: 'AI-черновик',
      heading: 'Классификация по ТН ВЭД',
      text: 'Heuristic определяет код ТН ВЭД и показывает уверенность. Сомнительные позиции уходят к брокеру после оплаты.',
      time: '1–3 мин',
      badge: 'AI Classification',
      cap: 'Код подобран с пояснением',
      image: '/landing/assets/product-laptop.jpg'
    },
    {
      title: 'Оплата',
      heading: 'Тариф за просчёт',
      text: 'Экспресс, Стандарт или Профи — оплата с баланса компании. Очередь брокера только после оплаты (D11).',
      time: '~1 мин',
      badge: 'Тариф',
      cap: 'Заявка в очереди или DONE',
      image: '/landing/assets/ob-3-cargo.jpg'
    },
    {
      title: 'Брокер',
      heading: 'Проверка экспертом',
      text: 'Брокер правит HS/пошлину/НДС/сбор и подтверждает результат. Не меняет цену тарифа платформы.',
      time: '≤ 4 ч',
      badge: 'Живой брокер',
      cap: 'QC завершён',
      image: '/landing/assets/avatar-broker.jpg'
    },
    {
      title: 'PDF',
      heading: 'Готовый отчёт',
      text: 'Скачайте PDF с кодами и платежами — deliverable MVP. Перевозка в продукте пока на hold.',
      time: 'сразу',
      badge: 'PDF Report',
      cap: 'Отчёт готов к скачиванию',
      image: '/landing/assets/ob-2-docs.jpg'
    }
  ];

  let currentStep = 0;
  let stepTimer = null;

  function selectStep(i, fromAuto) {
    currentStep = (i + stepData.length) % stepData.length;
    const data = stepData[currentStep];
    document.querySelectorAll('.step').forEach((el, idx) => {
      el.classList.toggle('active', idx === currentStep);
    });
    document.getElementById('stepCounter').textContent = String(currentStep + 1);
    document.getElementById('stepTitle').textContent = data.title;
    document.getElementById('stepBar').style.width = ((currentStep + 1) / stepData.length * 100) + '%';
    document.getElementById('stepPill').textContent = 'Шаг ' + (currentStep + 1);
    document.getElementById('stepTime').textContent = data.time;
    document.getElementById('stepHeading').textContent = data.heading;
    document.getElementById('stepText').textContent = data.text;
    document.getElementById('stepBadge').textContent = data.badge;
    document.getElementById('stepCap').textContent = data.cap;
    const img = document.getElementById('stepImage');
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = data.image;
      img.style.opacity = '1';
      img.style.transform = 'scale(1.03)';
      setTimeout(() => { img.style.transform = 'scale(1)'; }, 50);
    }, 120);
    const detail = document.getElementById('stepDetail');
    detail.style.animation = 'none';
    void detail.offsetWidth;
    detail.style.animation = 'fadeUp .35s ease';
    if (!fromAuto) stopStepPlay();
  }
  function stepNext() { selectStep(currentStep + 1); }
  function stepPrev() { selectStep(currentStep - 1); }
  function stopStepPlay() {
    clearInterval(stepTimer);
    stepTimer = null;
    const btn = document.getElementById('stepPlay');
    if (btn) { btn.classList.remove('on'); btn.textContent = '▶'; }
  }
  function toggleStepPlay() {
    const btn = document.getElementById('stepPlay');
    if (stepTimer) { stopStepPlay(); return; }
    if (!btn) return;
    btn.classList.add('on');
    btn.textContent = '❚❚';
    stepTimer = setInterval(() => selectStep(currentStep + 1, true), 3200);
  }
  selectStep(0);

  const aboutTabs = [
    {
      lead: 'AI распознаёт документы и считает платежи за минуты — вы сразу видите код ТН ВЭД, пошлину и НДС без Excel.',
      badgeTitle: 'AI в работе',
      badgeText: 'Расчёт за 1–3 минуты',
      main: '/landing/assets/ob-1-warehouse.jpg',
      float: '/landing/assets/product-laptop.jpg',
      top: '/landing/assets/ob-2-docs.jpg',
      points: [
        { ico: 'i-cpu', title: 'Черновик ТН ВЭД за минуты', text: 'Код, пошлина и НДС с пояснением уверенности — heuristic draft.' },
        { ico: 'i-file', title: 'Атрибуты товара', text: 'Бренд, материал, страна — брокер быстрее подтверждает код.' },
        { ico: 'i-chart', title: 'Прозрачная смета', text: 'Каждая строка платежа видна до оплаты и проверки.' }
      ]
    },
    {
      lead: 'Живой таможенный брокер проверяет AI-результат, правит риски и подтверждает расчёт — ответственность остаётся на эксперте.',
      badgeTitle: 'Брокер на связи',
      badgeText: 'Ответ за ≤ 4 часа',
      main: '/landing/assets/avatar-broker.jpg',
      float: '/landing/assets/ob-3-port.jpg',
      top: '/landing/assets/avatar-support.jpg',
      points: [
        { ico: 'i-shield', title: 'Контроль эксперта', text: 'Брокер подтверждает результат до подачи декларации.' },
        { ico: 'i-message', title: 'Чат в карточке заявки', text: 'Вопросы по кодам и документам — без мессенджер-хаоса.' },
        { ico: 'i-users', title: 'Выбор специалиста', text: 'Назначьте брокера по направлению и рейтингу.' }
      ]
    },
    {
      lead: 'Данные защищены, доступ по ролям — итог MVP это PDF с кодами и платежами, не «логистика под ключ».',
      badgeTitle: 'PDF · итог',
      badgeText: 'Готово к декларации',
      main: '/landing/assets/ob-2-docs.jpg',
      float: '/landing/assets/ob-1-warehouse.jpg',
      top: '/landing/assets/ob-3-cargo.jpg',
      points: [
        { ico: 'i-file', title: 'PDF как итог', text: 'После подтверждения — коды и платежи в одном документе.' },
        { ico: 'i-shield', title: 'Три тарифа', text: 'Экспресс, Стандарт, Профи — лимиты позиций и глубина проверки.' },
        { ico: 'i-lock', title: 'Доступ по ролям', text: 'Клиент, брокер, админ — своя зона без лишних экранов.' }
      ]
    }
  ];

  let aboutIdx = 0;
  function setAboutTab(i) {
    aboutIdx = i;
    const tab = aboutTabs[i];
    document.querySelectorAll('#aboutPills button').forEach((btn, idx) => {
      btn.classList.toggle('on', idx === i);
    });
    document.getElementById('aboutLead').textContent = tab.lead;
    document.getElementById('aboutBadgeTitle').textContent = tab.badgeTitle;
    document.getElementById('aboutBadgeText').textContent = tab.badgeText;
    const main = document.getElementById('aboutMainImg');
    const fl = document.getElementById('aboutFloatImg');
    const top = document.getElementById('aboutTopImg');
    [main, fl, top].forEach(img => { img.style.opacity = '0'; });
    setTimeout(() => {
      main.src = tab.main; fl.src = tab.float; top.src = tab.top;
      [main, fl, top].forEach(img => { img.style.opacity = '1'; });
    }, 160);
    const points = document.getElementById('aboutPoints');
    points.innerHTML = tab.points.map((p, idx) => `
      <div class="about-point${idx === 0 ? ' on' : ''}">
        <div class="ico"><svg><use href="#${p.ico}"/></svg></div>
        <div><strong>${p.title}</strong><span>${p.text}</span></div>
      </div>`).join('');
    points.querySelectorAll('.about-point').forEach(el => {
      el.addEventListener('mouseenter', () => {
        points.querySelectorAll('.about-point').forEach(x => x.classList.remove('on'));
        el.classList.add('on');
      });
    });
  }
  function cycleAboutVisual() {
    setAboutTab((aboutIdx + 1) % aboutTabs.length);
  }

  function animateAboutStats() {
    const cards = document.querySelectorAll('#aboutStats [data-count], #effectKpis [data-count]');
    cards.forEach(el => {
      if (el.dataset.animated === '1') return;
      el.dataset.animated = '1';
      const target = +el.dataset.count;
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      const div = +(el.dataset.div || 1);
      const start = performance.now();
      const dur = 1100;
      function frame(t) {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = Math.round(target * eased);
        if (div > 1) el.textContent = prefix + Math.round(val / div) + suffix;
        else el.textContent = prefix + val + suffix;
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }
  const aboutIo = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateAboutStats();
        aboutIo.disconnect();
      }
    });
  }, { threshold: 0.35 });
  const aboutStats = document.getElementById('aboutStats');
  if (aboutStats) aboutIo.observe(aboutStats);
  setAboutTab(0);

  const effectModes = {
    before: {
      pill: 'До · 3–5 дней',
      tag: 'Мессенджеры + Excel',
      time: '3–5 дней',
      hint: 'ручной цикл до понятной суммы',
      bar: '92%',
      img: '/landing/assets/ob-2-docs.jpg',
      tone: 'bad',
      items: [
        { tone: 'bad', title: 'Поиск брокера вручную', text: 'Сайты, рекомендации, ожидание ответа' },
        { tone: 'bad', title: 'Переписка в мессенджерах', text: 'Документы теряются между чатами' },
        { tone: 'bad', title: 'Excel и ошибки в кодах', text: 'Пересчёты и спорные ТН ВЭД' },
        { tone: 'bad', title: 'Непрозрачные платежи', text: 'Итог ясен поздно — сюрпризы на границе' }
      ]
    },
    after: {
      pill: 'После · ~30 мин',
      tag: 'AI + живой брокер',
      time: '~30 минут',
      hint: 'цикл от заявки до PDF',
      bar: '12%',
      img: '/landing/assets/product-laptop.jpg',
      tone: 'good',
      items: [
        { tone: 'good', title: 'Одна заявка в приложении', text: 'Документы и товар в одном месте' },
        { tone: 'good', title: 'AI-анализ и расчёт платежей', text: 'ТН ВЭД, пошлина, НДС с пояснением' },
        { tone: 'good', title: 'Подтверждение брокером', text: 'Эксперт проверяет до подачи ДТ' },
        { tone: 'good', title: 'PDF с кодами и платежами', text: 'Итог до оплаты поставщику — без «логистики в 1 клик»' }
      ]
    },
    both: {
      pill: 'Сравнение',
      tag: 'Ручной процесс → платформа',
      time: '5 дней → 30 мин',
      hint: 'сокращение цикла в ~10 раз',
      bar: '38%',
      img: '/landing/assets/ob-3-port.jpg',
      tone: '',
      items: [
        { tone: 'bad', title: 'До: 3–5 дней хаоса', text: 'Чаты, Excel, непрозрачные платежи' },
        { tone: 'good', title: 'После: ~30 минут', text: 'Заявка → AI → брокер → PDF' },
        { tone: 'bad', title: 'До: ошибки в кодах', text: 'Ручная классификация без контроля' },
        { tone: 'good', title: 'После: уверенность + эксперт', text: 'Модель + подтверждение брокера' }
      ]
    }
  };
  const effectOrder = ['before', 'after', 'both'];
  let effectMode = 'after';

  function setEffectMode(mode) {
    effectMode = mode;
    const data = effectModes[mode];
    document.querySelectorAll('#effectTabs button').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.effect === mode);
    });
    const visual = document.getElementById('effectVisual');
    visual.classList.remove('bad', 'good');
    if (data.tone) visual.classList.add(data.tone);
    const img = document.getElementById('effectImg');
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = data.img;
      img.style.opacity = '1';
      img.style.transform = 'scale(1.04)';
      setTimeout(() => { img.style.transform = 'scale(1)'; }, 50);
    }, 160);
    document.getElementById('effectModePill').textContent = data.pill;
    document.getElementById('effectTag').textContent = data.tag;
    document.getElementById('effectTimeLabel').textContent = data.time;
    document.getElementById('effectTimeHint').textContent = data.hint;
    document.getElementById('effectBar').style.width = data.bar;
    document.getElementById('effectList').innerHTML = data.items.map(it => `
      <div class="effect-item ${it.tone}">
        <div class="dot"></div>
        <div>
          <strong>${it.title}</strong>
          <span>${it.text}</span>
        </div>
      </div>`).join('');
  }
  function cycleEffectMode() {
    const i = effectOrder.indexOf(effectMode);
    setEffectMode(effectOrder[(i + 1) % effectOrder.length]);
  }
  setEffectMode('after');

  const effectIo = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateAboutStats();
        effectIo.disconnect();
      }
    });
  }, { threshold: 0.3 });
  const effectKpis = document.getElementById('effectKpis');
  if (effectKpis) effectIo.observe(effectKpis);

  const calcData = {
    laptop: {
      rows: [
        ['Таможенная стоимость', 1620000, 100],
        ['Пошлина 7%', 113400, 18],
        ['НДС 22%', 381348, 55],
        ['Таможенный сбор', 13541, 6]
      ],
      total: 508289,
      confidence: 'Уверенность AI · 97%',
      img: '/landing/assets/product-laptop.jpg',
      tag: 'Китай → Россия · FOB · ноутбуки'
    },
    shoes: {
      rows: [
        ['Таможенная стоимость', 855000, 100],
        ['Пошлина 10%', 85500, 22],
        ['НДС 22%', 206910, 48],
        ['Таможенный сбор', 4924, 5]
      ],
      total: 297334,
      confidence: 'Уверенность AI · 95%',
      img: '/landing/assets/ob-3-cargo.jpg',
      tag: 'Китай → Россия · FOB · обувь'
    },
    parts: {
      rows: [
        ['Таможенная стоимость', 2160000, 100],
        ['Пошлина 5%', 108000, 14],
        ['НДС 22%', 498960, 58],
        ['Таможенный сбор', 13541, 7]
      ],
      total: 620501,
      confidence: 'Уверенность AI · 96%',
      img: '/landing/assets/ob-1-warehouse.jpg',
      tag: 'Китай → Россия · FOB · автозапчасти'
    }
  };

  function animateMoney(el, value) {
    const start = performance.now();
    const from = +(el.dataset.current || 0);
    const dur = 700;
    function frame(t) {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(from + (value - from) * eased);
      el.textContent = formatMoney(val);
      el.dataset.current = val;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function setCalcProduct(key) {
    document.getElementById('calcProduct').value = key;
    document.querySelectorAll('#productPills .product-pill').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.product === key);
    });
    updateExampleCalc();
  }

  function updateExampleCalc() {
    const key = document.getElementById('calcProduct').value;
    const data = calcData[key];
    const img = document.getElementById('calcImg');
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = data.img;
      img.style.opacity = '1';
    }, 150);
    document.getElementById('calcTag').textContent = data.tag;
    document.getElementById('calcConfidence').textContent = data.confidence;
    document.getElementById('calcBreakdown').innerHTML = data.rows
      .map(([a, b, w]) => `
        <div>
          <span>${a}</span>
          <strong>${formatMoney(b)}</strong>
          <div class="bar-mini"><i style="width:0%"></i></div>
        </div>`).join('');
    requestAnimationFrame(() => {
      document.querySelectorAll('#calcBreakdown .bar-mini > i').forEach((bar, i) => {
        bar.style.width = data.rows[i][2] + '%';
      });
    });
    animateMoney(document.getElementById('calcTotal'), data.total);
  }

  function formatMoney(n) {
    return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽';
  }
  updateExampleCalc();

  function calcSavings() {
    const ships = +document.getElementById('shipRange').value;
    const mgrs = +document.getElementById('mgrRange').value;
    const err = +document.getElementById('errRange').value;
    document.getElementById('shipVal').textContent = ships;
    document.getElementById('mgrVal').textContent = mgrs;
    document.getElementById('errVal').textContent = formatMoney(err).replace(' ₽', '');

    const timeSave = ships * 12 * 18000 * mgrs * 0.35;
    const errorSave = ships * 12 * err * 0.18;
    const speedSave = ships * 12 * 9500;
    document.getElementById('saveTotal').textContent = formatMoney(timeSave + errorSave + speedSave);
  }
  calcSavings();

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function simulateUpload() {
    const list = document.getElementById('fileList');
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <svg width="16" height="16" style="color:var(--ok)"><use href="#i-check"/></svg>
      <span class="name">Contract_Addendum.pdf</span>
      <span class="pill ok">OK</span>`;
    list.appendChild(item);
    document.getElementById('docAlert').innerHTML =
      '<strong>Комплект обновлён</strong> Добавлен Contract_Addendum.pdf. Расхождение в сертификате всё ещё требует внимания.';
    toast('Файл загружен и проверен AI Documents');
  }

  const drop = document.getElementById('dropzone');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('drag');
    if (ev === 'drop') simulateUpload();
  }));

  /** Product entry: skip fake lead form → real auth pages (D25). */
  function openModal(mode) {
    if (mode === "demo" || mode === "login") {
      window.location.href = "/login";
      return;
    }
    window.location.href = "/register";
  }
  function closeModal() {
    const modal = document.getElementById("modal");
    if (modal) modal.classList.remove("open");
  }
  function submitModal() {
    window.location.href = "/register";
  }

  function toggleMobile(open) {
    document.getElementById('mobileNav').classList.toggle('open', open);
  }

  window.addEventListener('scroll', () => {
    document.getElementById('header').classList.toggle('scrolled', window.scrollY > 12);
  });

  function selectBroker(card, name) {
    document.querySelectorAll('.person-card').forEach(el => {
      el.classList.remove('selected');
      const btn = el.querySelector('.btn');
      if (btn) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-ghost');
      }
    });
    card.classList.add('selected');
    const btn = card.querySelector('.btn');
    if (btn) {
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-ghost');
    }
    toast(name + ' выбран для заявки');
  }

  (function initFx() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const layer = document.getElementById('fxLayer');
    const cursor = document.getElementById('fxCursor');
    const canvas = document.getElementById('fxCanvas');
    if (!layer) return;

    const items = layer.querySelectorAll('[data-depth]');
    let mx = 0, my = 0, tx = 0, ty = 0, cx = window.innerWidth / 2, cy = window.innerHeight / 2;

    window.addEventListener('mousemove', (e) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
      cx = e.clientX; cy = e.clientY;
      if (cursor && !reduce) {
        cursor.classList.add('on');
        cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      }
    });
    window.addEventListener('mouseleave', () => {
      if (cursor) cursor.classList.remove('on');
    });

    document.addEventListener('click', (e) => {
      if (reduce || e.target.closest('button, a, input, select, textarea, .modal-overlay, .mobile-nav')) return;
      const rip = document.createElement('div');
      rip.className = 'fx-ripple';
      rip.style.left = e.clientX + 'px';
      rip.style.top = e.clientY + 'px';
      layer.appendChild(rip);
      setTimeout(() => rip.remove(), 900);
    });

    if (!reduce) {
      function tick() {
        tx += (mx - tx) * 0.06;
        ty += (my - ty) * 0.06;
        items.forEach(el => {
          const d = parseFloat(el.dataset.depth) || 0.05;
          const rot = el.classList.contains('s1') ? 18 : el.classList.contains('s3') ? -12 : 0;
          el.style.transform = `translate(${tx * d * 90}px, ${ty * d * 70}px)${rot ? ` rotate(${rot}deg)` : ''}`;
        });
        requestAnimationFrame(tick);
      }
      tick();
    }

    document.querySelectorAll('.fx-icon').forEach(icon => {
      icon.style.pointerEvents = 'auto';
      icon.addEventListener('mouseenter', () => { icon.style.opacity = '0.28'; });
      icon.addEventListener('mouseleave', () => { icon.style.opacity = '0.09'; });
    });

    /* Particle network */
    if (canvas && !reduce) {
      const ctx = canvas.getContext('2d');
      let w, h, particles = [];
      function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
      }
      function spawn() {
        particles = Array.from({ length: Math.min(42, Math.floor(w / 40)) }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: 1.2 + Math.random() * 1.6
        }));
      }
      resize(); spawn();
      window.addEventListener('resize', () => { resize(); spawn(); });

      function draw() {
        ctx.clearRect(0, 0, w, h);
        const pullX = cx, pullY = cy;
        particles.forEach((p, i) => {
          const dx = pullX - p.x, dy = pullY - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 220) {
            p.vx += dx / dist * 0.008;
            p.vy += dy / dist * 0.008;
          }
          p.vx *= 0.99; p.vy *= 0.99;
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(43,114,244,0.28)';
          ctx.fill();
          for (let j = i + 1; j < particles.length; j++) {
            const q = particles[j];
            const d = Math.hypot(p.x - q.x, p.y - q.y);
            if (d < 130) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.strokeStyle = `rgba(43,114,244,${0.12 * (1 - d / 130)})`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        });
        requestAnimationFrame(draw);
      }
      draw();
    }

    /* Magnetic primary buttons */
    if (!reduce) {
      document.querySelectorAll('.btn-primary').forEach(btn => {
        btn.classList.add('magnet');
        btn.addEventListener('mousemove', (e) => {
          const r = btn.getBoundingClientRect();
          const x = e.clientX - (r.left + r.width / 2);
          const y = e.clientY - (r.top + r.height / 2);
          btn.style.transform = `translate(${x * 0.12}px, ${y * 0.18}px)`;
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.transform = '';
        });
      });
    }
  })();

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));


  // Expose for inline onclick handlers in markup
  const w = window as any;
  w.selectStep = selectStep;
  w.stepNext = stepNext;
  w.stepPrev = stepPrev;
  w.toggleStepPlay = toggleStepPlay;
  w.setAboutTab = setAboutTab;
  w.cycleAboutVisual = cycleAboutVisual;
  w.setEffectMode = setEffectMode;
  w.cycleEffectMode = cycleEffectMode;
  w.setCalcProduct = setCalcProduct;
  w.calcSavings = calcSavings;
  w.simulateUpload = simulateUpload;
  w.openModal = openModal;
  w.closeModal = closeModal;
  w.submitModal = submitModal;
  w.toggleMobile = toggleMobile;
  w.selectBroker = selectBroker;
  w.toast = toast;

  // Prefer root-scoped queries where IDs live inside root
  // (getElementById still works after mount)

  return () => {
    stopStepPlay?.();
    cleaned.forEach((fn) => fn());
    ["selectStep","stepNext","stepPrev","toggleStepPlay","setAboutTab","cycleAboutVisual","setEffectMode","cycleEffectMode","setCalcProduct","calcSavings","simulateUpload","openModal","closeModal","submitModal","toggleMobile","selectBroker","toast"].forEach((k) => { try { delete w[k]; } catch {} });
  };
}
