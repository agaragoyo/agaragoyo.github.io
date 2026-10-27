// 저장(localStorage)과 공유 링크(#room=...) 변환.
// 집 상태: { v: 3, owner, scenes: { room: [가구...], playground: [가구...] } }
import { SCENES } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { canPlace } from './rules.js';

const MAX_ITEMS = 200;
const MAX_NAME = 12;

export function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

export function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 사생활 보호 모드 등 */ }
}

// 한 공간의 가구 목록 검사. 모르는 가구, 다른 공간의 가구, 정수가 아닌 좌표, 규칙에 어긋나는 배치는 버린다.
function sanitizeItems(list, sceneId) {
  // 'top' 가구는 받쳐 줄 책상이 먼저 놓여 있어야 검사를 통과한다.
  const rank = it => (BY_ID[it.id].zone === 'top' ? 1 : 0);
  const items = [];
  (Array.isArray(list) ? list.slice(0, MAX_ITEMS) : [])
    .filter(it => it && BY_ID[it.id] && BY_ID[it.id].scene === sceneId && Number.isInteger(it.x) && Number.isInteger(it.y))
    .map(it => (BY_ID[it.id].zone === 'wall'
      ? { id: it.id, wall: it.wall, x: it.x, y: it.y }
      : { id: it.id, x: it.x, y: it.y, ...(it.r === 1 ? { r: 1 } : {}) }))
    .sort((a, b) => rank(a) - rank(b))
    .forEach(it => { if (canPlace(items, it)) items.push(it); });
  return items;
}

// 저장본이나 링크에서 온 집 상태는 손으로 고쳐졌을 수 있으므로 항상 이걸 거친다.
// 공간이 하나뿐이던 옛 형식({ owner, items })은 내 방으로 옮긴다.
export function sanitizeHome(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const owner = typeof raw.owner === 'string' ? raw.owner.trim().slice(0, MAX_NAME) : '';
  const src = raw.scenes && typeof raw.scenes === 'object' ? raw.scenes : { room: raw.items };
  const scenes = {};
  for (const sc of SCENES) scenes[sc.id] = sanitizeItems(src[sc.id], sc.id);
  return { v: 3, owner, scenes };
}

const toB64 = str => {
  let bin = '';
  new TextEncoder().encode(str).forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64 = str => {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
};

// 네 번째 칸: 벽 가구는 'L'|'R', 돌려 놓은 바닥 가구는 1
const pack = items => items.map(it => (it.wall ? [it.id, it.x, it.y, it.wall] : it.r ? [it.id, it.x, it.y, 1] : [it.id, it.x, it.y]));
const unpack = list => (Array.isArray(list)
  ? list.filter(Array.isArray).map(([id, x, y, extra]) => (typeof extra === 'string' ? { id, x, y, wall: extra } : { id, x, y, r: extra === 1 ? 1 : 0 }))
  : []);

// 링크에는 짧은 형태로 담는다: { v: 3, o: 이름, s: { 공간: [[id, x, y], [벽 가구 id, x, y, 'L'|'R'], ...] } }
export function encodeHome(home) {
  const s = {};
  for (const [id, items] of Object.entries(home.scenes)) if (items.length) s[id] = pack(items);
  return toB64(JSON.stringify({ v: 3, o: home.owner, s }));
}

export function decodeHome(str) {
  try {
    const c = JSON.parse(fromB64(str));
    let raw = null;
    if (c?.v === 3 && c.s && typeof c.s === 'object') {
      const scenes = {};
      for (const [id, list] of Object.entries(c.s)) scenes[id] = unpack(list);
      raw = { owner: c.o, scenes };
    } else if (c?.v === 2) {
      raw = { owner: c.o, items: unpack(c.i) }; // 공간이 하나뿐이던 때의 링크
    }
    const home = sanitizeHome(raw);
    return home && home.owner ? home : null;
  } catch {
    return null;
  }
}
