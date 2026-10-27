// 옛 OS 모양 창. 가구를 누르면 열리고, 제목 줄을 끌어 옮기고, ×로 닫는다.
// 나중에 미니게임과 가구 기믹은 build(body) 안에서 창 안쪽을 채운다.
import { STAGE_W, STAGE_H } from './config.js';

const open = new Map(); // key -> { win, close }
let topZ = 1;
let cascade = 0;

function focus(win) {
  for (const { win: w } of open.values()) w.classList.add('inactive');
  win.classList.remove('inactive');
  win.style.zIndex = ++topZ;
}

// key 가 같은 창이 이미 열려 있으면 새로 열지 않고 앞으로 가져온다.
export function openWindow(app, { key, title, width = 420, build }) {
  if (open.has(key)) { focus(open.get(key).win); return; }

  const win = document.createElement('div');
  win.className = 'win';
  win.style.width = width + 'px';
  const bar = document.createElement('div');
  bar.className = 'win-bar';
  const name = document.createElement('span');
  name.textContent = title;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'win-close';
  x.setAttribute('aria-label', '닫기');
  x.textContent = '×';
  bar.append(name, x);
  const body = document.createElement('div');
  body.className = 'win-body';
  win.append(bar, body);
  app.winLayer.append(win);

  const cleanup = build?.(body);
  const offset = (cascade++ % 6) * 30;
  win.style.left = Math.round((STAGE_W - width) / 2) - 75 + offset + 'px';
  win.style.top = 110 + offset + 'px';

  const close = () => {
    if (typeof cleanup === 'function') cleanup();
    win.remove();
    open.delete(key);
  };
  x.addEventListener('click', close);
  x.addEventListener('pointerdown', e => e.stopPropagation());
  win.addEventListener('pointerdown', () => focus(win));
  bar.addEventListener('pointerdown', e => dragWindow(app, win, e));

  open.set(key, { win, close });
  focus(win);
}

export function closeAllWindows() {
  for (const { close } of [...open.values()]) close();
}

function dragWindow(app, win, e) {
  if (e.button !== 0) return;
  e.preventDefault();
  const start = app.toLocal(e.clientX, e.clientY);
  const left0 = win.offsetLeft;
  const top0 = win.offsetTop;
  const move = ev => {
    const p = app.toLocal(ev.clientX, ev.clientY);
    // 제목 줄이 화면 밖으로 완전히 나가지 않게 붙잡아 둔다.
    const left = Math.max(80 - win.offsetWidth, Math.min(STAGE_W - 80, left0 + p.x - start.x));
    const top = Math.max(0, Math.min(STAGE_H - 40, top0 + p.y - start.y));
    win.style.left = left + 'px';
    win.style.top = top + 'px';
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
