// 내 집의 방에 사는 펫(docs/requirements.md의 F30). 고른 펫 한 마리가 살고, 고르기 전에는 기본 펫(data/pets.js의 DEFAULT_PET)이 산다.
// 종류(강아지, 고양이, 기니피그, 병아리, 비둘기, 코끼리, 코알라, 공룡)와 색은 시작 메뉴의 펫 바꾸기 창(src/pet-picker.js)에서 고르고, 이 브라우저의 설정(src/settings.js의 pet)에만 남는다.
// 병아리는 쓰다듬은 횟수가 GROW_PATS번이 되면 같은 색의 닭으로 자란다(patted). 횟수(petPats)와 자란 모습(pet)도 이 브라우저의 설정에만 남는다.
// 2026-11-15에 실험실의 '펫 데려오기'(pet)로 넣었고, 2026-11-17에 모든 사람에게 켰다. 같은 날 비둘기와 병아리를 더하고 햄스터를 기니피그로 바꿨다.
// 그림과 색은 data/pets.js에 있다.
// 펫은 아바타처럼 바닥 한 칸에 선다. 빈 바닥 칸에 앉아 있다가 10~20초마다 길을 따라 2~4칸 떨어진 빈칸으로
// 아바타의 절반 빠르기(한 칸 0.4초)로 걸어가 다시 앉는다. 앉아 있는 동안에는 1초마다 숨을 쉬고(머리와 몸 윗부분이 한 칸 내려온다)
// 3~6초마다 0.15초 동안 눈을 감는다. 두 번 누르면 아바타가 바로 옆 칸으로 와서 쓰다듬고, 펫은 1초 동안 눈을 감고 머리 위에 하트가 뜬다.
// 물과 밥은 집에 저장해야 해서 넣지 않았다. 펫은 화면에만 있고 집 저장 형식과 공유 링크에는 아무것도 담지 않는다(새로 고침하면 다른 칸에서 시작한다).
// 펫이 차지한 칸(걷는 동안은 두 칸)은 아바타가 지나가지 못하고(src/avatar.js의 host.others), 두 그림이 겹치면 앞에 선 쪽이 위에 그려진다(order).
// 가구와의 앞뒤는 아바타와 같은 규칙(depthZ)이다. 벽에 붙은 줄(x나 y가 0)에는 가지 않는다. 아바타가 벽 가구와 문을 쓰러 가서 서는 칸이라서다.
// 움직임 줄이기를 켠 사람에게는 걸어 다니지 않고 숨도 쉬지 않으며 앉아만 있는다(눈 깜박이기와 쓰다듬기는 된다).
// 한 칸은 2px 안팎이고, src/icons.js의 fitPixelIcons가 화면 픽셀 정수 개로 맞춘 값(--pet-cell)으로 그린다(known-issues 67).
import { N } from './config.js';
import { tile } from './iso.js';
import { depthZ, blockedOf, overlaps } from './avatar.js';
import { h, doubleClick, reduceMotion } from './util.js';
import { PET_SPECIES, DEFAULT_PET } from '../data/pets.js';

