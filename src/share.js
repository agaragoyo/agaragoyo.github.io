// 저장(localStorage)과 공유 링크(#room=...) 변환.
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

// 저장본이나 링크에서 온 방 상태는 손으로 고쳐졌을 수 있으므로 항상 이걸 거친다.
// 모르는 가구, 정수가 아닌 좌표, 규칙에 어긋나는 배치는 버린다.
export function sanitizeRoom(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const owner = typeof raw.owner === 'string' ? raw.owner.trim().slice(0, MAX_NAME) : '';
  const list = Array.isArray(raw.items) ? raw.items.slice(0, MAX_ITEMS) : [];
  // 'top' 가구는 받쳐 줄 책상이 먼저 놓여 있어야 검사를 통과한다.
  const rank = it => (BY_ID[it.id].zone === 'top' ? 1 : 0);
  const items = [];
  list
    .filter(it => it && BY_ID[it.id] && Number.isInteger(it.x) && Number.isInteger(it.y))
    .map(it => ({ id: it.id, x: it.x, y: it.y }))
    .sort((a, b) => rank(a) - rank(b))
    .forEach(it => { if (canPlace(items, it)) items.push(it); });
  return { v: 1, owner, items };
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

// 링크에는 짧은 형태로 담는다: { v, o: 이름, i: [[id, x, y], ...] }
export function encodeRoom(room) {
  const compact = { v: 1, o: room.owner, i: room.items.map(it => [it.id, it.x, it.y]) };
  return toB64(JSON.stringify(compact));
}

export function decodeRoom(str) {
  try {
    const c = JSON.parse(fromB64(str));
    if (!c || c.v !== 1 || !Array.isArray(c.i)) return null;
    const items = c.i.filter(Array.isArray).map(([id, x, y]) => ({ id, x, y }));
    const room = sanitizeRoom({ owner: c.o, items });
    return room && room.owner ? room : null;
  } catch {
    return null;
  }
}
