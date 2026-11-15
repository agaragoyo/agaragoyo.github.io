// 실험실의 '펫 데려오기'(pet, src/labs.js). 켜면 내 집의 방에 임시 픽셀 고양이 한 마리가 산다(docs/requirements.md의 펫 줄).
// 고양이는 아바타처럼 바닥 한 칸에 선다. 빈 바닥 칸에 앉아 있다가 10~20초마다 길을 따라 2~4칸 떨어진 빈칸으로
// 아바타의 절반 빠르기(한 칸 0.4초)로 걸어가 다시 앉는다. 두 번 누르면 아바타가 바로 옆 칸으로 와서 쓰다듬고, 고양이 위에 하트가 1초 뜬다.
// 물과 밥은 집에 저장해야 해서 넣지 않았다. 고양이는 화면에만 있고 집 저장 형식과 공유 링크에는 아무것도 담지 않는다(새로 고침하면 다른 칸에서 시작한다).
// 고양이가 차지한 칸(걷는 동안은 두 칸)은 아바타가 지나가지 못하고(src/avatar.js의 host.others), 두 그림이 겹치면 앞에 선 쪽이 위에 그려진다(order).
// 가구와의 앞뒤는 아바타와 같은 규칙(depthZ)이다. 벽에 붙은 줄(x나 y가 0)에는 가지 않는다. 아바타가 벽 가구와 문을 쓰러 가서 서는 칸이라서다.
// 움직임 줄이기를 켠 사람에게는 걸어 다니지 않고 앉아만 있는다(쓰다듬기는 된다).
// 그림은 디자인 담당의 그림이 오기 전까지 쓰는 임시 픽셀 그림이다. 한 칸은 2px 안팎이고, src/icons.js의 fitPixelIcons가
// 화면 픽셀 정수 개로 맞춘 값(--pet-cell)으로 그린다(known-issues 67).
import { N } from './config.js';
import { tile } from './iso.js';
import { depthZ, blockedOf, overlaps } from './avatar.js';
import { h, doubleClick, reduceMotion } from './util.js';

const COLS = 20;                // 그림 한 장의 가로 칸 수
const ROWS = 15;                // 세로 칸 수. 한 칸이 2px이면 40×30px로, 아바타 그림(64×104px) 폭의 60%와 키의 30%쯤이다
const STEP_MS = 400;            // 한 칸 걷는 시간. 아바타(200ms)의 절반 빠르기다
const REST_MS = [10000, 20000]; // 앉아 있다가 다시 걷기까지 기다리는 시간(이 사이에서 무작위)
const HOP = [2, 4];             // 한 번에 걷는 거리(길을 따라 센 칸 수)
const HEART_MS = 1000;          // 쓰다듬은 뒤 하트가 떠 있는 시간
const CALL_MS = 8000;           // 쓰다듬으러 오는 아바타를 기다리는 가장 긴 시간. 아바타가 오다가 다른 데로 가면 그 뒤에 다시 돌아다닌다
const HEAD_DX = 4.5;            // 앉은 그림에서 머리 가운데가 그림 가운데보다 앞(보는 쪽)으로 나온 칸 수. 하트를 그 위에 띄운다
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

const key = (x, y) => `${x},${y}`;

