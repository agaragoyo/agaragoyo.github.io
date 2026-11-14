// 아가라고요 앱 SDK. 앱 페이지에서 <script src="../aga-sdk.js"></script> 로 불러온다.
// 아가라고요 바깥에서 페이지를 혼자 열어도 오류 없이 동작한다 (AGA.inOS 가 false).
//
//   AGA.inOS            아가라고요 창 안에서 열렸는지
//   AGA.id              내 앱 id (apps/<id>/ 폴더 이름)
//   AGA.close()         내 창을 닫는다
//   AGA.setTitle(글자)   창 제목을 바꾼다
//   AGA.info()          { owner: 방 주인 닉네임, visitor: 친구 컴퓨터를 구경 중인지 } 를 Promise로 준다
//   AGA.load(이름, 기본값) / AGA.save(이름, 값)
//                       이 컴퓨터에 기록을 남기고 읽는다. 키 앞에 '<id>.'가 저절로 붙어서 다른 앱과 섞이지 않는다
//                       (AGA.save('best', 12) 는 localStorage 'tidy-up.best'). 값은 숫자, 글자, 배열, 객체 다 된다
//   AGA.fitCanvas(캔버스, 자리, 가로, 세로)
//                       게임판을 자리(부모 요소)에 꽉 차게 맞춘다. 그리기는 늘 가로×세로 게임 단위로 하면 된다.
//                       창 크기가 바뀌면 저절로 다시 맞추고, 스크롤바 진동과 흐릿함(known-issues 12, 14)을 피한다.
//                       돌려주는 board.point(이벤트)는 마우스 위치를 게임 단위 { x, y } 로 바꿔 준다
//   AGA.gameCard(캔버스, { title, how, demo, extra, colors })
//                       게임판 위에 시작 카드(게임 이름, 조작 안내 한 문장, 되풀이되는 시범 그림, 단추)를 띄운다.
//                       card.open({ note, rows }) 로 열고 card.close() 로 닫는다. card.isOpen 동안 게임은 멈춘다.
//                       card.tip(글, { at, onSkip }) 은 판 위에 한 줄 안내와 건너뛰기 단추를 띄운다(card.tip(null) 로 숨김).
//                       자세한 쓰는 법은 아래 gameCard 함수 위의 설명과 apps/README.md
//
// 커서: 아가라고요 창 안에서는 페이지 기본 커서가 그 시절 모양의 화살표로 바뀐다. 버튼 같은 곳에 손가락을 쓰려면
//   cursor: var(--aga-hand, pointer);   처럼 쓴다(--aga-arrow, --aga-grab, --aga-grabbing, --aga-wait 도 있다).
//   혼자 열었을 때는 변수가 없어서 뒤에 적은 기본 커서가 나온다.
(function () {
  const host = window.parent !== window ? window.parent : null;
  const send = msg => host && host.postMessage({ aga: 1, ...msg }, '*');
  const id = (location.pathname.match(/\/apps\/([^/]+)\//) || [])[1] || '';
  let info = null;
  const waiting = [];

  window.addEventListener('message', e => {
    if (e.source !== host || !e.data || e.data.aga !== 1) return;
    if (e.data.type === 'info') {
      info = e.data.info;
      waiting.splice(0).forEach(resolve => resolve(info));
    }
    if (e.data.type === 'cursor') applyCursor(e.data.cursor || {});
  });

  function applyCursor(set) {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(set)) if (v) root.style.setProperty(`--aga-${k}`, v);
    if (!document.getElementById('aga-cursor')) {
      const style = document.createElement('style');
      style.id = 'aga-cursor';
      // :where 로 우선순위를 0으로 둬서, 앱이 직접 적은 커서가 항상 이긴다.
      style.textContent = ':where(html) { cursor: var(--aga-arrow, auto); }';
      document.head.append(style);
    }
  }
  if (host) send({ type: 'cursor' });

  // 기록 남기기. 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도 오류 없이 기본값을 준다.
  const key = name => `${id || 'app'}.${name}`;
  function load(name, fallback = null) {
    try {
      const raw = localStorage.getItem(key(name));
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  }
  function save(name, value) {
    try { localStorage.setItem(key(name), JSON.stringify(value)); } catch { /* 저장소를 못 쓰는 환경 */ }
  }

  // 게임판 맞추기. 크기를 정수로 내리고, 크기가 그대로면 다시 맞추지 않는다(소수점 차이로 끝없이 다시 맞추는 일을 막는다).
  // 페이지에는 html, body { overflow: hidden } 을 같이 둔다(스크롤바가 생겼다 사라지며 떨리는 일을 막는다).
  function fitCanvas(canvas, box, W, H) {
    const ctx = canvas.getContext('2d');
    const board = {
      scale: 1,
      point(e) {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) / (r.width / W), y: (e.clientY - r.top) / (r.height / H) };
      },
    };
    let last = '';
    const fit = () => {
      const size = `${box.clientWidth}x${box.clientHeight}`;
      if (size === last) return;
      last = size;
      board.scale = Math.min(box.clientWidth / W, box.clientHeight / H);
      const dpr = window.devicePixelRatio || 1;
      const cssW = Math.floor(W * board.scale);
      const cssH = Math.floor(H * board.scale);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    };
    new ResizeObserver(fit).observe(box);
    fit();
    return board;
  }

  // ---------- 시작 카드와 첫 판 안내 ----------
  // 창을 열면 판 위에 카드를 띄워 무엇을 하는 게임인지 먼저 보여 준다(2000년대 플래시 게임의 제목 화면, 워들의 방법 카드).
  //
  //   const card = AGA.gameCard(cv, {
  //     title: '짐 정리',
  //     how: '같은 물건끼리 닿게 떨어뜨려 보세요.',            조작 안내 한 문장(해요체 권유)
  //     demo: { width: 240, height: 100, period: 2600,        시범 그림. draw(ctx, t)는 t = 0..period(ms)로 되풀이해 불린다
  //             draw(ctx, t) { ... } },                        그리기 단위는 width×height
  //     extra: 요소,                                           (선택) 시범 그림 아래에 넣을 것(예: 물건 순서 한 줄)
  //     colors: { bg, fg, accent, line },                     (선택) 카드 색
  //     onOpen() {}, onClose() {},                             (선택) 카드가 뜨고 닫힐 때. 시계를 멈추고 다시 돌리는 데 쓴다
  //   });
  //   card.open({
  //     note: '최고 120점',                                    (선택) 기록 한 줄
  //     rows: [{ label: '새 판', buttons: [{ text: '게임 시작', sub: '100초', pressed: true, onClick() {} }] }],
  //     onEscape() {},                                         (선택) Esc를 누르면 부를 것(예: 이어서 하기)
  //   });
  //   단추를 누르면 카드가 닫힌 뒤 onClick이 불린다. 카드는 판(캔버스) 크기를 넘지 않게 줄어든다.
  //
  //   card.tip('눌러서 떨어뜨려요', { at: 0.3, onSkip() {} })   판 높이의 at(0 위 ~ 1 아래) 자리에 한 줄 안내. 안내는 클릭을 가리지 않는다
  //   card.tip(null)                                           안내를 숨긴다
  const CARD_CSS = `
    .aga-layer { position: absolute; z-index: 5; display: grid; place-items: center; pointer-events: none; }
    .aga-layer.open { pointer-events: auto; background: rgba(0, 0, 0, 0.4); }
    .aga-card {
      box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 14px 14px 16px; border: 3px solid var(--aga-card-line); border-radius: 6px;
      background: var(--aga-card-bg); color: var(--aga-card-fg); text-align: center; transform-origin: center;
      box-shadow: 0 6px 0 rgba(0, 0, 0, 0.25);
    }
    .aga-card[hidden] { display: none; }
    .aga-card h2 { margin: 0; font-size: 22px; font-weight: 400; }
    .aga-card p { margin: 0; font-size: 13px; line-height: 1.5; word-break: keep-all; }
    .aga-card canvas { display: block; max-width: 100%; height: auto; border-radius: 4px; }
    .aga-card .aga-note { font-size: 13px; opacity: 0.85; }
    .aga-card .aga-row { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
    .aga-card .aga-row-label { flex-basis: 100%; font-size: 12px; opacity: 0.8; }
    .aga-card button {
      min-height: 36px; padding: 4px 14px; font: inherit; font-size: 15px; border: 2px solid var(--aga-card-line);
      border-radius: 4px; background: var(--aga-card-bg); color: var(--aga-card-fg); cursor: var(--aga-hand, pointer);
      display: inline-flex; flex-direction: column; justify-content: center; align-items: center; line-height: 1.25;
    }
    .aga-card button.main { background: var(--aga-card-accent); color: var(--aga-card-on-accent); }
    .aga-card button small { font-size: 11px; opacity: 0.85; }
    .aga-card button:focus-visible { outline: 2px solid var(--aga-card-accent); outline-offset: 2px; }
    .aga-tip {
      position: absolute; left: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 8px;
      padding: 4px 6px 4px 12px; border: 2px solid var(--aga-card-line); border-radius: 4px; white-space: nowrap;
      background: var(--aga-card-bg); color: var(--aga-card-fg); font-size: 14px; box-shadow: 0 3px 0 rgba(0, 0, 0, 0.25);
    }
    .aga-tip[hidden] { display: none; }
    .aga-tip button { pointer-events: auto; font: inherit; font-size: 12px; padding: 2px 8px; cursor: var(--aga-hand, pointer); }
  `;

  function gameCard(canvas, opt) {
    if (!document.getElementById('aga-card-css')) {
      const style = document.createElement('style');
      style.id = 'aga-card-css';
      style.textContent = CARD_CSS;
      document.head.append(style);
    }
    const make = (tag, cls, text) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text != null) el.textContent = text;
      return el;
    };
    const box = canvas.parentElement;
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    const layer = make('div', 'aga-layer');
    const c = { bg: '#fdf6e3', fg: '#2a211d', accent: '#e07a5f', line: '#2a211d', onAccent: '#fff', ...opt.colors };
    // CSS 변수는 Object.assign으로 넣으면 조용히 빠진다(known-issues 50). setProperty로 넣는다
    for (const [k, v] of Object.entries({ '--aga-card-bg': c.bg, '--aga-card-fg': c.fg, '--aga-card-accent': c.accent, '--aga-card-line': c.line, '--aga-card-on-accent': c.onAccent })) {
      layer.style.setProperty(k, v);
    }

    const card = make('div', 'aga-card');
    card.hidden = true;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', opt.title);
    card.append(make('h2', '', opt.title), make('p', '', opt.how));
    let demoCtx = null;
    const demo = opt.demo;
    if (demo) {
      const dc = make('canvas');
      const dpr = window.devicePixelRatio || 1;
      dc.width = Math.round(demo.width * dpr);
      dc.height = Math.round(demo.height * dpr);
      dc.style.width = demo.width + 'px'; // 높이는 비율대로 따라온다(카드가 좁으면 시범 그림도 줄어든다)
      demoCtx = dc.getContext('2d');
      demoCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      card.append(dc);
    }
    if (opt.extra) card.append(opt.extra);
    const note = make('div', 'aga-note');
    const rowsBox = make('div');
    rowsBox.style.cssText = 'display: grid; gap: 8px;';
    card.append(note, rowsBox);

    const tip = make('div', 'aga-tip');
    tip.hidden = true;
    const tipText = make('span');
    const skip = make('button', '', '건너뛰기');
    skip.type = 'button';
    tip.append(tipText, skip);
    let onSkip = null;
    skip.addEventListener('click', () => { const f = onSkip; api.tip(null); if (f) f(); });

    layer.append(card, tip);
    box.append(layer);

    // 카드를 판 크기에 맞춘다. 너비는 판의 78%까지, 그래도 높이가 넘치면 통째로 줄인다.
    const naturalW = opt.width || 300;
    const fit = () => {
      Object.assign(layer.style, {
        left: canvas.offsetLeft + 'px', top: canvas.offsetTop + 'px',
        width: canvas.offsetWidth + 'px', height: canvas.offsetHeight + 'px',
      });
      if (card.hidden) return;
      card.style.transform = '';
      card.style.width = Math.min(naturalW, Math.floor(canvas.offsetWidth * 0.78)) + 'px';
      const room = canvas.offsetHeight - 12;
      if (card.offsetHeight > room) card.style.transform = `scale(${room / card.offsetHeight})`;
    };
    new ResizeObserver(fit).observe(canvas);
    new ResizeObserver(fit).observe(box);

    let raf = 0;
    const t0 = performance.now();
    const tick = now => {
      raf = requestAnimationFrame(tick);
      demoCtx.clearRect(0, 0, demo.width, demo.height);
      demo.draw(demoCtx, (now - t0) % demo.period);
    };

    let escape = null;
    window.addEventListener('keydown', e => {
      if (api.isOpen && e.key === 'Escape' && escape) { e.preventDefault(); const f = escape; api.close(); f(); }
    });

    const api = {
      isOpen: false,
      open(view = {}) {
        note.textContent = view.note || '';
        note.hidden = !view.note;
        escape = view.onEscape || null;
        rowsBox.replaceChildren();
        let first = null;
        for (const row of view.rows || []) {
          const r = make('div', 'aga-row');
          if (row.label) r.append(make('span', 'aga-row-label', row.label));
          for (const b of row.buttons) {
            const btn = make('button', b.main ? 'main' : '');
            btn.type = 'button';
            btn.append(b.text);
            if (b.sub) btn.append(make('small', '', b.sub));
            if (b.pressed != null) btn.setAttribute('aria-pressed', String(!!b.pressed));
            btn.addEventListener('click', () => { api.close(); b.onClick(); });
            r.append(btn);
            if (!first || (b.main && !first.classList.contains('main'))) first = btn; // 처음 초점은 main 단추, 없으면 첫 단추
          }
          rowsBox.append(r);
        }
        const was = api.isOpen;
        api.isOpen = true;
        card.hidden = false;
        layer.classList.add('open');
        fit();
        if (demo && !raf) raf = requestAnimationFrame(tick);
        if (first) first.focus({ preventScroll: true });
        if (!was && opt.onOpen) opt.onOpen();
      },
      close() {
        if (!api.isOpen) return;
        api.isOpen = false;
        card.hidden = true;
        layer.classList.remove('open');
        cancelAnimationFrame(raf);
        raf = 0;
        if (opt.onClose) opt.onClose();
      },
      tip(text, o = {}) {
        tip.hidden = !text;
        if (!text) { onSkip = null; return; }
        tipText.textContent = text;
        tip.style.top = (o.at ?? 0.5) * 100 + '%';
        onSkip = o.onSkip || null;
      },
    };
    return api;
  }

  window.AGA = {
    inOS: !!host,
    id,
    close: () => (host ? send({ type: 'close' }) : window.close()),
    setTitle: title => send({ type: 'title', title: String(title) }),
    info() {
      if (info) return Promise.resolve(info);
      if (!host) return Promise.resolve({ owner: '', visitor: false });
      return new Promise(resolve => {
        waiting.push(resolve);
        send({ type: 'hello' });
        // 바깥이 아가라고요가 아니면(다른 사이트에 임베드된 경우) 답이 오지 않으므로 기본값으로 끝낸다.
        setTimeout(() => resolve(info || { owner: '', visitor: false }), 1000);
      });
    },
    load,
    save,
    fitCanvas,
    gameCard,
  };
})();
