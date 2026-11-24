// 바탕화면 배경의 방을 걸어 다니는 내 아바타(1단계: 서버 없이 내 화면에서만 움직인다).
// 바탕화면은 지내는 화면, 방 꾸미기는 꾸미는 화면이라 아바타는 바탕화면에만 있다(꾸밀 때 가구 놓기를 가리지 않게).
// 아바타는 1×1칸짜리 움직이는 가구처럼 다룬다. 칸 좌표에 서 있고, 가구와 같은 상자에 그려서 가구와 앞뒤 순서를 맞춘다.
// 바닥을 누르면 길을 찾아 걸어가고, 바탕화면이 앞에 있을 때 방향키(WASD)로 한 칸씩 걷고, Enter나 아바타를 누르면 말풍선을 띄운다.
// 이 브라우저에서 아직 말해 보지 않았으면 머리 위에 작은 말풍선 그림(말하기 표시)을 띄워 누를 수 있다는 것을 알린다.
// 그림 규격(한 칸 64×104px, 가로 3칸 × 세로 2줄)은 data/avatars.js에 적혀 있다.
// 친구 집을 구경하면 그 집 주인의 아바타가 방에 서 있다(mountOwner, 2026-11-17까지 실험실 host-avatar).
// 내 방에는 펫이 걸어 다닌다(src/pet.js). 주인 아바타와 펫은 host.others로 아바타와 칸과 앞뒤를 맞춘다.
import { N, DRAG_THRESHOLD, STORAGE_SAID } from './config.js';
import { tile, toTile, placementOf, boxSize } from './iso.js';
import { dims, isWall, supportOf } from './rules.js';
import { zOf } from './room.js';
import { AVATARS, AVATAR_BY_ID, SHEET_SCALE } from '../data/avatars.js';
import { BY_ID } from '../data/furniture.js';
import { h, isField, loadJSON, saveJSON } from './util.js';
import { iconEl } from './icons.js';
import { play } from './sound.js';

const FW = 64;        // 그림 한 칸 가로 (px)
const FH = 104;       // 그림 한 칸 세로 (px)
const FOOT = 100;     // 그림 안에서 발끝의 높이 (px)
const STEP_MS = 200;  // 한 칸 걷는 시간
const SAY_MS = 4000;  // 말풍선이 떠 있는 시간. 글자가 길면 글자마다 60ms씩 더 둔다
const SPAWN = { x: N - 4, y: N - 4 }; // 처음 서는 곳(이 칸이 막혀 있으면 가장 가까운 빈칸)
const HEAD_TOP = 16;  // 그림 상자 위 끝에서 머리 꼭대기(모자 단추의 겉선)까지. data/avatars.js의 그림 규격이다
const TAG_H = 18;     // 주인 아바타의 이름표 높이(style.css의 .room-owner-name). 말풍선은 이름표 위에 띄운다
const TAG_DROP = HEAD_TOP - 1; // 이름표 아래 끝이 그림 상자 위 끝보다 내려오는 만큼. 머리 꼭대기 1px 위에 닿는다
const GREET_MS = 600; // 손님이 방에 들어온 뒤 주인 아바타가 인사말을 하기까지 기다리는 시간
const CUE_GAP = 8;    // 말하기 표시(16×16px 말풍선 그림)의 아래 끝과 머리 꼭대기 사이
const SAY_GAP = 13;   // 말풍선 꼬리 끝과 머리 꼭대기 사이

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

// 아바타 그림을 미리 받는다. 전원을 켤 때(os.js의 boot) 불러, 바탕화면이 처음 뜰 때 아바타가 늦게 나타나지 않게 한다(known-issues 54).
// 받은 그림은 kept에 붙잡아 둔다. 쓰는 곳이 없으면 브라우저가 메모리를 정리할 때 버린다(src/room.js의 hasImage와 같다)
const kept = [];
export function preloadAvatars() {
  if (kept.length) return; // 전원을 다시 켤 때는 이미 받아 둔 것을 쓴다
  for (const a of AVATARS) {
    for (const src of [a.sheet, a.guestSheet]) {
      const img = new Image();
      img.src = src;
      kept.push(img);
    }
  }
}

const inRoom = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

// 바닥 가구가 차지한 칸들. 책상 위 물건은 책상 칸 안에 있으므로 따로 세지 않아도 된다. 펫(src/pet.js)도 쓴다.
export function blockedOf(items) {
  const blocked = new Set();
  for (const it of items) {
    if (isWall(it)) continue;
    const [w, d] = dims(it);
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < d; dy++) blocked.add(key(it.x + dx, it.y + dy));
  }
  return blocked;
}

// 칸 (x, y)에 가장 가까운 빈칸. 방이 가구로 꽉 차 있으면 null.
function nearestFree(blocked, x, y) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const d = Math.abs(i - x) + Math.abs(j - y);
      if (!blocked.has(key(i, j)) && d < bestD) { best = { x: i, y: j }; bestD = d; }
    }
  }
  return best;
}