// 한 글자가 한 칸이고 '.'은 빈칸이다(src/icons.js의 PIXEL과 같은 방식). 모두 왼쪽을 본 그림이고, 오른쪽으로 갈 때는 좌우를 뒤집는다.
// 바닥(나무색)과 구분되게 회색 줄무늬에 가슴과 발이 흰 고양이로 칠했다. s는 바닥 그림자다.
// sit: 앉아 있기, walk1과 walk2: 걷기(반 칸마다 바꾼다)
const CAT = {
  colors: { k: '#3d3b4a', g: '#a7adbc', d: '#767d8f', w: '#f6f3ec', p: '#f4a3b5', s: '#00000030' },
  sit: [
    '....................',
    '..k.....k...........',
    '.kpk...kpk..........',
    '.kgkkkkkgk..........',
    '.kggdgdggk..........',
    '.kgkgggkgk..........',
    '.kgggpgggkkkk.......',
    '..kgwwwgkgggdk......',
    '...kkwkkggdgggk.....',
    '...kwwwkgdggggk..kk.',
    '...kwwwkggggggk.kgk.',
    '...kwwwkgggggggkkgk.',
    '...kwwwkggggggggggk.',
    '...kwkwkkkkkkkkkkkk.',
    '....ssssssssssssss..',
  ],
  walk1: [
    '....................',
    '....................',
    '.k.....k.........k..',
    'kpk...kpk.......kgk.',
    'kgkkkkkgk.......kgk.',
    'kggdgdggk......kgk..',
    'kgkgggkgkkkkkkkgk...',
    'kgggpgggkgdggdggk...',
    '.kgwwwgkggdggdggk...',
    '..kkwkkggggggggk....',
    '...kwkkkkkkkkkgk....',
    '..kwk.......kgk.....',
    '..kwk.......kgk.....',
    '..kkk.......kkk.....',
    '..ssssssssssssss....',
  ],
  walk2: [
    '....................',
    '....................',
    '.k.....k.........k..',
    'kpk...kpk.......kgk.',
    'kgkkkkkgk.......kgk.',
    'kggdgdggk......kgk..',
    'kgkgggkgkkkkkkkgk...',
    'kgggpgggkgdggdggk...',
    '.kgwwwgkggdggdggk...',
    '..kkwkkggggggggk....',
    '...kwkkkkkkkkkgk....',
    '...kwk....kgk.......',
    '...kwk....kgk.......',
    '...kkk....kkk.......',
    '..ssssssssssssss....',
  ],
};
const HEART = {
  colors: { k: '#8a2c46', p: '#ff6f91', w: '#ffffff' },
  rows: ['.kk.kk.', 'kwpkppk', 'kpppppk', '.kpppk.', '..kpk..', '...k...'],
};

