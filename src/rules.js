// 배치 규칙. 화면과 무관한 순수 함수만 둔다 (공유 링크 검사에도 같이 쓴다).
// 방 상태의 가구 한 개: 바닥 쪽은 { id, x, y } (바닥 칸), 벽 가구는 { id, wall: 'L'|'R', x: u, y: v }
import { N, WALL_ROWS } from './config.js';
import { BY_ID } from '../data/furniture.js';

export const isWall = item => BY_ID[item.id].zone === 'wall';

// 칸 수 [가로, 세로]. 바닥 가구를 돌려 놓으면(r: 1) 가로와 세로가 바뀐다.
export function dims(item) {
  const [w, d] = BY_ID[item.id].size;
  return item.r && !isWall(item) ? [d, w] : [w, d];
}

function overlaps(a, b) {
  const [aw, ad] = dims(a);
  const [bw, bd] = dims(b);
  return a.x < b.x + bw && b.x < a.x + aw && a.y < b.y + bd && b.y < a.y + ad;
}

// a의 바닥 면이 칸 네모 box { x, y, w, d } 안에 완전히 들어가는지
export function insideBox(a, box) {
  const [w, d] = dims(a);
  return a.x >= box.x && a.y >= box.y && a.x + w <= box.x + box.w && a.y + d <= box.y + box.d;
}

// a의 바닥 면이 s의 바닥 면 안에 완전히 들어가는지
function inside(a, s) {
  const [w, d] = dims(s);
  return insideBox(a, { x: s.x, y: s.y, w, d });
}

// 'top' 가구가 올라앉은 surface 가구. 바닥에 있거나 'top'이 아니면 null.
export function supportOf(items, item) {
  if (BY_ID[item.id].zone !== 'top') return null;
  return items.find(s => s !== item && !isWall(s) && BY_ID[s.id].surface && inside(item, s)) || null;
}

// item의 바닥 면이 surface 가구(책상, 식탁)의 바닥 면 안에 들어가 있는지. zone과 상관없이 본다.
// 'top'에서 'floor'로 바꾼 가구가 예전 저장본에서 책상 위에 있었는지 가릴 때 쓴다(src/share.js의 sanitizeItems)
export const onSurface = (items, item) =>
  !isWall(item) && items.some(s => s !== item && !isWall(s) && BY_ID[s.id].surface && inside(item, s));

// surface 가구 s의 윗면 그림이 차지하는 칸 범위(data/furniture.js의 tabletop)를 방의 칸 좌표 [x0, y0, x1, y1]로. 적지 않은 가구는 칸 전부다.
// 돌려 놓은 가구(r: 1)는 그림이 좌우로 뒤집혀 가로와 세로가 바뀐다.
function topOf(s) {
  const { size: [w, d], tabletop } = BY_ID[s.id];
  const [x0, y0, x1, y1] = tabletop || [0, 0, w, d];
  return s.r ? [s.x + y0, s.y + x0, s.x + y1, s.y + x1] : [s.x + x0, s.y + y0, s.x + x1, s.y + y1];
}

// 가구 s의 칸 위의 점(방의 칸 좌표)을 윗면 그림 안의 자리로 모은다. 칸 전부를 윗면 크기로 고르게 줄이고,
// 그 점에 놓이는 것의 밑면 [가로 칸, 세로 칸]이 윗면 밖으로 나가지 않게 가장자리에서 반 폭만큼 들여놓는다. 밑면이 윗면보다 크면 윗면 한가운데다.
const BASE = [0.7, 0.7];
const within = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi));
function toTop(s, x, y, [bw, bd] = BASE) {
  if (!BY_ID[s.id].tabletop) return { x, y };
  const [x0, y0, x1, y1] = topOf(s);
  const [w, d] = dims(s);
  return {
    x: within(x0 + ((x - s.x) / w) * (x1 - x0), x0 + bw / 2, x1 - bw / 2),
    y: within(y0 + ((y - s.y) / d) * (y1 - y0), y0 + bd / 2, y1 - bd / 2),
  };
}

// 윗면 높이로 본 점(방의 칸 좌표)이 가구 s의 윗면 그림 위면 그 점에 해당하는 칸 위의 점(toTop의 거꾸로), 아니면 null.
// 가장자리에서 edge칸 벗어난 점까지 윗면으로 본다. 책상 위로 끌어 온 물건이 놓일 칸을 정할 때 쓴다(src/room.js의 beginDrag)
export function fromTop(s, x, y, edge = 0.3) {
  const [x0, y0, x1, y1] = topOf(s);
  if (x < x0 - edge || x > x1 + edge || y < y0 - edge || y > y1 + edge) return null;
  const [w, d] = dims(s);
  return { x: s.x + ((x - x0) / (x1 - x0)) * w, y: s.y + ((y - y0) / (y1 - y0)) * d };
}