// 빈 바닥 칸들. 바닥 가구가 차지한 칸과 taken(아바타나 펫이 선 칸)을 뺀다. 분신사바의 빈칸 말풍선(src/horror.js)이 쓴다
export function emptyCells(items, taken = []) {
  const blocked = blockedOf(items);
  for (const c of taken) blocked.add(key(c.x, c.y));
  const cells = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (!blocked.has(key(x, y))) cells.push({ x, y });
  return cells;
}

// 칸 pos(걷는 중에는 소수)에 선 그림의 머리 위에 띄우는 말풍선 자리(무대 px의 left, top. 말풍선은 이 점 위에 꼬리를 대고 뜬다).
// 머리 꼭대기에서 SAY_GAP 위다. 아바타의 말풍선과 분신사바의 빈칸 말풍선(src/horror.js)이 같이 쓴다
export function sayPoint(pos) {
  const c = tile(pos.x + 0.5, pos.y + 0.5);
  return { left: `${Math.round(c.x)}px`, top: `${Math.round(c.y - FOOT) + HEAD_TOP - SAY_GAP}px` };
}

// 칸 pos에 선 아바타의 말하기 표시 자리(무대 px의 left, top. 표시는 이 점 위에 아래 가운데를 대고 뜬다). 머리 꼭대기에서 CUE_GAP 위다
function cuePoint(pos) {
  const c = tile(pos.x + 0.5, pos.y + 0.5);
  return { left: `${Math.round(c.x)}px`, top: `${Math.round(c.y - FOOT) + HEAD_TOP - CUE_GAP}px` };
}

// 칸 cell에 선 아바타 그림이 화면에서 차지하는 네모(무대 px). placeAt이 그리는 자리와 같다.
export function spriteRect(cell) {
  const c = tile(cell.x + 0.5, cell.y + 0.5);
  return { l: c.x - FW / 2, t: c.y - FOOT, r: c.x + FW / 2, b: c.y - FOOT + FH };
}
const unionRect = (a, b) => ({ l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) });
export const overlaps = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

// 가구 그림 상자가 화면에서 차지하는 네모(무대 px). room.js가 놓는 자리(placementOf)와 크기(boxSize) 그대로다.
function furnRect(items, it) {
  const { left, top } = placementOf(items, it);
  const { w, h } = boxSize(BY_ID[it.id], it.r);
  return { l: left, t: top, r: left + w, b: top + h };
}

// 칸 a에 선 아바타를 어느 가구보다 위에 그릴지. 화면에서 아바타 그림(rect)과 겹치는 가구만 본다.
// 그 가운데 아바타가 앞에 있는 가구(겹치지 않는 두 네모를 가르는 축으로 판단)의 순서(room.js의 zOf) 중 가장 높은 것 바로 위에 그린다.
// 겹치지 않는 먼 가구까지 세면 순서 번호가 큰 먼 가구 때문에 아바타가 바로 앞의 가구보다 위로 올라간다(known-issues 53).
// 가구 중심의 합(depthOf)으로만 비교하면 긴 가구 옆에서 앞뒤가 뒤집힌다.
// a: 아바타가 선 칸. 걷는 동안은 두 칸을 합친 자리의 뒤쪽 모서리(작은 x와 작은 y)다.
// rect: 아바타 그림이 차지하는 네모. 걷는 동안은 두 칸의 네모를 합친 것이다.
export function depthZ(items, a, rect = spriteRect(a)) {
  let z = 100;
  for (const it of items) {
    if (isWall(it)) continue;
    const [w, d] = dims(it);
    if ((a.x >= it.x + w || a.y >= it.y + d) && overlaps(rect, furnRect(items, it))) z = Math.max(z, zOf(items, it));
  }
  return z + 1;
}

// 칸 a로 앞뒤를 정한 그림의 네모 rect(무대 px)를 가리는 바닥 가구가 있는지. depthZ로 정한 순서보다 순서가 높은 가구가 rect와 겹치면 가린다.
// 날아드는 비둘기 떼(src/pigeon.js)가 나는 동안 가구 뒤로 숨는 칸에는 앉지 않게 할 때 쓴다
export function covered(items, a, rect) {
  const z = depthZ(items, a, rect);
  return items.some(it => !isWall(it) && zOf(items, it) > z && overlaps(rect, furnRect(items, it)));
}

// 아바타 그림 상자 하나. 그림 시트를 배경으로 깔고 칸을 backgroundPosition으로 고른다(placeAt).
// guest: 주인 아바타가 서 있는 친구 집의 손님이면 손님 그림(guestSheet, 모자가 빨강)을 쓴다
function avatarEl(avatarId, guest = false) {
  const def = AVATAR_BY_ID[avatarId] || AVATAR_BY_ID.basic;
  const el = h('div', { className: 'room-avatar' });
  el.style.backgroundImage = `url("${guest ? def.guestSheet : def.sheet}")`;
  return el;
}