// 칸 그림을 SVG 조각으로 만든다. 같은 색 칸이 가로로 이어지면 한 조각으로 묶는다. 그림자(s)는 누르기를 받지 않는다(style.css의 .shade)
function cellPaths(rows, colors) {
  const paths = {};
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      let n = 1;
      while (row[x + n] === row[x]) n++;
      if (row[x] !== '.') (paths[row[x]] ??= []).push(`M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  return Object.entries(paths).map(([c, d]) => `<path${c === 's' ? ' class="shade"' : ''} fill="${colors[c]}" d="${d.join('')}"/>`).join('');
}
const CAT_SVG = `<svg viewBox="0 0 ${COLS} ${ROWS}" aria-hidden="true">${['sit', 'walk1', 'walk2']
  .map(f => `<g data-frame="${f}">${cellPaths(CAT[f], CAT.colors)}</g>`).join('')}</svg>`;
const HEART_SVG = `<svg viewBox="0 0 7 6" aria-hidden="true">${cellPaths(HEART.rows, HEART.colors)}</svg>`;

// 지금 그림 한 칸의 크기(무대 px). 무대 배율에 따라 바뀐다(src/icons.js의 fitPixelIcons)
const cellSize = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pet-cell')) || 2;

// host: 고양이가 사는 곳(바탕화면 배경, os.js가 넘긴다).
//   layer     가구와 아바타가 같이 들어 있는 상자. 다시 그리면 비워지므로 그 뒤에 attach를 부른다
//   items()   그 공간의 가구 목록
//   avatar()  내 아바타(src/avatar.js의 mountAvatar). 그 칸은 피해서 걷고, 쓰다듬을 때 부른다. 없으면 null
// 돌려주는 것: attach(here), cells(), order(at, rect, z), destroy(). cells와 order는 아바타가 부른다(host.others)
export function mountPet(host) {
  const el = h('div', { className: 'room-pet', title: '두 번 눌러 쓰다듬기' });
  el.innerHTML = CAT_SVG;
  const frames = [...el.querySelectorAll('g')];
  const heart = h('div', { className: 'room-pet-heart', hidden: true });
  heart.innerHTML = HEART_SVG;

  let cell = null;      // 앉은 칸(걷는 중에는 들어가는 칸). 방에 없으면 null
  let from = null;      // 걷는 중이면 나오는 칸
  let pos = null;       // 그리는 자리. 걷는 동안은 두 칸 사이의 소수
  let right = false;    // 화면 오른쪽을 보는지(그림을 뒤집는다)
  let route = [];       // 남은 길
  let walking = false;
  let waiting = false;  // 쓰다듬으러 오는 아바타를 기다리는 중. 그동안은 걷지 않는다
  let pending = false;  // 걷던 중에 두 번 눌렸다. 들어가던 칸까지 마저 걷고 아바타를 부른다
  let blocked = new Set();
  let size = 2;         // 그림 한 칸의 크기(무대 px)
  let base = 0;         // 가구와의 앞뒤로 정한 순서(depthZ)
  let foot = null;      // 앞뒤를 따진 자리 { at, w, d, rect }. at은 차지한 칸(걷는 동안은 두 칸을 합친 자리의 뒤쪽 모서리), w와 d는 그 칸 수
  let raf = 0;
  let restTimer = 0;
  let heartTimer = 0;
  const twice = doubleClick();

  const avatarAt = (x, y) => { const s = host.avatar()?.spot(); return !!s && s.x === x && s.y === y; };
  // 고양이가 들어갈 수 있는 칸: 방 안이고 벽에 붙은 줄이 아니며, 가구와 아바타가 없는 칸
  const open = (x, y) => x > 0 && y > 0 && x < N && y < N && !blocked.has(key(x, y)) && !avatarAt(x, y);

  // 칸 c에 선 그림이 화면에서 차지하는 네모(무대 px). 그림의 아래 가운데가 칸 가운데(발끝)다
  const rectAt = c => {
    const p = tile(c.x + 0.5, c.y + 0.5);
    return { l: p.x - (size * COLS) / 2, t: p.y - size * ROWS, r: p.x + (size * COLS) / 2, b: p.y };
  };

  const show = frame => { for (const g of frames) g.style.display = g.dataset.frame === frame ? '' : 'none'; };

  // 지금 자리(pos)에 그리고 가구와의 앞뒤를 정한다. 아바타와 겹치면 앞에 선 쪽이 위에 오게 아바타가 order를 다시 부른다
  function draw(at, w, d, rect) {
    const p = tile(pos.x + 0.5, pos.y + 0.5);
    el.style.left = `${Math.round(p.x)}px`;
    el.style.top = `${Math.round(p.y)}px`;
    el.classList.toggle('flip', right);
    foot = { at, w, d, rect };
    base = depthZ(host.items(), at, rect);
    el.style.zIndex = base;
    host.avatar()?.restack();
  }

  function sit() {
    size = cellSize();
    pos = { ...cell };
    show('sit');
    draw(cell, 1, 1, rectAt(cell));
  }

  // 앉아서 쉬다가 다시 걷는다. 움직임 줄이기를 켠 사람에게는 앉아만 있는다
  function rest() {
    clearTimeout(restTimer);
    if (!reduceMotion) restTimer = setTimeout(wander, REST_MS[0] + Math.random() * (REST_MS[1] - REST_MS[0]));
  }

  // 지금 칸에서 길을 따라 2~4칸 떨어진 빈칸 하나를 무작위로 골라 그 칸까지의 길을 돌려준다(지금 칸은 빼고). 갈 곳이 없으면 빈 길
  function hop() {
    const prev = new Map([[key(cell.x, cell.y), null]]);
    const dist = new Map([[key(cell.x, cell.y), 0]]);
    const queue = [cell];
    const picks = [];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      const dc = dist.get(key(c.x, c.y));
      if (dc >= HOP[0]) picks.push(c);
      if (dc === HOP[1]) continue;
      for (const [dx, dy] of DIRS) {
        const n = { x: c.x + dx, y: c.y + dy };
        if (!open(n.x, n.y) || prev.has(key(n.x, n.y))) continue;
        prev.set(key(n.x, n.y), c);
        dist.set(key(n.x, n.y), dc + 1);
        queue.push(n);
      }
    }
    const out = [];
    if (!picks.length) return out;
    for (let c = picks[Math.floor(Math.random() * picks.length)]; c !== cell; c = prev.get(key(c.x, c.y))) out.unshift(c);
    return out;
  }

  function wander() {
    if (!cell || waiting) return;
    route = hop();
    if (route.length) step();
    else rest();
  }

  // 한 칸 걷는다. 길이 끝났거나 다음 칸에 그사이 아바타가 들어왔으면 그 자리에 앉는다
  function step() {
    const to = route.shift();
    if (!to || !open(to.x, to.y)) { settle(); return; }
    walking = true;
    const start = cell;
    from = start;
    cell = to;
    right = to.x - to.y > start.x - start.y; // 화면 오른쪽(오른쪽 아래, 오른쪽 위)으로 가면 오른쪽을 본다
    // 걷는 동안에는 아바타처럼 두 칸을 합친 자리로 앞뒤를 정해, 한 걸음 사이에 순서가 바뀌어 깜박이지 않게 한다
    size = cellSize();
    const at = { x: Math.min(start.x, to.x), y: Math.min(start.y, to.y) };
    const [a, b] = [rectAt(start), rectAt(to)];
    const sweep = { l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) };
    const t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / STEP_MS); // 지난 시간으로 계산해 프레임이 적은 창에서도 제시간에 닿는다(known-issues 23)
      pos = { x: start.x + (to.x - start.x) * t, y: start.y + (to.y - start.y) * t };
      show(t < 0.5 ? 'walk1' : 'walk2');
      draw(at, start.x === to.x ? 1 : 2, start.y === to.y ? 1 : 2, sweep);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      from = null;
      step();
    };
    raf = requestAnimationFrame(tick);
  }

  // 걷기를 마치고 앉는다. 걷던 중에 두 번 눌렸으면 이제 아바타를 부른다
  function settle() {
    walking = false;
    route = [];
    sit();
    if (pending) {
      pending = false;
      call();
    } else {
      rest();
    }
  }

  // 아바타를 바로 옆 칸으로 불러 쓰다듬게 한다. 아바타가 없거나 갈 길이 없으면 그 자리에서 하트만 띄운다
  function call() {
    clearTimeout(restTimer);
    const walker = host.avatar();
    if (!walker?.spot()) { love(); return; }
    waiting = true;
    restTimer = setTimeout(() => { waiting = false; rest(); }, CALL_MS);
    walker.approachCell({ x: cell.x, y: cell.y }, love);
  }

  // 쓰다듬는 아바타 쪽을 보고 머리 위에 하트를 1초 띄운다
  function love() {
    if (!cell || !el.isConnected) return;
    waiting = false;
    const s = host.avatar()?.spot();
    if (s) right = s.x - s.y > cell.x - cell.y;
    sit();
    heart.style.left = el.style.left;
    heart.style.top = el.style.top;
    heart.style.setProperty('--dx', right ? HEAD_DX : -HEAD_DX); // h()로 넣은 CSS 변수는 빠지므로 setProperty로 넣는다(known-issues 50)
    heart.hidden = true;
    void heart.offsetWidth; // 연달아 쓰다듬으면 떠오르기를 처음부터 다시 한다
    heart.hidden = false;
    clearTimeout(heartTimer);
    heartTimer = setTimeout(() => { heart.hidden = true; }, HEART_MS);
    rest();
  }

  // 두 번 누르면 쓰다듬는다. 한 번 누르기는 가구처럼 아무것도 하지 않는다
  el.addEventListener('click', () => {
    if (!twice(el) || !cell || waiting || pending) return;
    if (walking) {
      route = []; // 들어가던 칸까지 마저 걷고 settle에서 부른다
      pending = true;
    } else {
      call();
    }
  });

  // 걷기, 기다리기, 하트를 모두 멈춘다. 걷던 중이면 들어가던 칸에 선다
  function halt() {
    cancelAnimationFrame(raf);
    clearTimeout(restTimer);
    clearTimeout(heartTimer);
    heart.hidden = true;
    walking = waiting = pending = false;
    route = [];
    from = null;
  }

  const detach = () => {
    el.remove();
    heart.remove();
  };

  // 앉을 칸을 고른다. near가 있으면(앉아 있던 칸이 막혔으면) 그 칸에서 가장 가까운 빈칸이고, 없으면(처음) 아바타가 걸어갈 수 있고
  // 아바타와 두 칸 넘게 떨어진 빈칸 가운데 하나를 무작위로 고른다. 그런 칸이 없으면 아무 빈칸이고, 빈칸이 없으면 null
  function pickCell(near) {
    const cells = [];
    for (let x = 1; x < N; x++) for (let y = 1; y < N; y++) if (open(x, y)) cells.push({ x, y });
    if (!cells.length) return null;
    if (near) return cells.reduce((a, b) => (Math.abs(b.x - near.x) + Math.abs(b.y - near.y) < Math.abs(a.x - near.x) + Math.abs(a.y - near.y) ? b : a));
    const me = host.avatar()?.spot();
    let pool = cells;
    if (me) {
      const seen = new Set([key(me.x, me.y)]);
      const queue = [me];
      for (let i = 0; i < queue.length; i++) {
        for (const [dx, dy] of DIRS) {
          const n = { x: queue[i].x + dx, y: queue[i].y + dy };
          if (n.x < 0 || n.y < 0 || n.x >= N || n.y >= N || blocked.has(key(n.x, n.y)) || seen.has(key(n.x, n.y))) continue;
          seen.add(key(n.x, n.y));
          queue.push(n);
        }
      }
      const far = cells.filter(c => seen.has(key(c.x, c.y)) && Math.abs(c.x - me.x) + Math.abs(c.y - me.y) > 2);
      if (far.length) pool = far;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return {
    // 방을 다시 그린 뒤 아바타 다음에 부른다(고양이가 아바타가 선 칸을 피해 앉는다). here: 고양이가 사는 공간(내 방)인지.
    // 놀이터에 나가 있는 동안에는 방에 없다가, 돌아오면 앉아 있던 칸에 다시 앉는다. 그 칸에 가구나 아바타가 있으면 가장 가까운 빈칸에 앉는다
    attach(here) {
      halt();
      if (!here) { detach(); return; }
      blocked = blockedOf(host.items());
      if (!cell || !open(cell.x, cell.y)) cell = pickCell(cell);
      if (!cell) { detach(); return; }
      host.layer.append(el, heart);
      sit();
      rest();
    },
    // 지금 차지한 칸들. 아바타의 길찾기가 이 칸을 피한다. 걷는 동안은 나오는 칸과 들어가는 칸 둘이다
    cells: () => (cell && el.isConnected ? (from ? [from, cell] : [cell]) : []),
    // 아바타가 칸 at(걷는 동안은 두 칸을 합친 자리의 뒤쪽 모서리)에서 그림 네모 rect를 차지하고 순서 z로 그려지려 할 때 부른다(src/avatar.js의 draw).
    // 두 그림이 겹치면 앞에 선 쪽이 위에 오게 아바타의 순서를 돌려주고 고양이의 순서를 고친다. 앞뒤는 가구와 같은 규칙(depthZ)으로 가린다
    order(at, rect, z) {
      if (!foot || !el.isConnected) return z;
      let mine = base;
      if (overlaps(rect, foot.rect)) {
        if (at.x >= foot.at.x + foot.w || at.y >= foot.at.y + foot.d) z = Math.max(z, base + 1);
        else mine = Math.max(base, z + 1);
      }
      el.style.zIndex = mine;
      return z;
    },
    destroy() {
      halt();
      detach();
    },
  };
}