// 가구가 그려지는 자리 { x, y, elev }. x와 y는 방의 칸 좌표(소수일 수 있다), elev는 바닥에서 떠 있는 높이(무대 px)다.
// 놓인 칸 그대로이고, 책상이나 식탁 위의 물건만 그 가구의 윗면 그림 안에 모은다. 윗면이 칸과 다르게 그려져도 물건이 윗면 밖에 뜨지 않는다.
export function drawnAt(items, item) {
  const s = supportOf(items, item);
  if (!s) return { x: item.x, y: item.y, elev: 0 };
  const [w, d] = dims(item);
  const base = BY_ID[item.id].base || BASE;
  const c = toTop(s, item.x + w / 2, item.y + d / 2, item.r ? [base[1], base[0]] : base);
  return { x: c.x - w / 2, y: c.y - d / 2, elev: BY_ID[s.id].height };
}

// 바닥 가구 item 위에 펫(고양이)이 올라가 앉을 수 있는 자리들(data/furniture.js의 perch, perchAt). 자리마다 { x, y, h, cell }이고,
// x와 y는 발끝이 놓이는 방의 칸 좌표(소수), h는 윗면 높이(무대 px), cell은 그 자리의 칸이다. 앉는 자리를 적지 않은 가구는 칸마다 가운데에 앉고
// (윗면이 칸과 다른 책상과 식탁에서는 물건처럼 윗면 안에 모이므로 발끝이 cell 밖에 놓이기도 한다),
// 그 칸에 올라앉은 물건(supportOf가 이 가구를 돌려주는 'top' 가구)이 있으면 뺀다. 돌려 놓은 가구(r: 1)는 그림이 좌우로 뒤집혀
// 가로와 세로가 바뀌므로 적어 둔 자리도 바꾼다. 펫(src/pet.js)이 쓴다
export function perchesOf(items, item) {
  const def = BY_ID[item.id];
  if (!def.perch || isWall(item)) return [];
  const [w, d] = dims(item);
  const spots = [];
  if (def.perchAt) spots.push(item.r ? [def.perchAt[1], def.perchAt[0]] : def.perchAt);
  else for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < d; dy++) spots.push([dx + 0.5, dy + 0.5]);
  const held = items.filter(t => supportOf(items, t) === item);
  return spots
    .map(([dx, dy]) => ({ x: item.x + dx, y: item.y + dy }))
    .filter(s => !held.some(t => {
      const [tw, td] = dims(t);
      return s.x >= t.x && s.x < t.x + tw && s.y >= t.y && s.y < t.y + td;
    }))
    .map(s => ({ ...(def.perchAt ? s : toTop(item, s.x, s.y)), h: def.perch, cell: { x: Math.floor(s.x), y: Math.floor(s.y) } }));
}

// 벽 가구 item이 그 공간의 현관문(config.js의 SCENES door) 자리를 가리는지. scene: SCENES 한 줄.
// 방 꾸미기에서 새로 걸 때만 막고(room.js의 beginDrag), 저장본이나 링크를 불러올 때는 막지 않는다(canPlace에 넣지 않는 까닭이다. src/share.js의 sanitizeHome이 canPlace로 거른다).
// 현관문이 생기기 전에 그 자리에 걸어 둔 창문이 불러올 때 조용히 사라지지 않게 하려는 것이다. 옮기면 다시는 그 자리에 걸지 못한다.
export function coversDoor(scene, item) {
  const d = scene?.door;
  if (!d || !isWall(item) || item.wall !== d.wall) return false;
  const [w] = dims(item);
  return item.x < d.x + d.w && d.x < item.x + w && item.y < d.h;
}

// others: 이미 놓여 있는 가구들. item 을 그 사이에 놓을 수 있는지.
export function canPlace(others, item) {
  const def = BY_ID[item.id];
  const [w, h] = dims(item);
  if (item.x < 0 || item.y < 0) return false;
  if (def.zone === 'wall') {
    if (item.wall !== 'L' && item.wall !== 'R') return false;
    if (item.x + w > N || item.y + h > WALL_ROWS) return false;
    return !others.some(o => isWall(o) && o.wall === item.wall && overlaps(o, item));
  }
  if (item.x + w > N || item.y + h > N) return false;
  const support = supportOf(others, item);
  return !others.some(o => {
    if (isWall(o) || !overlaps(o, item)) return false;
    if (o === support) return false; // 책상 위에 올라감
    if (def.surface && BY_ID[o.id].zone === 'top' && inside(o, item)) return false; // 책상 위의 물건
    return true;
  });
}

// 바닥 쪽 가구 item을 others 사이에 놓을 수 있는 가장 가까운 자리. box(칸 네모)를 주면 그 안에서만 찾는다. 같은 방향으로 놓을 곳이 없을 때만 돌려 놓고,
// 그래도 없으면 null. 예전 저장본과 링크에서 지금 규칙으로는 그 자리에 둘 수 없게 된 가구를 옮길 때 쓴다(src/share.js의 sanitizeItems)
export function nearestSpot(others, item, box = null) {
  for (const r of item.r ? [1, 0] : [0, 1]) {
    let best = null;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const spot = { id: item.id, x, y, ...(r ? { r: 1 } : {}) };
        const d = (x - item.x) ** 2 + (y - item.y) ** 2;
        if ((!best || d < best.d) && (!box || insideBox(spot, box)) && canPlace(others, spot)) best = { d, spot };
      }
    }
    if (best) return best.spot;
  }
  return null;
}
