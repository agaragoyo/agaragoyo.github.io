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

// a의 바닥 면이 s의 바닥 면 안에 완전히 들어가는지
function inside(a, s) {
  const [aw, ad] = dims(a);
  const [sw, sd] = dims(s);
  return a.x >= s.x && a.y >= s.y && a.x + aw <= s.x + sw && a.y + ad <= s.y + sd;
}

// 'top' 가구가 올라앉은 surface 가구. 바닥에 있거나 'top'이 아니면 null.
export function supportOf(items, item) {
  if (BY_ID[item.id].zone !== 'top') return null;
  return items.find(s => s !== item && !isWall(s) && BY_ID[s.id].surface && inside(item, s)) || null;
}

export function elevOf(items, item) {
  const s = supportOf(items, item);
  return s ? BY_ID[s.id].height : 0;
}

// 벽 가구 item이 그 공간의 현관문(config.js의 SCENES door) 자리를 가리는지. scene: SCENES 한 줄.
// 방 꾸미기에서 새로 걸 때만 막고(room.js의 beginDrag), 저장본이나 링크를 불러올 때는 막지 않는다.
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
