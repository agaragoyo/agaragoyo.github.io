// 방 안을 걸어 다니는 내 아바타(1단계: 서버 없이 내 화면에서만 움직인다).
// 아바타는 1×1칸짜리 움직이는 가구처럼 다룬다. 칸 좌표에 서 있고, 가구와 같은 층(.items)에 그려서
// 가구와 앞뒤 순서를 맞춘다. 바닥을 누르면 길을 찾아 걸어가고, 방향키(WASD)로 한 칸씩 걷고, Enter로 말풍선을 띄운다.
// 그림 규격(한 칸 64×104px, 가로 3칸 × 세로 2줄)은 data/avatars.js에 적혀 있다.
import { N, DRAG_THRESHOLD } from './config.js';
import { tile, toTile } from './iso.js';
import { dims, isWall } from './rules.js';
import { AVATAR_BY_ID } from '../data/avatars.js';
import { h } from './util.js';

const FW = 64;        // 그림 한 칸 가로 (px)
const FH = 104;       // 그림 한 칸 세로 (px)
const FOOT = 100;     // 그림 안에서 발끝의 높이 (px)
const STEP_MS = 200;  // 한 칸 걷는 시간
const SAY_MS = 4000;  // 말풍선이 떠 있는 시간. 글자가 길면 글자마다 60ms씩 더 둔다
const SPAWN = { x: N - 4, y: N - 4 }; // 처음 서는 곳(이 칸이 막혀 있으면 가장 가까운 빈칸)

// 걷는 방향(칸 좌표의 변화)마다 쓸 그림 줄과 좌우 뒤집기. 화면에서 x는 오른쪽 아래, y는 왼쪽 아래로 늘어난다.
const FACING = {
  '0,1': { row: 0, flip: false },  // 왼쪽 아래(앞모습)
  '1,0': { row: 0, flip: true },   // 오른쪽 아래
  '-1,0': { row: 1, flip: false }, // 왼쪽 위(뒷모습)
  '0,-1': { row: 1, flip: true },  // 오른쪽 위
};
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// 방이 45도 돌아가 보이므로 방향키도 돌려서 맞춘다. ↑는 오른쪽 위, →는 오른쪽 아래, ↓는 왼쪽 아래, ←는 왼쪽 위.
// WASD는 한글 입력 상태에서도 같게 동작하도록 e.code로 읽는다.
const KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
};

const key = (x, y) => `${x},${y}`;
const isField = t => t instanceof HTMLElement && (t.matches('input, textarea, select') || t.isContentEditable);