// 칸 pos(걷는 중에는 소수)에 선 아바타 그림 상자의 왼쪽 위(무대 px)와 발끝 c. 화면(placeAt)과 방 그림(avatarStill)이 같이 쓴다.
function boxAt(pos) {
  const c = tile(pos.x + 0.5, pos.y + 0.5);
  return { c, left: Math.round(c.x - FW / 2), top: Math.round(c.y - FOOT) };
}

// 발끝을 칸(걷는 중에는 소수) 가운데에 맞춰 놓고, 방향과 걸음에 맞는 그림 칸을 보여 준다. 발끝의 화면 위치를 돌려준다.
function placeAt(el, pos, facing, col) {
  const { c, left, top } = boxAt(pos);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.backgroundPosition = `${-col * FW}px ${-facing.row * FH}px`;
  el.classList.toggle('flip', facing.flip);
  return c;
}

// 공유하기에서 내려받는 방 그림(src/room-image.js)에 세울 아바타 한 명. 화면과 같은 그림과 자리(boxAt), 가구와의 앞뒤(depthZ)를 쓴다.
// items: 그 공간의 가구. spot: 설 칸 { x, y }과 방향 facing(걷는 아바타의 spot()이 준다). 없으면 처음 서는 곳에 앞을 보고 선다.
// 그 칸이 막혀 있으면 가장 가까운 빈칸에 선다(화면의 attach와 같다). 공유하기는 내 집에서만 열려서 손님 그림은 쓰지 않는다.
// 돌려주는 것: { src(그림 주소), frame(그림에서 오려 낼 네모, 그림 파일 px), left, top, w, h, flip, z }. 설 칸이 없으면 null
export function avatarStill(items, spot, avatarId = 'basic') {
  const blocked = blockedOf(items);
  const want = spot || SPAWN;
  const cell = inRoom(want.x, want.y) && !blocked.has(key(want.x, want.y)) ? { x: want.x, y: want.y } : nearestFree(blocked, want.x, want.y);
  if (!cell) return null;
  const facing = spot?.facing || FACING['0,1'];
  const def = AVATAR_BY_ID[avatarId] || AVATAR_BY_ID.basic;
  const { left, top } = boxAt(cell);
  return {
    // 시트에서 그 방향의 서 있는 칸을 오려 낸다. 그림 파일은 화면 크기의 SHEET_SCALE배다
    src: def.sheet,
    frame: { x: 0, y: facing.row * FH * SHEET_SCALE, w: FW * SHEET_SCALE, h: FH * SHEET_SCALE },
    left, top, w: FW, h: FH, flip: facing.flip,
    z: depthZ(items, cell),
  };
}

