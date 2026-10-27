// 창 관리자. 옛 OS 모양 창을 열고, 끌어 옮기고, 최소화, 최대화, 닫는다.
// 작업 표시줄 버튼도 여기서 만든다. 바탕화면 좌표(1280×800) 안에서 움직인다.
import { iconEl } from './icons.js';

const DESK_W = 1280;
const DESK_H = 800;
const DOUBLE_CLICK_MS = 400;
// 창 안쪽(body) 크기에 더하면 바깥 크기가 되는 테두리, 제목 줄 몫 (style.css의 .win과 맞춘다)
export const CHROME_W = 14;
export const CHROME_H = 47;

export function createWM({ layer, tasks, toLocal, onChange = () => {} }) {
  const wins = new Map(); // key -> win
  let topZ = 1;
  let cascade = 0;
  let focused = null;

  function focus(win) {
    if (win.minimized) restore(win);
    focused = win;
    win.el.style.zIndex = ++topZ;
    for (const w of wins.values()) w.el.classList.toggle('inactive', w !== win);
    syncTasks();
  }

  function minimize(win) {
    win.minimized = true;
    win.el.hidden = true;
    if (focused === win) {
      focused = [...wins.values()].filter(w => !w.minimized).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0] || null;
      if (focused) focus(focused);
    }
    syncTasks();
    onChange();
  }

  function restore(win) {
    win.minimized = false;
    win.el.hidden = false;
    onChange();
  }

  function setMax(win, on) {
    win.maximized = on;
    win.el.classList.toggle('maximized', on);
    if (on) {
      win.prev = { left: win.el.style.left, top: win.el.style.top, width: win.el.style.width, height: win.el.style.height };
      Object.assign(win.el.style, { left: '0px', top: '0px', width: DESK_W + 'px', height: DESK_H + 'px' });
    } else if (win.prev) {
      Object.assign(win.el.style, win.prev);
    }
    onChange();
  }

  function close(win) {
    if (typeof win.cleanup === 'function') win.cleanup();
    win.onClose?.();
    win.el.remove();
    win.task.remove();
    wins.delete(win.key);
    if (focused === win) {
      focused = null;
      const next = [...wins.values()].filter(w => !w.minimized).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
      if (next) focus(next);
    }
    onChange();
  }

  function syncTasks() {
    for (const w of wins.values()) {
      w.task.classList.toggle('active', w === focused && !w.minimized);
    }
  }

  // width, height: 창 안쪽 크기. key 가 같은 창이 열려 있으면 새로 열지 않고 앞으로 가져온다.
  function open({ key, title, app = {}, width = 420, height = 260, maximized = false, flush = false, build, onClose }) {
    if (wins.has(key)) { focus(wins.get(key)); return wins.get(key); }

    const el = document.createElement('div');
    el.className = 'win';
    const bar = document.createElement('div');
    bar.className = 'win-bar';
    const name = document.createElement('span');
    name.className = 'win-title';
    name.textContent = title;
    const btns = document.createElement('span');
    btns.className = 'win-btns';
    const mk = (cls, label, text) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `win-btn ${cls}`;
      b.setAttribute('aria-label', label);
      b.textContent = text;
      b.addEventListener('pointerdown', e => e.stopPropagation());
      btns.append(b);
      return b;
    };
    const bMin = mk('win-min', '최소화', '_');
    const bMax = mk('win-max', '최대화', '□');
    const bClose = mk('win-close', '닫기', '×');
    bar.append(iconEl(app, 16), name, btns);
    const body = document.createElement('div');
    body.className = flush ? 'win-body flush' : 'win-body';
    el.append(bar, body);

    const w = Math.min(width + CHROME_W, DESK_W);
    const h = Math.min(height + CHROME_H, DESK_H);
    const offset = (cascade++ % 6) * 28;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = Math.max(0, Math.round((DESK_W - w) / 2) - 60 + offset) + 'px';
    el.style.top = Math.max(0, Math.round((DESK_H - h) / 2) - 50 + offset) + 'px';
    layer.append(el);

    const task = document.createElement('button');
    task.type = 'button';
    task.className = 'task';
    const taskName = document.createElement('span');
    taskName.textContent = title;
    task.append(iconEl(app, 16), taskName);
    tasks.append(task);

    const win = { key, el, body, task, minimized: false, maximized: false, onClose };
    win.close = () => close(win);
    win.focus = () => focus(win);
    win.setTitle = t => { name.textContent = t; taskName.textContent = t; };
    wins.set(key, win);

    bClose.addEventListener('click', win.close);
    bMin.addEventListener('click', () => minimize(win));
    bMax.addEventListener('click', () => setMax(win, !win.maximized));
    task.addEventListener('click', () => {
      if (win === focused && !win.minimized) minimize(win);
      else focus(win);
    });
    el.addEventListener('pointerdown', () => { if (focused !== win) focus(win); });
    let lastBarClick = 0;
    bar.addEventListener('pointerdown', e => {
      const now = performance.now();
      if (now - lastBarClick < DOUBLE_CLICK_MS) { setMax(win, !win.maximized); lastBarClick = 0; return; }
      lastBarClick = now;
      if (!win.maximized) dragWindow(win, e);
    });

    if (maximized) setMax(win, true);
    win.cleanup = build?.(body, win);
    focus(win);
    onChange();
    return win;
  }

  function dragWindow(win, e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = toLocal(e.clientX, e.clientY);
    const left0 = win.el.offsetLeft;
    const top0 = win.el.offsetTop;
    document.body.classList.add('moving-window');
    const move = ev => {
      const p = toLocal(ev.clientX, ev.clientY);
      // 제목 줄이 화면 밖으로 완전히 나가지 않게 붙잡아 둔다.
      const left = Math.max(80 - win.el.offsetWidth, Math.min(DESK_W - 80, left0 + p.x - start.x));
      const top = Math.max(0, Math.min(DESK_H - 30, top0 + p.y - start.y));
      win.el.style.left = left + 'px';
      win.el.style.top = top + 'px';
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('moving-window');
      onChange();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return {
    open,
    get: key => wins.get(key),
    all: () => [...wins.values()],
    closeAll: () => { for (const w of [...wins.values()]) close(w); },
  };
}
