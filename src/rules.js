// 배치 규칙. 화면과 무관한 순수 함수만 둔다 (공유 링크 검사에도 같이 쓴다).
import { COLS, ROWS, WALL_ROWS } from './config.js';
import { BY_ID } from '../data/furniture.js';

export const sizeOf = item => BY_ID[item.id].size;

// 벽 가구끼리, 바닥 가구('top' 포함)끼리만 겹침을 검사한다.
// 바닥 가구가 벽 가구 앞을 가리는 것은 허용한다.
export const layerOf = item => (BY_ID[item.id].zone === 'wall' ? 'wall' : 'floor');

function overlaps(a, b) {
  const [aw, ah] = sizeOf(a);
  const [bw, bh] = sizeOf(b);
  return a.x < b.x + bw && b.x < a.x + aw && a.y < b.y + bh && b.y < a.y + ah;
}

// 'top' 가구가 올라앉은 surface 가구. 바닥에 있거나 'top'이 아니면 null.
export function supportOf(items, item) {
  if (BY_ID[item.id].zone !== 'top') return null;
  const [w, h] = sizeOf(item);
  return items.find(s => s !== item && BY_ID[s.id].surface &&
    item.y + h === s.y && item.x >= s.x && item.x + w <= s.x + sizeOf(s)[0]) || null;
}

// others: 이미 놓여 있는 가구들. item 을 그 사이에 놓을 수 있는지.
export function canPlace(others, item) {
  const def = BY_ID[item.id];
  const [w, h] = def.size;
  if (item.x < 0 || item.y < 0 || item.x + w > COLS || item.y + h > ROWS) return false;
  const bottom = item.y + h - 1;
  if (def.zone === 'wall' && bottom >= WALL_ROWS) return false;
  if (def.zone === 'floor' && bottom < WALL_ROWS) return false;
  if (def.zone === 'top' && bottom < WALL_ROWS && !supportOf(others, item)) return false;
  const layer = layerOf(item);
  return !others.some(o => layerOf(o) === layer && overlaps(o, item));
}