// host: 아바타가 사는 곳(지금은 바탕화면 배경, os.js가 넘긴다).
//   layer          가구와 아바타가 같이 들어 있는 상자. 다시 그리면 비워지므로 그 뒤에 attach를 부른다
//   items()        그 방의 가구 목록
//   toLocal(x, y)  화면 좌표 → 방 좌표(1280×720)
//   input          바닥 클릭을 받는 요소. 이 요소 자체를 누른 것만 바닥으로 본다(아이콘, 창, 가구는 건너뛴다)
//   sayRoot        말하기 입력 칸을 넣을 상자
//   active()       키를 받아도 되는지(앞에 있는 창이 없을 때)
//   onSay(text)    사용자가 말하기 칸에 쳐서 말했을 때(앞뒤 공백을 뺀 글). 가구가 시킨 혼잣말(say)에는 부르지 않는다
//   others()       같은 공간에 있는 다른 그림 목록(친구 집의 주인 mountOwner, 내 방의 펫 src/pet.js의 mountPet). 저마다 cells()로 차지한 칸을,
//                  order()로 앞뒤를 알려 준다. 그 칸은 지나가지 못하고, 그림이 겹치면 앞뒤를 맞춘다. 펫은 걸어 다니므로 칸은 그때그때 묻는다. 없어도 된다
// guest: true이면 손님 그림(data/avatars.js의 guestSheet, 모자가 빨강)을 쓴다. 주인 아바타가 서 있는 친구 집에서 주인과 구분하려고 쓴다
// 돌려주는 것: attach(다시 그린 뒤), spot(지금 선 칸), openSay, typing, approachCell, stepsTo, behind, lookAt, halt, restack, destroy
export function mountAvatar(host, avatarId = 'basic', { guest = false } = {}) {
  const el = avatarEl(avatarId, guest);
  el.title = '눌러서 말하기';
  const bubble = h('div', { className: 'room-avatar-say', hidden: true });
  const input = h('input', {
    className: 'say-input', type: 'text', maxLength: 40, hidden: true,
    placeholder: '할 말을 쓰고 Enter (Esc는 취소)', 'aria-label': '말풍선에 쓸 말',
  });
  host.sayRoot.append(input);
  // 말하기 표시: 이 브라우저에서 아직 한 번도 말하지 않았으면 머리 위에 작은 말풍선 그림을 띄운다(내 집과 손님 화면 모두).
  // 누르면 아바타를 누른 것처럼 말할 칸이 열리고, 처음 말하면 저장해 두어 다시는 띄우지 않는다(STORAGE_SAID).
  // 말풍선이나 말할 칸이 떠 있는 동안은 숨기고, 튜토리얼 카드가 떠 있는 동안은 style.css가 숨긴다(.stage.coaching)
  let said = !!loadJSON(STORAGE_SAID);
  const cue = h('div', { className: 'say-cue', title: '눌러서 말하기', hidden: true }, iconEl({ title: '말하기', icon: 'builtin:say' }, 16));

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
  let arrive = null; // 가구 옆에 다 왔을 때 할 일 { goal(x, y), face(), then() }. 다른 데로 걸으면 버린다
  let target = null; // 바닥을 눌러 가려는 칸. 길에 펫이 들어오면 이 칸으로 길을 다시 찾는다
  let drawnAt = null; // 마지막으로 앞뒤를 정한 자리 [at, rect]. 펫이 움직이면 이 자리로 앞뒤를 다시 맞춘다(restack)
  const held = []; // 누르고 있는 방향키. 나중에 누른 것이 먼저다

  // 다른 그림(친구 집의 주인, 내 방의 펫)이 차지한 칸. 펫은 걸어 다니므로 attach 때 적어 두지 않고 그때그때 묻는다
  const taken = (x, y) => (host.others?.() || []).some(o => o.cells().some(c => c.x === x && c.y === y));
  const free = (x, y) => inRoom(x, y) && !blocked.has(key(x, y)) && !taken(x, y);

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

  // 지금 칸에서 넓이 우선으로 훑어 goal(x, y)을 처음 만족하는 빈칸까지의 길. 지금 칸이 goal이면 [], 갈 수 없으면 null.
  function pathTo(goal) {
    const from = { ...me };
    if (goal(from.x, from.y)) return [];
    const prev = new Map([[key(from.x, from.y), null]]);
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      for (const [dx, dy] of DIRS) {
        const n = { x: c.x + dx, y: c.y + dy };
        if (!free(n.x, n.y) || prev.has(key(n.x, n.y))) continue;
        prev.set(key(n.x, n.y), c);
        if (goal(n.x, n.y)) {
          const out = [n];
          for (let p = c; p && p !== from; p = prev.get(key(p.x, p.y))) out.unshift(p);
          return out;
        }
        queue.push(n);
      }
    }
    return null;
  }

  // 가구를 쓰러 가서 설 칸(goal)과 다 와서 볼 쪽(face). 벽 가구는 그 벽 바로 앞 바닥 칸에, 책상 위 물건은 책상 둘레 칸에 선다.
  function besideOf(item) {
    if (isWall(item)) return besideWall(item.wall, item.x, dims(item)[0]);
    const base = supportOf(host.items(), item) || item;
    const [w, d] = dims(base);
    const inside = (x, y) => x >= base.x && x < base.x + w && y >= base.y && y < base.y + d;
    return {
      goal: (x, y) => !inside(x, y) && DIRS.some(([dx, dy]) => inside(x + dx, y + dy)),
      face: () => FACING[me.x < base.x ? '1,0' : me.x >= base.x + w ? '-1,0' : me.y < base.y ? '0,1' : '0,-1'],
    };
  }

  // 벽의 칸 from부터 w칸 바로 앞에 설 칸과 볼 쪽. 오른쪽 벽은 y = 0 줄, 왼쪽 벽은 x = 0 줄 바로 앞이다(iso.js의 wallPoint).
  function besideWall(wall, from, w) {
    const along = u => u >= from && u < from + w;
    return {
      goal: (x, y) => (wall === 'R' ? y === 0 && along(x) : x === 0 && along(y)),
      face: () => FACING[wall === 'R' ? '0,-1' : '-1,0'],
    };
  }

  // 가구 옆까지 걸어가 가구 쪽을 본 뒤 then을 부른다(바탕화면에서 가구를 두 번 눌렀을 때).
  function approach(item, then) {
    const { goal, face } = besideOf(item);
    go(goal, face, then);
  }

  // 벽의 칸 from부터 w칸 바로 앞까지 걸어가 벽 쪽을 본 뒤 then을 부른다. 벽 가구와 현관문이 쓴다.
  function approachWall(wall, from, w, then) {
    const { goal, face } = besideWall(wall, from, w);
    go(goal, face, then);
  }

  // 가구 옆까지 걸어갈 칸 수. 이미 옆에 서 있으면 0, 갈 수 있는 칸이 없으면 null(실험실의 심심할 때 혼잣말이 갈 가구를 고를 때 쓴다, src/idle-talk.js)
  function stepsTo(item) {
    return pathTo(besideOf(item).goal)?.length ?? null;
  }

  // 칸 c 바로 옆 칸까지 걸어가 c 쪽을 본 뒤 then을 부른다. 펫을 쓰다듬으러 갈 때 쓴다(src/pet.js)
  function approachCell(c, then) {
    const face = () => FACING[me.x < c.x ? '1,0' : me.x > c.x ? '-1,0' : me.y < c.y ? '0,1' : '0,-1'];
    go((x, y) => Math.abs(x - c.x) + Math.abs(y - c.y) === 1, face, then);
  }

  // goal(x, y)를 만족하는 가장 가까운 빈칸까지 걸어가 face()쪽을 본 뒤 then을 부른다. 갈 수 있는 칸이 없으면 그 자리에서 바로 부른다.
  function go(goal, face, then) {
    held.length = 0;
    const route = pathTo(goal);
    if (!route) { then(); return; }
    arrive = { goal, face, then };
    path = route;
    if (!walking) nextStep();
  }

  // 지금 자리에 그린다. at이 있으면 그 칸 기준으로 가구와의 앞뒤 순서도 다시 정한다.
  // rect: 앞뒤를 따질 가구를 고를 때 쓰는 아바타 그림의 네모(없으면 at 칸에 섰을 때의 네모)
  function draw(at, rect) {
    placeAt(el, pos, facing, col);
    if (at) {
      drawnAt = [at, rect];
      let z = depthZ(host.items(), at, rect);
      for (const o of host.others?.() || []) z = o.order(at, rect || spriteRect(at), z);
      el.style.zIndex = z;
    }
    if (!bubble.hidden) Object.assign(bubble.style, sayPoint(pos));
    syncCue();
  }

  function syncCue() {
    const show = !said && bubble.hidden && input.hidden && el.isConnected;
    if (show) Object.assign(cue.style, cuePoint(pos));
    if (cue.hidden === show) cue.hidden = !show;
  }

  const active = () => host.active();

  function stop() {
    cancelAnimationFrame(raf);
    walking = false;
    path = [];
    arrive = null;
    target = null;
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
    // 걸어가던 길에 펫이 들어와 있으면 그 칸을 피해 같은 곳으로 길을 다시 찾는다
    if (path.length && !free(path[0].x, path[0].y)) path = arrive ? pathTo(arrive.goal) || [] : target ? findPath(target) : [];
    if (!path.length) {
      walking = false;
      col = 0;
      pos = { ...me };
      const a = arrive;
      arrive = null;
      if (a) facing = a.face();
      draw(me);
      a?.then();
      return;
    }
    walking = true;
    const from = { ...me };
    const to = path.shift();
    facing = FACING[key(to.x - from.x, to.y - from.y)];
    col = steps++ % 2 ? 2 : 1;
    if (col === 1) play('step'); // 한 칸이 0.2초라 두 칸마다(왼발) 한 번 낸다. 사람 걸음과 비슷한 0.4초 간격
    // 걷는 동안에는 두 칸을 합친 자리로 앞뒤를 정해 두어 한 걸음 사이에 순서가 바뀌어 깜빡이지 않게 한다.
    // 두 칸 모두보다 뒤에 있는 가구 위에만 그리므로, 가구 모서리를 돌 때 걸음 처음부터 가구 앞으로 튀어나오지 않는다.
    // 겹치는 가구도 두 칸의 그림을 합친 네모로 고른다(그림이 두 칸 사이를 지나는 동안 어느 쪽 가구와도 겹칠 수 있다).
    const span = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) };
    const sweep = unionRect(spriteRect(from), spriteRect(to));
    me.x = to.x;
    me.y = to.y;
    const t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / STEP_MS);
      pos = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      draw(span, sweep);
      if (t < 1) raf = requestAnimationFrame(tick);
      else nextStep();
    };
    raf = requestAnimationFrame(tick);
  }

  function walkTo(to) {
    arrive = null;
    target = to;
    path = findPath(to);
    if (!walking) nextStep();
  }

  // 말풍선을 띄우고 떠 있을 시간(ms)을 돌려준다. 쓰는 동안의 가구 그림(문이 열린 옷장)이 그만큼 보인다(os.js의 openFurniture)
  function say(text) {
    const t = text.trim();
    if (!t) return 0;
    bubble.textContent = t;
    bubble.hidden = false;
    draw(null);
    clearTimeout(sayTimer);
    const ms = SAY_MS + t.length * 60;
    sayTimer = setTimeout(() => {
      bubble.hidden = true;
      syncCue();
    }, ms);
    return ms;
  }

  function openSay() {
    input.hidden = false;
    input.value = '';
    input.focus();
    syncCue();
  }

  function closeSay() {
    input.hidden = true;
    input.blur();
    syncCue();
  }

  // ---------- 입력 ----------
  // 바닥을 눌렀다 떼면 그 칸으로 걸어간다. 아이콘, 창, 눌리는 가구를 누른 것은 그쪽이 맡으므로 건너뛴다.
  let down = null;
  function onFloorDown(e) {
    if (e.button !== 0 || e.target !== host.input) return;
    down = host.toLocal(e.clientX, e.clientY);
  }
  function onFloorUp(e) {
    if (!down) return;
    const start = down;
    down = null;
    const p = host.toLocal(e.clientX, e.clientY);
    if (Math.hypot(p.x - start.x, p.y - start.y) > DRAG_THRESHOLD) return;
    const t = toTile(p.x, p.y);
    const target = { x: Math.floor(t.x), y: Math.floor(t.y) };
    if (!inRoom(target.x, target.y)) return;
    held.length = 0;
    walkTo(target);
  }

  function onKeyDown(e) {
    // Cmd+S, Ctrl+D, Alt+←처럼 조합 키를 누른 것은 브라우저 단축키이므로 건드리지 않는다.
    // 맥은 Cmd를 누른 동안 다른 키의 keyup을 보내지 않아서, 누르고 있던 키도 뗀 것으로 본다(known-issues 37).
    if (e.ctrlKey || e.metaKey || e.altKey) {
      held.length = 0;
      return;
    }
    if (!active() || isField(e.target)) return;
    if (KEYS[e.code]) {
      e.preventDefault();
      if (!held.includes(e.code)) held.push(e.code);
      path = []; // 방향키를 누르면 클릭으로 정한 길과 가구로 가던 일은 버린다
      arrive = null;
      if (!walking) nextStep();
    } else if (e.key === 'Enter' && !e.isComposing) {
      // 바탕화면이 앞에 있을 때 Enter는 늘 말하기다. 초점이 남은 버튼(전원 등)이 대신 눌리지 않게 기본 동작을 막는다.
      // 예전 볼록 화면의 보정 층으로 누르면 초점이 옮겨 가지 않아, 전원 버튼에 초점이 남은 채 Enter가 전원을 껐다(known-issues 26).
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
      const text = input.value.trim();
      if (text && !said) {
        said = true;
        saveJSON(STORAGE_SAID, true);
      }
      say(text);
      host.onSay?.(text);
      closeSay();
    } else if (e.key === 'Escape') {
      closeSay();
    }
  });
  input.addEventListener('blur', () => {
    input.hidden = true;
    syncCue();
  });

  el.addEventListener('click', openSay); // 아바타를 누르면 말하기
  cue.addEventListener('click', openSay);

  host.input.addEventListener('pointerdown', onFloorDown);
  host.input.addEventListener('pointerup', onFloorUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    // 방을 다시 그린 뒤 부른다. 방 그림(room.js의 renderStatic)이 상자를 비우고 다시 채우므로 아바타와 말풍선을 다시 넣는다.
    // 서 있던 칸에 가구가 놓였으면(방 꾸미기에서 옮겼으면) 가장 가까운 빈칸으로 옮긴다.
    // 다른 아바타(친구 집의 주인)가 선 칸도 막힌 칸으로 본다. 그 아바타가 먼저 attach되어 있어야 한다.
    // 펫(src/pet.js)은 이 아바타 다음에 attach해서 아바타가 선 칸을 피해 앉는다.
    attach() {
      stop();
      blocked = blockedOf(host.items());
      if (!placed || !free(me.x, me.y)) {
        const busy = new Set(blocked);
        for (const o of host.others?.() || []) for (const c of o.cells()) busy.add(key(c.x, c.y));
        const spot = nearestFree(busy, placed ? me.x : SPAWN.x, placed ? me.y : SPAWN.y);
        if (!spot) { el.remove(); return; }
        me.x = spot.x;
        me.y = spot.y;
        placed = true;
      }
      pos = { ...me };
      host.layer.append(el, bubble, cue);
      draw(me);
    },
    // 다른 공간으로 옮겨 갈 때, 방을 다시 그리기 전에 부른다. 다음 attach에서 spot 칸(막혀 있으면 가장 가까운 빈칸)에 앞을 보고 선다.
    // spot이 없으면 처음 서는 곳이다.
    moveTo(spot = SPAWN) {
      stop();
      me.x = spot.x;
      me.y = spot.y;
      facing = FACING['0,1'];
      placed = true;
    },
    // 지금 서 있는 칸과 방향(걷는 중에는 들어가는 칸). 공유하기의 방 그림이 avatarStill에 넘긴다. 방이 꽉 차 서 있지 못하면 null
    spot: () => (placed && el.isConnected ? { x: me.x, y: me.y, facing } : null),
    openSay,
    // 말풍선에 쓸 말을 치는 칸이 열려 있는지
    typing: () => !input.hidden,
    say,
    approach,
    approachWall,
    approachCell,
    stepsTo,
    // 바라보는 쪽의 반대편 칸(방 밖이거나 가구가 놓인 칸일 수도 있다). 분신사바의 "바로 뒤야." 말풍선이 뜰 칸을 고를 때 쓴다(src/horror.js)
    behind() {
      const [dx, dy] = Object.keys(FACING).find(k => FACING[k] === facing).split(',').map(Number);
      return { x: me.x - dx, y: me.y - dy };
    },
    // 선 자리에서 칸 c 쪽을 돌아본다. 걷지 않고, 걷는 중이면 그대로 둔다. 분신사바의 빈칸 말풍선이 뜨면 그쪽을 본다(src/horror.js)
    lookAt(c) {
      const dx = c.x - me.x;
      const dy = c.y - me.y;
      if (walking || !el.isConnected || (!dx && !dy)) return;
      facing = FACING[Math.abs(dx) >= Math.abs(dy) ? key(Math.sign(dx), 0) : key(0, Math.sign(dy))];
      draw(null);
    },
    // 가던 길과 다 와서 할 일을 버린다. 걷던 한 칸은 마저 걸어 칸 위에 선다.
    // 실험실의 심심할 때 혼잣말이 가구로 걷던 중에 사용자가 마우스나 키를 건드리면 부른다(src/idle-talk.js)
    halt() {
      path = [];
      arrive = null;
      target = null;
    },
    // 다른 그림(펫)이 움직였을 때 부른다. 마지막으로 그린 자리로 그 그림과의 앞뒤를 다시 맞춘다
    restack() {
      if (drawnAt && el.isConnected) draw(...drawnAt);
    },
    destroy() {
      stop();
      clearTimeout(sayTimer);
      host.input.removeEventListener('pointerdown', onFloorDown);
      host.input.removeEventListener('pointerup', onFloorUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      el.remove();
      bubble.remove();
      cue.remove();
      input.remove();
    },
  };
}