// 임시 그림 한 칸. back: 뒷모습, step: 0 서 있기, 1 왼발 걸음, 2 오른발 걸음
function figure(back, step, shirt) {
  const ink = '#2b2b33';
  const hair = '#4a3426';
  const leg = (x, lift) => `<rect x="${x}" y="${80 - lift}" width="9" height="19" rx="4" fill="#3d4a6b" stroke="${ink}" stroke-width="2"/>`;
  const arm = (x, dy) => `<rect x="${x}" y="${60 + dy}" width="8" height="20" rx="4" fill="${shirt}" stroke="${ink}" stroke-width="2"/>`;
  const swing = [0, -2, 2][step];
  const legs = [[leg(22, 0), leg(33, 0)], [leg(20, 0), leg(35, 3)], [leg(20, 3), leg(35, 0)]][step].join('');
  const face = back
    ? `<circle cx="32" cy="33" r="21" fill="${hair}" stroke="${ink}" stroke-width="2"/>
       <path d="M20 21 q7 -6 15 -4" stroke="#6b4e3a" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<circle cx="32" cy="33" r="21" fill="#f7d9bd" stroke="${ink}" stroke-width="2"/>
       <path d="M11 33 C11 14 22 10 32 10 C44 10 53 16 53 31 C46 24 40 22 32 23 C24 22 16 26 11 33 Z" fill="${hair}" stroke="${ink}" stroke-width="2"/>
       <circle cx="24" cy="37" r="2.6" fill="${ink}"/><circle cx="35" cy="37" r="2.6" fill="${ink}"/>
       <ellipse cx="20" cy="43" rx="3.5" ry="2" fill="#f2a0a0"/><ellipse cx="38" cy="43" rx="3.5" ry="2" fill="#f2a0a0"/>
       <path d="M27 45 q3 2.5 6 0" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
  return `<ellipse cx="32" cy="99" rx="15" ry="4" fill="#00000030"/>${legs}${arm(13, swing)}${arm(43, -swing)}
    <rect x="18" y="56" width="28" height="30" rx="9" fill="${shirt}" stroke="${ink}" stroke-width="2"/>${face}`;
}

// 임시 그림의 시트 한 장(가로 3칸 × 세로 2줄)을 SVG로 그려 CSS 배경 주소로 돌려준다. 그림 파일(sheet)과 같은 규격이다.
function placeholderSheet(shirt) {
  let frames = '';
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) frames += `<g transform="translate(${col * FW} ${row * FH})">${figure(row === 1, col, shirt)}</g>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW * 3}" height="${FH * 2}" viewBox="0 0 ${FW * 3} ${FH * 2}">${frames}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ctx: 방 꾸미기 앱의 ctx(root, roomEl, itemsEl, itemEls, room.items, dragging, toLocal).
// 돌려주는 것: attach(가구를 다시 그린 뒤), reset(공간을 바꿀 때), openSay, destroy
export function mountAvatar(ctx, avatarId = 'basic') {
  const def = AVATAR_BY_ID[avatarId] || AVATAR_BY_ID.basic;
  const el = h('div', { className: 'avatar' });
  el.style.backgroundImage = def.sheet ? `url("${def.sheet}")` : placeholderSheet(def.color);
  const bubble = h('div', { className: 'avatar-say', hidden: true });
  const input = h('input', {
    className: 'say-input', type: 'text', maxLength: 40, hidden: true,
    placeholder: '할 말을 쓰고 Enter (Esc는 취소)', 'aria-label': '말풍선에 쓸 말',
  });
  ctx.roomEl.append(bubble);
  ctx.root.append(input);

  const me = { x: SPAWN.x, y: SPAWN.y }; // 서 있는 칸(걷는 중에는 들어가는 칸)
  let pos = { ...me };                   // 그리는 자리. 걷는 동안은 두 칸 사이의 소수
  let facing = FACING['0,1'];
  let col = 0;                           // 그림 칸: 0 서 있기, 1과 2 걸음
  let placed = false;
  let walking = false;
  let path = [];
  let steps = 0;
  let raf = 0;
  let sayTimer = 0;
  let blocked = new Set();
  const held = []; // 누르고 있는 방향키. 나중에 누른 것이 먼저다

  const inRoom = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const free = (x, y) => inRoom(x, y) && !blocked.has(key(x, y));

  // 바닥 가구가 차지한 칸들. 책상 위 물건은 책상 칸 안에 있으므로 따로 세지 않아도 된다.
  function scanBlocked() {
    blocked = new Set();
    for (const it of ctx.room.items) {
      if (isWall(it)) continue;
      const [w, d] = dims(it);
      for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < d; dy++) blocked.add(key(it.x + dx, it.y + dy));
    }
  }

  // 칸 (x, y)에 가장 가까운 빈칸. 방이 가구로 꽉 차 있으면 null.
  function nearestFree(x, y) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const d = Math.abs(i - x) + Math.abs(j - y);
        if (free(i, j) && d < bestD) { best = { x: i, y: j }; bestD = d; }
      }
    }
    return best;
  }

  // 지금 칸에서 갈 수 있는 칸을 가까운 순서로 훑어, to에 가장 가까운 칸까지의 길을 돌려준다(지금 칸은 빼고).
  // to가 가구에 막혀 있거나 갈 수 없으면 그 근처까지 간다. 바닥이 144칸뿐이라 매번 새로 훑어도 순식간이다.
  function findPath(to) {
    const from = { ...me };
    const prev = new Map([[key(from.x, from.y), null]]);
    const queue = [from];
    let best = from;
    let bestD = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
    for (let i = 0; i < queue.length && bestD > 0; i++) {
      const c = queue[i];
      const d = Math.abs(c.x - to.x) + Math.abs(c.y - to.y);
      if (d < bestD) { best = c; bestD = d; }
      for (const [dx, dy] of DIRS) {
        const n = { x: c.x + dx, y: c.y + dy };
        if (!free(n.x, n.y) || prev.has(key(n.x, n.y))) continue;
        prev.set(key(n.x, n.y), c);
        queue.push(n);
      }
    }
    const out = [];
    for (let c = best; c && c !== from; c = prev.get(key(c.x, c.y))) out.unshift(c);
    return out;
  }

  // 칸 a에 선 아바타를 어느 가구보다 위에 그릴지. 가구 순서(room.js의 zOf가 정한 z-index)를 그대로 읽고,
  // 겹치지 않는 두 네모를 가르는 축으로 앞뒤를 판단한다. 아바타가 앞에 있는 가구들 중 가장 높은 것 바로 위에 그린다.
  // 가구 중심의 합(depthOf)으로만 비교하면 긴 가구 옆에서 앞뒤가 뒤집힌다.
  function depthZ(a) {
    let z = 100;
    for (const [it, itemEl] of ctx.itemEls) {
      if (isWall(it)) continue;
      const [w, d] = dims(it);
      if (a.x >= it.x + w || a.y >= it.y + d) z = Math.max(z, Number(itemEl.style.zIndex) || 0);
    }
    return z + 1;
  }

  // 발끝을 칸 가운데에 맞춰 놓는다. at이 있으면 그 칸 기준으로 앞뒤 순서도 다시 정한다.
  function draw(at) {
    const c = tile(pos.x + 0.5, pos.y + 0.5);
    el.style.left = `${Math.round(c.x - FW / 2)}px`;
    el.style.top = `${Math.round(c.y - FOOT)}px`;
    el.style.backgroundPosition = `${-col * FW}px ${-facing.row * FH}px`;
    el.classList.toggle('flip', facing.flip);
    if (at) el.style.zIndex = depthZ(at);
    if (!bubble.hidden) {
      bubble.style.left = `${Math.round(c.x)}px`;
      bubble.style.top = `${Math.round(c.y - FOOT - 4)}px`;
    }
  }

  // 방 꾸미기 창이 맨 앞에 있고 가구를 끌고 있지 않을 때만 키를 받는다.
  function active() {
    const win = ctx.root.closest('.win');
    return !!win && !win.hidden && !win.classList.contains('inactive') && !ctx.dragging;
  }

  function stop() {
    cancelAnimationFrame(raf);
    walking = false;
    path = [];
    col = 0;
  }

  // 한 칸 걷는다. 클릭으로 정한 길이 없으면 누르고 있는 방향키 쪽으로 간다(막혀 있으면 그쪽을 보기만 한다).
  function nextStep() {
    const held1 = active() && held.length ? KEYS[held[held.length - 1]] : null;
    if (!path.length && held1) {
      facing = FACING[key(...held1)];
      const n = { x: me.x + held1[0], y: me.y + held1[1] };
      if (free(n.x, n.y)) path = [n];
    }
    if (!path.length) {
      walking = false;
      col = 0;
      pos = { ...me };
      draw(me);
      return;
    }
    walking = true;
    const from = { ...me };
    const to = path.shift();
    facing = FACING[key(to.x - from.x, to.y - from.y)];
    col = steps++ % 2 ? 2 : 1;
    // 걷는 동안 앞뒤 순서는 두 칸 가운데 앞쪽(화면 아래) 칸으로 정해 두어 깜빡이지 않게 한다.
    const front = to.x + to.y > from.x + from.y ? to : from;
    me.x = to.x;
    me.y = to.y;
    const t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / STEP_MS);
      pos = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      draw(front);
      if (t < 1) raf = requestAnimationFrame(tick);
      else nextStep();
    };
    raf = requestAnimationFrame(tick);
  }

  function walkTo(target) {
    path = findPath(target);
    if (!walking) nextStep();
  }

  function say(text) {
    const t = text.trim();
    if (!t) return;
    bubble.textContent = t;
    bubble.hidden = false;
    draw(null);
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => { bubble.hidden = true; }, SAY_MS + t.length * 60);
  }

  function openSay() {
    input.hidden = false;
    input.value = '';
    input.focus();
  }

  function closeSay() {
    input.hidden = true;
    input.blur();
  }

  // ---------- 입력 ----------
  // 바닥을 눌렀다 떼면 그 칸으로 걸어간다. 가구를 누른 것은 가구 쪽(room.js)이 맡으므로 건너뛴다.
  let down = null;
  function onFloorDown(e) {
    if (e.button !== 0 || ctx.dragging || e.target.closest('.item')) return;
    down = ctx.toLocal(e.clientX, e.clientY);
  }
  function onFloorUp(e) {
    if (!down) return;
    const start = down;
    down = null;
    const p = ctx.toLocal(e.clientX, e.clientY);
    if (Math.hypot(p.x - start.x, p.y - start.y) > DRAG_THRESHOLD) return;
    const t = toTile(p.x, p.y);
    const target = { x: Math.floor(t.x), y: Math.floor(t.y) };
    if (!inRoom(target.x, target.y)) return;
    held.length = 0;
    walkTo(target);
  }

  function onKeyDown(e) {
    if (!active() || isField(e.target)) return;
    if (KEYS[e.code]) {
      e.preventDefault();
      if (!held.includes(e.code)) held.push(e.code);
      path = []; // 방향키를 누르면 클릭으로 정한 길은 버린다
      if (!walking) nextStep();
    } else if (e.key === 'Enter' && !e.target.closest?.('button')) {
      e.preventDefault();
      openSay();
    }
  }
  function onKeyUp(e) {
    const i = held.indexOf(e.code);
    if (i >= 0) held.splice(i, 1);
  }
  // 키를 누른 채 다른 곳을 누르면 keyup이 오지 않으므로 창의 초점이 빠지면 모두 뗀 것으로 본다.
  function onBlur() {
    held.length = 0;
  }

  input.addEventListener('keydown', e => {
    // 한글을 쓰는 중에 Enter를 누르면 keydown이 두 번 온다(조합 중 한 번, 끝난 뒤 한 번). 조합 중인 것은 건너뛴다.
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      say(input.value);
      closeSay();
    } else if (e.key === 'Escape') {
      closeSay();
    }
  });
  input.addEventListener('blur', () => { input.hidden = true; });

  ctx.roomEl.addEventListener('pointerdown', onFloorDown);
  ctx.roomEl.addEventListener('pointerup', onFloorUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    // 가구를 다시 그린 뒤 부른다. renderItems가 .items를 비우고 다시 채우므로 아바타를 다시 넣는다.
    // 서 있던 칸에 가구가 놓였으면 가장 가까운 빈칸으로 옮긴다.
    attach() {
      stop();
      scanBlocked();
      if (!placed || !free(me.x, me.y)) {
        const spot = nearestFree(placed ? me.x : SPAWN.x, placed ? me.y : SPAWN.y);
        if (!spot) { el.remove(); return; }
        me.x = spot.x;
        me.y = spot.y;
        placed = true;
      }
      pos = { ...me };
      ctx.itemsEl.append(el);
      draw(me);
    },
    // 다른 공간으로 갈 때. 다음 attach에서 그 공간의 처음 자리에 선다.
    reset() {
      stop();
      placed = false;
      bubble.hidden = true;
    },
    openSay,
    destroy() {
      stop();
      clearTimeout(sayTimer);
      ctx.roomEl.removeEventListener('pointerdown', onFloorDown);
      ctx.roomEl.removeEventListener('pointerup', onFloorUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      el.remove();
      bubble.remove();
      input.remove();
    },
  };
}