export const PET_COLS = 24;     // 그림 한 장의 가로 칸 수(data/pets.js)
export const PET_ROWS = 20;     // 세로 칸 수. 한 칸이 2px이면 48×40px로, 아바타 그림(64×104px) 폭의 75%다
export const NO_PET = 'none';   // 펫 바꾸기 창에서 "없음"을 고르면 설정(pet)에 남는 값. 이때는 방에 펫을 두지 않는다(src/os.js의 syncPet)
const STEP_MS = 400;            // 한 칸 걷는 시간. 아바타(200ms)의 절반 빠르기다
const REST_MS = [10000, 20000]; // 앉아 있다가 다시 걷기까지 기다리는 시간(이 사이에서 무작위)
const HOP = [2, 4];             // 한 번에 걷는 거리(길을 따라 센 칸 수)
const HEART_MS = 1000;          // 쓰다듬은 뒤 하트가 떠 있고 눈을 감고 있는 시간
const CALL_MS = 8000;           // 쓰다듬으러 오는 아바타를 기다리는 가장 긴 시간. 아바타가 오다가 다른 데로 가면 그 뒤에 다시 돌아다닌다
const BREATH_MS = 1000;         // 앉아 있을 때 숨을 들이쉬고 내쉬는 간격
const BLINK_MS = 150;           // 눈을 깜박일 때 감고 있는 시간
const BLINK_GAP = [3000, 6000]; // 눈을 깜박이는 간격(이 사이에서 무작위)
export const GROW_PATS = 10;    // 자라는 펫(data/pets.js의 grow, 병아리)이 다음 모습이 되기까지 쓰다듬는 횟수. 발표에서 바로 보여 줄 수 있게 날짜 대신 횟수로 자란다
const HEAD_X = 9.5;             // 왼쪽을 본 그림에서 머리 가운데의 칸 자리. 모든 종류가 같은 자리에 머리가 있다(data/pets.js)
const HEAD_DX = PET_COLS / 2 - HEAD_X; // 머리 가운데가 그림 가운데보다 앞(보는 쪽)으로 나온 칸 수. 하트를 그 위에 띄운다
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// 그림 한 마리에 넣는 장. 숨 쉬는 장과 눈 감은 장은 앉은 그림에서 만든다(framesOf)
const FRAMES = ['sit', 'breath', 'blink', 'breath-blink', 'walk1', 'walk2'];

const key = (x, y) => `${x},${y}`;

const HEART = {
  colors: { k: '#8a2c46', p: '#ff6f91', w: '#ffffff' },
  rows: ['.kk.kk.', 'kwpkppk', 'kpppppk', '.kpppk.', '..kpk..', '...k...'],
};

