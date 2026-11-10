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
  };
})();