// 친구 집의 주인 아바타가 설 칸. 링크에 담지 않으므로 그 방의 가구 배치만으로 늘 같은 칸을 고른다.
// 손님이 들어와 서는 칸(처음 서는 곳과 arrivals)과 그림이 겹치는 칸, 벽에 붙은 줄(벽 가구와 문을 쓰러 가서 서는 칸),
// 막으면 손님이 걸어갈 수 있는 칸이 줄어드는 칸은 고르지 않는다. 남은 칸은 가구 바로 옆이 아닌 칸(주인이 가구 앞을 막지 않게),
// 처음 서는 곳과 화면의 세로줄이 다른 칸(둘이 앞뒤로 줄 선 것처럼 보이지 않게), 방 가운데에 가까운 칸 순서로 고른다. 설 칸이 없으면 null.
function ownerCell(items, arrivals) {
  const blocked = blockedOf(items);
  const free = (x, y) => inRoom(x, y) && !blocked.has(key(x, y));
  const start = nearestFree(blocked, SPAWN.x, SPAWN.y);
  if (!start) return null;
  // 처음 서는 곳에서 걸어갈 수 있는 칸의 수. skip 칸은 막힌 것으로 본다
  const reach = skip => {
    const seen = new Set([key(start.x, start.y)]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      for (const [dx, dy] of DIRS) {
        const n = { x: queue[i].x + dx, y: queue[i].y + dy };
        if (!free(n.x, n.y) || seen.has(key(n.x, n.y)) || (n.x === skip?.x && n.y === skip?.y)) continue;
        seen.add(key(n.x, n.y));
        queue.push(n);
      }
    }
    return seen.size;
  };
  const all = reach(null);
  const mid = (N - 1) / 2;
  const column = (a, b) => Math.abs(a.x - a.y - (b.x - b.y)) < 2; // 화면에서 두 그림의 가로 자리가 겹친다
  const cells = [];
  for (let x = 1; x < N; x++) {
    for (let y = 1; y < N; y++) {
      const c = { x, y };
      if (!free(x, y) || [start, ...arrivals].some(a => column(a, c) && Math.abs(a.x + a.y - (x + y)) < 6)) continue;
      cells.push({ ...c, near: DIRS.some(([dx, dy]) => blocked.has(key(x + dx, y + dy))), col: column(start, c), d: (x - mid) ** 2 + (y - mid) ** 2 });
    }
  }
  cells.sort((a, b) => a.near - b.near || a.col - b.col || a.d - b.d);
  const best = cells.find(c => reach(c) === all - 1);
  return best ? { x: best.x, y: best.y } : null;
}

