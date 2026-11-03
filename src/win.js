// 창 관리자. 옛 OS 모양 창을 열고, 끌어 옮기고, 최소화, 최대화, 닫는다.
// 작업 표시줄 버튼도 여기서 만든다. 바탕화면 좌표(1280×800) 안에서 움직인다.
import { DESK_W, DESK_H, DOUBLE_CLICK_MS } from './config.js';
import { iconEl } from './icons.js';
// 창 안쪽(body) 크기에 더하면 바깥 크기가 되는 테두리, 제목 줄 몫 (style.css의 .win과 맞춘다)
export const CHROME_W = 14;
export const CHROME_H = 47;
const NO_INSET = { top: 0, right: 0, bottom: 0, left: 0 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// inset: 바탕화면 가장자리에서 창을 두지 않을 여백을 돌려주는 함수. 볼록 화면처럼 가장자리가 잘 안 보일 때 os.js가 준다.
export function createWM({ layer, tasks, toLocal, onChange = () => {}, inset = () => NO_INSET }) {
  const wins = new Map(); // key -> win
  let topZ = 1;
  let cascade = 0;
  let focused = null;
  let lastInset = '';

  // 창을 놓을 수 있는 곳: 바탕화면에서 여백을 뺀 영역
  function area() {
    const i = inset() || NO_INSET;
    return { x: i.left, y: i.top, w: DESK_W - i.left - i.right, h: DESK_H - i.top - i.bottom };
  }

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
      fill(win);
    } else if (win.prev) {
      Object.assign(win.el.style, win.prev);
    }
    onChange();
  }

  function fill(win) {
    const a = area();
    Object.assign(win.el.style, { left: a.x + 'px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px' });
  }

  // 여백이 바뀌면(볼록 효과를 켜고 끌 때) 열린 창을 영역 안으로 다시 넣는다. 여백이 그대로면 아무것도 하지 않는다.
  function fit() {
    const key = JSON.stringify(inset() || NO_INSET);
    if (key === lastInset) return;
    lastInset = key;
    const a = area();
    for (const win of wins.values()) {
      if (win.maximized) { fill(win); continue; }
      const s = win.el.style;
      const w = Math.min(parseFloat(s.width), a.w);
      const h = Math.min(parseFloat(s.height), a.h);
      Object.assign(s, {
        width: w + 'px',
        height: h + 'px',
        left: clamp(parseFloat(s.left), a.x, a.x + a.w - w) + 'px',
        top: clamp(parseFloat(s.top), a.y, a.y + a.h - h) + 'px',
      });
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

    const a = area();
    lastInset = JSON.stringify(inset() || NO_INSET);
    const w = Math.min(width + CHROME_W, a.w);
    const h = Math.min(height + CHROME_H, a.h);
    const offset = (cascade++ % 6) * 28;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = clamp(Math.round((DESK_W - w) / 2) - 60 + offset, a.x, a.x + a.w - w) + 'px';
    el.style.top = clamp(Math.round((DESK_H - h) / 2) - 50 + offset, a.y, a.y + a.h - h) + 'px';
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
    const minTop = area().y;
    document.body.classList.add('moving-window');
    const move = ev => {
      const p = toLocal(ev.clientX, ev.clientY);
      // 제목 줄이 화면 밖으로 완전히 나가지 않게 붙잡아 둔다.
      const left = Math.max(80 - win.el.offsetWidth, Math.min(DESK_W - 80, left0 + p.x - start.x));
      const top = Math.max(minTop, Math.min(DESK_H - 30, top0 + p.y - start.y));
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
    fit,
    get: key => wins.get(key),
    all: () => [...wins.values()],
    closeAll: () => { for (const w of [...wins.values()]) close(w); },
  };
}
