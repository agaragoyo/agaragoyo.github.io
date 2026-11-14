// 가구를 가까이 보는 화면(게임기, 라디오, TV, 책장, 코르크 보드). 바탕화면을 어둡게 덮고 가운데에 가구를 크게 보여 준다.
// 바깥(어두운 곳)을 누르거나 아래의 닫기 단추, Esc를 누르면 닫는다. 한 번에 하나만 연다.
// 닫기 단추와 안내는 가구에 맞는 말로 쓴다. 손에 드는 게임기는 "내려놓기"(요구 사항의 "게임기 바깥을 누르면 게임기를 내려놓습니다"),
// TV는 "TV 끄기", 라디오와 책장은 "닫기"다(라디오는 닫아도 음악 창이 남으므로 "끄기"라고 쓰지 않는다).
// 창 층(z-index 20)보다 아래에 깔아서 라디오의 음악 창처럼 옆에 띄우는 OS 창은 그 위에 뜬다.
// 열려 있는 동안 아바타는 키를 받지 않는다(os.js의 active). 바탕화면을 떠나거나 공간을 옮기면 os.js가 바로 닫는다(close(true)).
//
// 가구를 두 번 눌러 열면 판이 그 가구 자리에서 커지며 화면 가운데로 다가오고(0.4초), 닫으면 그 자리로 줄어 돌아간다(0.2초).
// 눌린 것이 그대로 커져 새 화면이 되는 머티리얼 디자인의 컨테이너 변형과, 포인트 앤 클릭 게임이 물건을 확대할 때 작은 그림에서
// 큰 화면으로 넘겨주는 방식을 따랐다. 처음 0.15초는 방의 가구 그림이 판과 같은 길로 커지다 사라지고, 열려 있는 동안 방의 그 가구는 숨긴다.
// 시간과 곡선은 머티리얼 3의 강조 곡선이다. 열기는 화면 안에서 시작해 화면 안에서 끝나는 움직임의 곡선(천천히 출발해 빨라졌다가 길게 멈춘다)이고,
// 닫기는 내려놓듯 천천히 출발해 빨리 사라진다. 처음에 쓴 감속 곡선(화면 밖에서 들어오는 것)은 30ms 만에 절반을 가서 튀어나오듯 보였다.
// 동작 줄이기를 켠 컴퓨터는 움직이지 않는다(reduceMotion). 시작 메뉴처럼 가구 없이 열면 예전처럼 살짝 떠오르기만 한다.
//
//   const cu = openCloseup(os, { key, title, className, closeLabel, closeTip, lift, build(panel, cu) { ...; return 닫을 때 부를 함수 } })
//   lift: true      바닥에 누운 가구(게임기)를 들어 올리듯, 판이 눕혀져 바닥 결대로 돌아간 채 시작해 일어선다
//   cu.onKey = e => {}   창이 앞에 없을 때 받은 키(Esc는 닫기로 먼저 쓴다)
//   cu.frames            게임기처럼 안에 앱(iframe)을 띄우면 [{ iframe, close, setTitle }]. 앱 SDK가 이걸 창처럼 쓴다(src/sdk-host.js)
//   cu.close(true)       움직이지 않고 바로 닫는다
import { h, reduceMotion, isField } from './util.js';

const OPEN = { duration: 400, easing: 'cubic-bezier(0.2, 0, 0, 1)' }; // 머티리얼 3 emphasized
const SHUT = { duration: 200, easing: 'cubic-bezier(0.3, 0, 0.8, 0.15)' }; // 머티리얼 3 emphasized accelerate
const HANDOFF = 150; // 가구 그림이 판에 자리를 넘겨주는 시간
const DIM = '#0d0b14b3'; // style.css의 .closeup 바탕과 같은 색