// 겉선 색. 바탕 색(b)의 명도를 35 낮추고 채도를 30% 줄인다. 검은 겉선보다 부드럽고, 바탕화면 아이콘의 겉선과 같은 방법이다
function outline(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let hue = 0, sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
  }
  const s2 = sat * 0.7, l2 = Math.max(0.1, l - 0.35);
  const ch = n => {
    const k = (n + hue * 12) % 12, a = s2 * Math.min(l2, 1 - l2);
    return Math.round(255 * (l2 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${ch(0)}${ch(8)}${ch(4)}`;
}
// data/pets.js의 색 하나를 그림 글자마다의 색으로 푼다. 하이라이트(h)는 흰색, 바닥 그림자(s)는 바닥 색이 비치는 옅은 갈색이다
const paint = color => ({ ...color, o: outline(color.b), h: '#ffffff', s: 'rgba(60, 35, 20, 0.22)' });

// 숨을 들이쉰 그림. breath 줄을 빼고 맨 위에 빈 줄을 더해, 그 줄 위(머리와 몸 윗부분)가 한 칸 내려온다
const inhale = (rows, k) => ['.'.repeat(PET_COLS), ...rows.slice(0, k), ...rows.slice(k + 1)];

// 눈 감은 그림. 이어진 눈 칸(e, h)을 한 덩어리씩 모아, 하이라이트(h)가 든 덩어리(눈)는 맨 아래 줄만 눈 색으로 남기고
// 나머지는 눈 바로 위 칸의 색(없으면 바탕)으로 덮는다. 하이라이트가 없는 덩어리는 코라서 그대로 둔다
function shut(rows) {
  const g = rows.map(r => [...r]);
  const isEye = (x, y) => g[y]?.[x] === 'e' || g[y]?.[x] === 'h';
  const seen = new Set();
  for (let y = 0; y < g.length; y++) for (let x = 0; x < PET_COLS; x++) {
    if (!isEye(x, y) || seen.has(key(x, y))) continue;
    const part = [];
    const queue = [[x, y]];
    seen.add(key(x, y));
    while (queue.length) {
      const [cx, cy] = queue.pop();
      part.push([cx, cy]);
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!isEye(nx, ny) || seen.has(key(nx, ny))) continue;
        seen.add(key(nx, ny));
        queue.push([nx, ny]);
      }
    }
    if (!part.some(([cx, cy]) => g[cy][cx] === 'h')) continue;
    const top = Math.min(...part.map(p => p[1]));
    const bottom = Math.max(...part.map(p => p[1]));
    for (const [cx, cy] of part) {
      const above = g[top - 1]?.[cx];
      g[cy][cx] = cy === bottom ? 'e' : above && !'eh.'.includes(above) ? above : 'b';
    }
  }
  return g.map(r => r.join(''));
}

// 종류마다 그림 장을 한 번만 만든다
const frameCache = new Map();
function framesOf(species) {
  if (!frameCache.has(species.id)) {
    const breath = inhale(species.sit, species.breath);
    frameCache.set(species.id, {
      sit: species.sit,
      breath,
      blink: shut(species.sit),
      'breath-blink': shut(breath),
      walk1: species.walk1 || species.sit,
      walk2: species.walk2,
    });
  }
  return frameCache.get(species.id);
}

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
const HEART_SVG = `<svg viewBox="0 0 7 6" aria-hidden="true">${cellPaths(HEART.rows, HEART.colors)}</svg>`;

// 설정에 남긴 값('<종류>/<색>', src/settings.js의 pet)을 data/pets.js의 종류와 색으로 푼다.
// 비었거나 없는 종류면 기본 펫(DEFAULT_PET)이고, 없는 색이면 그 종류의 첫 색이다. value는 고친 값이다
export function petChoice(value) {
  const [kind, tone] = String(value || DEFAULT_PET).split('/');
  const species = PET_SPECIES.find(s => s.id === kind) || PET_SPECIES.find(s => s.id === DEFAULT_PET.split('/')[0]);
  const color = species.colors.find(c => c.id === tone) || species.colors[0];
  return { species, color, value: `${species.id}/${color.id}` };
}

// 펫 바꾸기 창의 종류 단추 하나가 맡는 종류. 자라서 된 종류(닭)는 자라기 전 종류(병아리)의 단추가 맡는다
export const petRoot = species => PET_SPECIES.find(s => s.grow === species.id) || species;
// 펫 바꾸기 창의 종류 단추에 나오는 종류. 자라서 된 종류는 빼고 data/pets.js의 차례대로다
export const PET_KINDS = PET_SPECIES.filter(s => petRoot(s) === s);

// 쓰다듬은 뒤에 바꿀 설정(src/settings.js의 pet과 petPats). 자라는 펫이면 쓰다듬은 횟수를 하나 더하고, GROW_PATS번이 되면
// 같은 색 id의 자란 종류로 바꾸며 횟수를 0으로 돌린다. 자라지 않는 펫이면 null이라 설정을 건드리지 않는다
export function patted(value, pats) {
  const { species, color } = petChoice(value);
  if (!species.grow) return null;
  const n = (Number(pats) || 0) + 1;
  return n < GROW_PATS ? { petPats: n } : { pet: `${species.grow}/${color.id}`, petPats: 0 };
}

// 펫 한 마리의 SVG. frames에 든 장마다 <g data-frame>을 하나씩 넣는다. 보이는 장은 petPuppet이 고르고, 한 장만 넣으면 그 장이 보인다
export function petSvg(choice, frames = FRAMES) {
  const f = framesOf(choice.species);
  const colors = paint(choice.color);
  return `<svg viewBox="0 0 ${PET_COLS} ${PET_ROWS}" aria-hidden="true">${frames.map(n => `<g data-frame="${n}">${cellPaths(f[n], colors)}</g>`).join('')}</svg>`;
}

// 지금 그림 한 칸의 크기(무대 px). 무대 배율에 따라 바뀐다(src/icons.js의 fitPixelIcons)
export const petCell = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pet-cell')) || 2;

// 쓰다듬을 때 하트를 띄울 높이. 머리 가운데 위 7칸 폭에서 가장 위에 칠한 줄을 찾아, 그 한 칸 위에 하트(6줄)의 아래가 오게 한다.
// 고양이처럼 귀가 양옆에 선 종류는 귀 사이에 뜬다. 돌려주는 값은 발끝에서 하트 위까지의 칸 수(음수)다
function heartRise(species) {
  const top = species.sit.findIndex(row => /[^.]/.test(row.slice(HEAD_X - 3.5, HEAD_X + 3.5)));
  return top - 1 - HEART.rows.length - PET_ROWS;
}

// 펫 그림을 담은 상자(방의 .room-pet, 펫 바꾸기 창의 큰 그림)를 움직인다.
//   look(choice)  종류와 색을 정하고 그림을 다시 넣는다(petChoice가 돌려준 것)
//   pose(name)    'sit'(앉기), 'walk1', 'walk2'(걷기 두 장)
//   shut(on)      앉아 있을 때 눈을 감는다(쓰다듬는 동안)
//   live(on)      켜면 앉아 있는 동안 숨을 쉬고 눈을 깜박인다. 움직임 줄이기를 켠 사람에게는 깜박이기만 한다. 끌 때 타이머를 모두 멈춘다
export function petPuppet(box) {
  let groups = [];
  let pose = 'sit';
  let breathIn = false;
  let blinking = false;
  let eyesShut = false;
  let breathTimer = 0;
  let blinkTimer = 0;

  const frame = () => {
    if (pose !== 'sit') return pose;
    const closed = eyesShut || blinking;
    if (breathIn) return closed ? 'breath-blink' : 'breath';
    return closed ? 'blink' : 'sit';
  };
  const show = () => {
    const name = frame();
    for (const g of groups) g.style.display = g.dataset.frame === name ? '' : 'none';
  };
  const blinkLater = () => {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => {
      blinking = true;
      show();
      blinkTimer = setTimeout(() => {
        blinking = false;
        show();
        blinkLater();
      }, BLINK_MS);
    }, BLINK_GAP[0] + Math.random() * (BLINK_GAP[1] - BLINK_GAP[0]));
  };

  return {
    look(choice) {
      box.innerHTML = petSvg(choice);
      box.dataset.pet = choice.value;
      groups = [...box.querySelectorAll('g[data-frame]')];
      show();
    },
    pose(name) {
      if (name !== 'sit') breathIn = false;
      pose = name;
      show();
    },
    shut(on) {
      eyesShut = on;
      show();
    },
    live(on) {
      clearInterval(breathTimer);
      clearTimeout(blinkTimer);
      breathIn = blinking = false;
      if (on) {
        if (!reduceMotion) {
          breathTimer = setInterval(() => {
            if (pose !== 'sit') return;
            breathIn = !breathIn;
            show();
          }, BREATH_MS);
        }
        blinkLater();
      }
      show();
    },
  };
}

// host: 펫이 사는 곳(바탕화면 배경, os.js가 넘긴다).
//   layer     가구와 아바타가 같이 들어 있는 상자. 다시 그리면 비워지므로 그 뒤에 attach를 부른다
//   items()   그 공간의 가구 목록
//   avatar()  내 아바타(src/avatar.js의 mountAvatar). 그 칸은 피해서 걷고, 쓰다듬을 때 부른다. 없으면 null
//   look()    고른 펫(src/settings.js의 pet 값). 비었으면 기본 펫이다
//   pat()     쓰다듬을 때마다 부른다. 자라는 펫의 횟수를 세고 다 자라면 펫 설정을 바꾼다(src/os.js의 petPatted). 없어도 된다
// 돌려주는 것: attach(here), restyle(), cells(), order(at, rect, z), destroy(). cells와 order는 아바타가 부른다(host.others)
export function mountPet(host) {
  const el = h('div', { className: 'room-pet', title: '두 번 눌러 쓰다듬기' });
  const puppet = petPuppet(el);
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

  // 고른 펫으로 그림과 하트 높이를 맞춘다. 펫 바꾸기 창에서 바꾸면 os.js가 다시 부른다(자리와 하던 일은 그대로다)
  function restyle() {
    const choice = petChoice(host.look?.());
    puppet.look(choice);
    heart.style.setProperty('--dy', heartRise(choice.species)); // h()로 넣은 CSS 변수는 빠지므로 setProperty로 넣는다(known-issues 50)
  }
  restyle();

  const avatarAt = (x, y) => { const s = host.avatar()?.spot(); return !!s && s.x === x && s.y === y; };
  // 펫이 들어갈 수 있는 칸: 방 안이고 벽에 붙은 줄이 아니며, 가구와 아바타가 없는 칸
  const open = (x, y) => x > 0 && y > 0 && x < N && y < N && !blocked.has(key(x, y)) && !avatarAt(x, y);

  // 칸 c에 선 그림이 화면에서 차지하는 네모(무대 px). 그림의 아래 가운데가 칸 가운데(발끝)다
  const rectAt = c => {
    const p = tile(c.x + 0.5, c.y + 0.5);
    return { l: p.x - (size * PET_COLS) / 2, t: p.y - size * PET_ROWS, r: p.x + (size * PET_COLS) / 2, b: p.y };
  };

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
    size = petCell();
    pos = { ...cell };
    puppet.pose('sit');
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
    size = petCell();
    const at = { x: Math.min(start.x, to.x), y: Math.min(start.y, to.y) };
    const [a, b] = [rectAt(start), rectAt(to)];
    const sweep = { l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) };
    const t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / STEP_MS); // 지난 시간으로 계산해 프레임이 적은 창에서도 제시간에 닿는다(known-issues 23)
      pos = { x: start.x + (to.x - start.x) * t, y: start.y + (to.y - start.y) * t };
      puppet.pose(t < 0.5 ? 'walk1' : 'walk2');
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

  // 쓰다듬는 아바타 쪽을 보고 1초 동안 눈을 감으며, 머리 위에 하트를 띄운다.
  // 쓰다듬은 횟수는 host.pat이 센다. 이번에 다 자라면 그 안에서 restyle이 불려 그림이 바뀌므로, 하트 높이를 자란 그림에 맞추려고 먼저 부른다
  function love() {
    if (!cell || !el.isConnected) return;
    waiting = false;
    host.pat?.();
    const s = host.avatar()?.spot();
    if (s) right = s.x - s.y > cell.x - cell.y;
    sit();
    puppet.shut(true);
    heart.style.left = el.style.left;
    heart.style.top = el.style.top;
    heart.style.setProperty('--dx', right ? HEAD_DX : -HEAD_DX); // h()로 넣은 CSS 변수는 빠지므로 setProperty로 넣는다(known-issues 50)
    heart.hidden = true;
    void heart.offsetWidth; // 연달아 쓰다듬으면 떠오르기를 처음부터 다시 한다
    heart.hidden = false;
    clearTimeout(heartTimer);
    heartTimer = setTimeout(() => {
      heart.hidden = true;
      puppet.shut(false);
    }, HEART_MS);
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

  // 걷기, 기다리기, 하트, 숨쉬기를 모두 멈춘다. 걷던 중이면 들어가던 칸에 선다
  function halt() {
    cancelAnimationFrame(raf);
    clearTimeout(restTimer);
    clearTimeout(heartTimer);
    heart.hidden = true;
    puppet.shut(false);
    puppet.live(false);
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
    // 방을 다시 그린 뒤 아바타 다음에 부른다(펫이 아바타가 선 칸을 피해 앉는다). here: 펫이 사는 공간(내 방)인지.
    // 다른 공간에 나가 있는 동안에는 방에 없다가, 돌아오면 앉아 있던 칸에 다시 앉는다. 그 칸에 가구나 아바타가 있으면 가장 가까운 빈칸에 앉는다
    attach(here) {
      halt();
      if (!here) { detach(); return; }
      blocked = blockedOf(host.items());
      if (!cell || !open(cell.x, cell.y)) cell = pickCell(cell);
      if (!cell) { detach(); return; }
      host.layer.append(el, heart);
      sit();
      puppet.live(true);
      rest();
    },
    restyle,
    // 지금 차지한 칸들. 아바타의 길찾기가 이 칸을 피한다. 걷는 동안은 나오는 칸과 들어가는 칸 둘이다
    cells: () => (cell && el.isConnected ? (from ? [from, cell] : [cell]) : []),
    // 아바타가 칸 at(걷는 동안은 두 칸을 합친 자리의 뒤쪽 모서리)에서 그림 네모 rect를 차지하고 순서 z로 그려지려 할 때 부른다(src/avatar.js의 draw).
    // 두 그림이 겹치면 앞에 선 쪽이 위에 오게 아바타의 순서를 돌려주고 펫의 순서를 고친다. 앞뒤는 가구와 같은 규칙(depthZ)으로 가린다
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