// 친구 집을 구경할 때 방에 서 있는 주인 아바타. 걷지 않고 한 칸(ownerCell)에 서서
// 머리 위에 주인 이름표를 달고, 손님이 방에 들어오면 주인이 적어 둔 인사말을 말풍선으로 한 번 말한다.
// 손님 아바타는 주인이 선 칸을 지나가지 못하고(mountAvatar의 host.others), 두 그림이 겹치면 앞에 선 쪽이 위에 그려진다(order).
// 누르기는 받지 않는다. 한 자리에 계속 서 있어서, 받으면 뒤에 가려진 가구를 두 번 눌러 쓸 수 없다.
// host: { layer, items() }(mountAvatar와 같다). name: 이름표에 쓸 주인 이름
export function mountOwner(host, name, avatarId = 'basic') {
  const el = avatarEl(avatarId);
  el.classList.add('room-owner');
  const tag = h('div', { className: 'room-owner-name' }, name);
  const bubble = h('div', { className: 'room-avatar-say', hidden: true });
  let cell = null; // 서 있는 칸. 주인이 없는 공간(내 방이 아닌 공간)이거나 방이 꽉 차 설 칸이 없으면 null
  let facing = FACING['0,1'];
  let base = 0;    // 가구와의 앞뒤로 정한 순서(depthZ)
  let greetTimer = 0;
  let sayTimer = 0;

  // 서 있는 그림을 그리고 이름표를 머리 위에, 말풍선을 이름표 위에 띄운다
  function draw() {
    const c = placeAt(el, cell, facing, 0);
    const x = `${Math.round(c.x)}px`;
    const tagBottom = Math.round(c.y - FOOT + TAG_DROP);
    tag.style.left = x;
    tag.style.top = `${tagBottom}px`;
    bubble.style.left = x;
    bubble.style.top = `${tagBottom - TAG_H - 9}px`; // 말풍선 꼬리(7px)가 이름표에 닿지 않게 띄운다
  }

  function hush() {
    clearTimeout(greetTimer);
    clearTimeout(sayTimer);
    bubble.hidden = true;
  }

  const detach = () => {
    el.remove();
    tag.remove();
    bubble.remove();
  };

  return {
    cells: () => (cell ? [cell] : []), // 차지한 칸. 손님 아바타가 이 칸을 지나가지 못한다(mountAvatar의 host.others)
    // 방을 다시 그린 뒤, 손님 아바타보다 먼저 부른다(손님이 주인이 선 칸을 피해 서야 한다).
    // here: 주인이 서 있는 공간인지. door: 손님이 문으로 들어와 서는 칸. 주인은 그 칸과 그림이 겹치지 않는 곳에 선다
    attach(here, door) {
      hush();
      cell = here ? ownerCell(host.items(), door ? [door] : []) : null;
      if (!cell) { detach(); return; }
      facing = FACING['0,1'];
      base = depthZ(host.items(), cell);
      el.style.zIndex = base;
      host.layer.append(el, tag, bubble);
      draw();
    },
    // 손님 아바타가 칸 at(걷는 동안은 두 칸을 합친 자리의 뒤쪽 모서리)에서 그림 네모 rect를 차지하고 순서 z로 그려지려 할 때 부른다.
    // 두 그림이 겹치면 앞에 선 쪽이 위에 오게 손님의 순서를 돌려주고 주인의 순서를 고친다. 앞뒤는 가구와 같은 규칙(depthZ)으로 가린다
    order(at, rect, z) {
      if (!cell) return z;
      let mine = base;
      if (overlaps(rect, spriteRect(cell))) {
        if (at.x >= cell.x + 1 || at.y >= cell.y + 1) z = Math.max(z, base + 1);
        else mine = Math.max(base, z + 1);
      }
      el.style.zIndex = mine;
      return z;
    },
    // 손님이 방에 들어왔을 때 부른다. 잠깐 뒤에 손님(칸 guest) 쪽을 보고 인사말 text를 한 번 말한다. 인사말이 비었으면 말하지 않는다
    greet(text, guest) {
      const t = (text || '').trim();
      if (!cell || !t) return;
      clearTimeout(greetTimer);
      greetTimer = setTimeout(() => {
        // 얼굴이 보이게 앞모습 두 방향(왼쪽 아래, 오른쪽 아래) 가운데 손님이 화면에서 있는 쪽을 본다
        if (guest) facing = FACING[guest.x - guest.y > cell.x - cell.y ? '1,0' : '0,1'];
        bubble.textContent = t;
        bubble.hidden = false;
        draw();
        clearTimeout(sayTimer);
        sayTimer = setTimeout(() => { bubble.hidden = true; }, SAY_MS + t.length * 60);
      }, GREET_MS);
    },
    destroy() {
      hush();
      detach();
    },
  };
}