export function openCloseup(os, { key, title, className = '', closeLabel = '닫기', closeTip = '바깥을 누르면 닫힙니다.', lift = false, build }) {
  os.closeup?.close(true);
  // 가구를 두 번 눌러 열었으면 그 가구의 상자(os.js의 useFurniture가 열기 직전에 넣는다)
  const from = os.closeupFrom?.isConnected ? os.closeupFrom : null;
  os.closeupFrom = null;
  const zoom = !!from && !reduceMotion;
  const panel = h('div', { className: `closeup-panel ${className}`.trim() });
  const foot = h('div', { className: 'closeup-foot' },
    h('span', {}, closeTip),
    h('button', { type: 'button', className: 'btn', onclick: () => cu.close() }, closeLabel));
  const el = h('div', { className: reduceMotion ? 'closeup still' : zoom ? 'closeup zoom' : 'closeup', role: 'dialog', 'aria-label': title, dataset: { key } }, panel, foot);
  const cu = { key, el, panel, frames: [], onKey: null, close };
  let cleanup = null;
  let opening = []; // 열기 움직임(닫을 때 도는 중이면 그 자리에서 이어 닫는다)

  function close(instant) {
    if (os.closeup !== cu) return;
    os.closeup = null;
    window.removeEventListener('keydown', onKey);
    try { cleanup?.(); } finally { leave(instant === true); }
  }
  function onKey(e) {
    if (os.wm.focusedWin() || e.ctrlKey || e.metaKey || e.altKey) return; // 앞에 창이 있으면 그 창의 키다
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isField(e.target)) e.target.blur(); // 쓰던 칸에서 Esc를 누르면 칸만 빠져나온다
      else close();
      return;
    }
    if (!isField(e.target)) cu.onKey?.(e);
  }

  // 가구와 판의 자리(무대 px, .closeup 왼쪽 위 기준). 판은 움직임을 뺀 레이아웃 자리(offset)를 쓰고,
  // 가구는 화면 상자를 무대 배율로 나눈다(무대는 main.js의 fit이 transform으로 늘이고 줄인다)
  function spot() {
    const desk = el.parentElement;
    if (!from?.isConnected || !desk || desk.hidden) return null;
    const d = desk.getBoundingClientRect();
    const f = from.getBoundingClientRect();
    if (!d.width || !f.width) return null;
    const s = d.width / desk.offsetWidth;
    const w = f.width / s, hgt = f.height / s, x = (f.left - d.left) / s, y = (f.top - d.top) / s;
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    const dx = x + w / 2 - (panel.offsetLeft + pw / 2), dy = y + hgt / 2 - (panel.offsetTop + ph / 2);
    const k = Math.min(1, Math.sqrt((w * hgt) / (pw * ph))); // 가구 상자와 넓이가 같아지는 배율
    // 바닥에 누운 가구는 판을 60도 눕히고 바닥의 결(가로 2:세로 1 아이소메트릭이라 27도)대로 돌린 채 시작한다
    const turn = from.querySelector('img.mirror') ? -27 : 27;
    return {
      x, y, w, h: hgt, dx, dy, k,
      small: `translate(${dx}px, ${dy}px) scale(${k})` + (lift ? ` perspective(1600px) rotateZ(${turn}deg) rotateX(60deg)` : ''),
      full: 'translate(0px, 0px) scale(1)' + (lift ? ' perspective(1600px) rotateZ(0deg) rotateX(0deg)' : ''),
    };
  }

  function zoomIn() {
    const o = spot();
    if (!o) return;
    from.style.visibility = 'hidden'; // 판이 된 가구는 방에서 숨긴다(닫으면 돌아온다)
    opening = [
      panel.animate([{ transform: o.small }, { transform: o.full }], OPEN),
      panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: HANDOFF, easing: 'linear' }),
      el.animate([{ backgroundColor: 'transparent' }, { backgroundColor: DIM }], { duration: 250, easing: 'ease-out' }),
      foot.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: OPEN.duration }),
    ];
    const pic = from.querySelector('img');
    if (!pic) return;
    // 방의 가구 그림이 판과 같은 길로 커지다 사라진다(판의 가운데와 넓이를 그대로 따라간다)
    const ghost = h('div', { className: 'closeup-ghost' }, h('img', { src: pic.currentSrc || pic.src, alt: '', className: pic.className }));
    Object.assign(ghost.style, { left: `${o.x}px`, top: `${o.y}px`, width: `${o.w}px`, height: `${o.h}px` });
    el.append(ghost);
    ghost.animate([{ transform: 'translate(0px, 0px) scale(1)' }, { transform: `translate(${-o.dx}px, ${-o.dy}px) scale(${1 / o.k})` }], OPEN);
    const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: HANDOFF, easing: 'linear', fill: 'forwards' });
    fade.finished.then(() => ghost.remove(), () => ghost.remove());
  }

  function leave(instant) {
    const o = zoom && !instant ? spot() : null;
    const done = () => {
      el.remove();
      if (from) from.style.visibility = '';
    };
    if (!o) return done();
    // 닫히는 동안에는 누를 수 없고, 열린 화면으로 세지 않는다(querySelector('.closeup')로 찾는 점검 도구와 다른 화면)
    el.inert = true;
    el.classList.replace('closeup', 'closeup-out');
    for (const f of el.querySelectorAll('iframe')) f.remove(); // 게임과 영상 소리를 바로 멈춘다
    el.querySelector('.closeup-ghost')?.remove();
    for (const a of opening) {
      if (a.playState === 'running') a.commitStyles(); // 열리던 중이면 지금 자리에서 이어 닫는다
      a.cancel();
    }
    foot.animate([{ opacity: 0 }], { duration: 100, fill: 'forwards' });
    el.animate([{ backgroundColor: 'transparent' }], { ...SHUT, fill: 'forwards' });
    panel.animate([{ transform: o.small, opacity: 0 }], { ...SHUT, fill: 'forwards' }).finished.then(done, done);
  }

  // 바깥(어두운 바탕)만 닫는다. 패널 안이나 아래 줄을 누른 것은 그대로 둔다
  el.addEventListener('click', e => { if (e.target === el) close(); });
  window.addEventListener('keydown', onKey);
  os.wm.blur(); // 창을 앞에 두지 않아야 키가 이 화면으로 온다
  // 떠 있던 알림은 걷는다. 알림은 화면 아래 가운데에 떠서 이 화면의 아래쪽 단추 줄을 가린다. 손님으로 들어온 직후의
  // "가구를 두 번 눌러 사용해 보세요"(6초)가 바로 그 가구 화면을 가렸다. 이 화면 안에서 띄우는 알림(지우지 못했습니다 등)은 그 뒤에 뜬다
  os.hideToast();
  os.closeup = cu;
  os.stage.querySelector('#desktop').append(el);
  cleanup = build(panel, cu);
  if (zoom) zoomIn();
  return cu;
}
