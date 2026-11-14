// 창 관리자. 옛 OS 모양 창을 열고, 끌어 옮기고, 최소화, 최대화, 닫는다.
// 작업 표시줄 버튼도 여기서 만든다. 바탕화면 좌표(1280×800) 안에서 움직인다.
import { DESK_W, DESK_H } from './config.js';
import { iconEl } from './icons.js';
import { clamp, doubleClick } from './util.js';
// 창 안쪽(body) 크기에 더하면 바깥 크기가 되는 테두리, 제목 줄 몫 (style.css의 .win과 맞춘다)
export const CHROME_W = 14;
export const CHROME_H = 47;

// onVisible(창, 보이는지): 창을 최소화하거나 다시 띄울 때 불린다. 앱(iframe)에 알리는 일은 src/sdk-host.js가 한다
export function createWM({ layer, tasks, toLocal, onChange = () => {}, onVisible = () => {} }) {
  const wins = new Map(); // key -> win
  let topZ = 1;
  let cascade = 0;
  let focused = null;

  // 창을 놓을 수 있는 곳: 바탕화면 전체
  function area() {
    return { x: 0, y: 0, w: DESK_W, h: DESK_H };
  }

  // 앞서 쓰던 앱(iframe)의 키보드 초점을 거둔다. win을 주면 그 창 안의 앱은 그대로 둔다.
  // 제목 줄 끌기는 브라우저의 초점 이동을 막아서, 다른 곳을 눌러도 키가 앱으로 계속 들어간다(known-issues 36).
  function releaseFrame(win) {
    const a = document.activeElement;
    if (a?.tagName === 'IFRAME' && !win?.el.contains(a)) a.blur();
  }

  function focus(win) {
    if (win.minimized) restore(win);
    releaseFrame(win);
    focused = win;
    win.el.style.zIndex = ++topZ;
    for (const w of wins.values()) w.el.classList.toggle('inactive', w !== win);
    syncTasks();
  }

  // 바탕화면을 누르면 어느 창도 앞에 두지 않는다. 그동안 키는 바탕화면(아바타)이 받는다.
  function blur() {
    releaseFrame();
    if (!focused) return;
    focused = null;
    for (const w of wins.values()) w.el.classList.add('inactive');
    syncTasks();
  }

  function minimize(win) {
    win.minimized = true;
    win.el.hidden = true;
    onVisible(win, false);
    if (focused === win) {
      focused = [...wins.values()].filter(w => !w.minimized).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0] || null;
      if (focused) focus(focused);
      else releaseFrame();
    }
    syncTasks();
    onChange();
  }

  function restore(win) {
    win.minimized = false;
    win.el.hidden = false;
    onVisible(win, true);
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
    const twice = doubleClick();
    bar.addEventListener('pointerdown', e => {
      if (e.target.closest('.win-btn')) return; // 제목 줄 단추는 끌기와 두 번 누르기에서 뺀다
      if (twice(bar)) { setMax(win, !win.maximized); return; }
      if (!win.maximized) dragWindow(win, e);
    });

    if (maximized) setMax(win, true);
    win.cleanup = build?.(body, win);
    focus(win);
    onChange();
    return win;
  }

  // iframe 앱 안을 누르면 이 문서에는 pointerdown이 오지 않아 창이 앞으로 나오지 않는다.
  // 대신 키보드 초점이 앱으로 넘어가면서 이 문서의 window에 blur가 오므로, 그때 그 앱의 창을 앞으로 가져온다(known-issues 36).
  window.addEventListener('blur', () => setTimeout(() => {
    const frame = document.activeElement;
    if (frame?.tagName !== 'IFRAME') return;
    const win = [...wins.values()].find(w => w.el.contains(frame));
    if (win && win !== focused) focus(win);
  }));

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
    blur,
    focusedWin: () => focused,
    get: key => wins.get(key),
    all: () => [...wins.values()],
    closeAll: () => { for (const w of [...wins.values()]) close(w); },
  };
}
