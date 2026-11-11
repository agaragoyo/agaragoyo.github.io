// 집 상태 검사와 공유 링크(#r=..., 예전 #room=...) 변환. (localStorage 읽고 쓰기는 util.js에 있다)
// 집 상태: { v: 3, owner, scenes: { room: [가구...], playground: [가구...] }, likes: { 가구 id: 주인이 담아 둔 것 }, greeting: 화면 보호기 인사말 }
// likes의 칸과 검사는 src/likes.js에 있다.
import { SCENES } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { canPlace } from './rules.js';
import { sanitizeLikes, line } from './likes.js';

const MAX_ITEMS = 200;
const MAX_NAME = 12;
const MAX_GREETING = 30; // 화면 보호기 인사말(src/screensaver.js)

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
  return { v: 3, owner, scenes, likes: sanitizeLikes(raw.likes), greeting: line(raw.greeting, MAX_GREETING) };
}

// ---------- 공유 링크 ----------
// 링크는 주소 뒤에 #r=<글자>를 붙인 꼴이다(2026-11-11 전에 만든 링크는 #room=). 카카오톡은 메시지를 500자까지만 보여 주고 나머지를 접어서,
// 가구 이름을 글자로 적던 JSON(형식 3) 대신 가구 하나를 2바이트로 담는 짧은 형식(4)으로 만든다(known-issues 57).
// 예전 형식의 링크와 이웃집 목록(data/neighbors.js)도 그대로 열린다.

// 짧은 형식에서 가구를 가리키는 번호(배열 순서). 순서를 바꾸거나 중간에 끼우면 이미 보낸 링크의 가구가 다른 가구로 열리므로
// 새 가구는 끝에만 더한다. 여기 없는 가구도 링크에 담기지만 id 글자를 그대로 넣어 조금 길어진다(tools/check.py가 알린다).
export const LINK_CODES = [
  'desk', 'dining-table', 'bed', 'sofa', 'bookshelf', 'wardrobe', 'armchair', 'fridge', 'lamp', 'audio',
  'big-plant', 'computer', 'tv', 'console', 'camera', 'diary', 'desk-lamp', 'desk-lamp-2', 'mug', 'plant',
  'books', 'clock', 'radio', 'fishbowl', 'window', 'wide-window', 'beads-window', 'wide-beads-window', 'frame', 'poster',
  'wall-clock', 'sandbox', 'slide', 'swing', 'seesaw', 'bench', 'tree', 'streetlight',
];
const CODE = new Map(LINK_CODES.map((id, i) => [id, i]));
const ESCAPE = 127; // LINK_CODES에 없는 가구: 이 번호 뒤에 id의 바이트 수와 id 글자를 넣는다

// 주소의 #r=(예전 링크는 #room=) 뒤 글자. 없으면 null
export function linkCode(hash) {
  const m = String(hash || '').match(/^#(?:r|room)=(.+)$/);
  return m ? m[1] : null;
}

const utf8 = str => new TextEncoder().encode(str);
const fromUtf8 = bytes => new TextDecoder().decode(bytes);
const toB64 = bytes => {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

// 주인이 가구에 담아 둔 것(likes)은 JSON 그대로 담되, 칸 이름과 잘 아는 주소의 앞부분을 줄인다.
// 여기 없는 칸 이름과 주소는 그대로 두므로 담는 칸이 늘어도 링크는 열린다(그때 이 표에 더하면 더 짧아진다).
const KEY_SHORT = {
  computer: 'C', console: 'G', bookshelf: 'B', radio: 'R', tv: 'T',
  title: 't', author: 'a', note: 'n', color: 'c', url: 'u', name: 'm', year: 'y', by: 'b', link: 'l', poster: 'p', why: 'w',
};
const KEY_LONG = Object.fromEntries(Object.entries(KEY_SHORT).map(([k, v]) => [v, k]));
// ~w 뒤의 위키백과 문서 이름은 퍼센트 인코딩을 풀어 한글 그대로 담는다(한 글자가 9자에서 4자 남짓으로 준다)
const URL_SHORT = [
  ['~w', 'https://ko.wikipedia.org/wiki/'],
  ['~s', 'https://open.spotify.com/'],
  ['~a', 'https://music.apple.com/'],
  ['~y', 'https://www.youtube.com/watch?v='],
  ['~h', 'https://'],
];
const WIKI = 'https://ko.wikipedia.org/wiki/';
const wikiTitle = path => {
  try {
    const t = decodeURIComponent(path);
    return new URL(WIKI + t).href === WIKI + path ? t : path; // 되돌렸을 때 원래 주소와 똑같을 때만 푼다
  } catch {
    return path;
  }
};
function shrink(v) {
  if (Array.isArray(v)) return v.map(shrink);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [KEY_SHORT[k] ?? k, shrink(x)]));
  if (typeof v !== 'string') return v;
  if (v.startsWith('~')) return '~' + v; // 원래 ~로 시작하는 글은 ~를 하나 더 붙여 줄인 주소와 구별한다
  const hit = URL_SHORT.find(([, prefix]) => v.startsWith(prefix));
  if (!hit) return v;
  const rest = v.slice(hit[1].length);
  return hit[0] + (hit[0] === '~w' ? wikiTitle(rest) : rest);
}
function grow(v) {
  if (Array.isArray(v)) return v.map(grow);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [KEY_LONG[k] ?? k, grow(x)]));
  if (typeof v !== 'string' || !v.startsWith('~')) return v;
  if (v.startsWith('~~')) return v.slice(1);
  const hit = URL_SHORT.find(([tag]) => v.startsWith(tag));
  return hit ? hit[1] + v.slice(2) : v;
}

// 짧은 형식(4): [4] [주인 이름] [인사말] [공간 수], 공간(config.js의 SCENES 순서)마다 [가구 수]와 가구마다 2바이트, 끝에 likes JSON.
//   글: [바이트 수 1바이트][UTF-8]
//   가구: [LINK_CODES 번호(7비트) + 표시(0x80)] [x * 16 + y]. 표시는 바닥 가구면 돌려 놓았는지, 벽 가구면 오른쪽 벽인지다
// 담을 수 없는 집(좌표가 15를 넘거나 글이 255바이트를 넘음)이면 RangeError를 던지고, encodeHome이 예전 형식으로 만든다.
function encodeShort(home) {
  const out = [4];
  const text = str => {
    const b = utf8(str || '');
    if (b.length > 255) throw new RangeError('글이 길어 짧은 형식에 담을 수 없다');
    out.push(b.length, ...b);
  };
  text(home.owner);
  text(home.greeting);
  out.push(SCENES.length);
  for (const sc of SCENES) {
    const items = home.scenes[sc.id] || [];
    if (items.length > 255) throw new RangeError('가구가 많아 짧은 형식에 담을 수 없다');
    out.push(items.length);
    for (const it of items) {
      if (!(it.x >= 0 && it.x <= 15 && it.y >= 0 && it.y <= 15)) throw new RangeError('좌표가 커서 짧은 형식에 담을 수 없다');
      const mark = it.wall === 'R' || it.r === 1 ? 0x80 : 0;
      const code = CODE.get(it.id);
      if (code === undefined) {
        const id = utf8(it.id);
        out.push(ESCAPE | mark, id.length, ...id);
      } else {
        out.push(code | mark);
      }
      out.push(it.x * 16 + it.y);
    }
  }
  const likes = home.likes && Object.keys(home.likes).length ? JSON.stringify(shrink(home.likes)) : '';
  return toB64([...out, ...utf8(likes)]);
}

function decodeShort(b) {
  let p = 1;
  const byte = () => {
    if (p >= b.length) throw new RangeError('링크가 중간에 끊겼다');
    return b[p++];
  };
  const bytes = n => {
    if (p + n > b.length) throw new RangeError('링크가 중간에 끊겼다');
    const part = b.subarray(p, p + n);
    p += n;
    return part;
  };
  const text = () => fromUtf8(bytes(byte()));
  const owner = text();
  const greeting = text();
  const count = byte();
  const scenes = {};
  for (let s = 0; s < count; s++) {
    const items = [];
    for (let n = byte(); n > 0; n--) {
      const head = byte();
      const id = (head & 0x7f) === ESCAPE ? fromUtf8(bytes(byte())) : LINK_CODES[head & 0x7f];
      const xy = byte();
      const def = BY_ID[id];
      if (!def) continue; // 모르는 가구는 버린다(sanitizeHome도 버린다)
      const mark = (head & 0x80) !== 0;
      items.push(def.zone === 'wall'
        ? { id, x: xy >> 4, y: xy & 15, wall: mark ? 'R' : 'L' }
        : { id, x: xy >> 4, y: xy & 15, r: mark ? 1 : 0 });
    }
    if (SCENES[s]) scenes[SCENES[s].id] = items;
  }
  const rest = p < b.length ? fromUtf8(b.subarray(p)) : '';
  return { owner, greeting, scenes, likes: rest ? grow(JSON.parse(rest)) : undefined };
}

// 예전 형식(3): { v: 3, o: 이름, s: { 공간: [[id, x, y], [벽 가구 id, x, y, 'L'|'R'], [돌린 가구 id, x, y, 1], ...] }, l: likes, g: 인사말 }
const pack = items => items.map(it => (it.wall ? [it.id, it.x, it.y, it.wall] : it.r ? [it.id, it.x, it.y, 1] : [it.id, it.x, it.y]));
const unpack = list => (Array.isArray(list)
  ? list.filter(Array.isArray).map(([id, x, y, extra]) => (typeof extra === 'string' ? { id, x, y, wall: extra } : { id, x, y, r: extra === 1 ? 1 : 0 }))
  : []);
function encodeJson(home) {
  const s = {};
  for (const [id, items] of Object.entries(home.scenes)) if (items.length) s[id] = pack(items);
  const l = home.likes && Object.keys(home.likes).length ? home.likes : undefined;
  return toB64(utf8(JSON.stringify({ v: 3, o: home.owner, s, l, g: home.greeting || undefined })));
}

// 링크의 #r= 뒤에 붙일 글자. 짧은 형식으로 만들고, 담을 수 없으면 예전 형식으로 만든다.
export function encodeHome(home) {
  try {
    return encodeShort(home);
  } catch (err) {
    if (err instanceof RangeError) return encodeJson(home);
    throw err;
  }
}

// 링크 글자를 집 상태로. 첫 바이트가 4면 짧은 형식, '{'면 예전 JSON 형식이다. 풀 수 없거나 주인 이름이 없으면 null
export function decodeHome(str) {
  try {
    const b = fromB64(str);
    let raw = null;
    if (b[0] === 4) {
      raw = decodeShort(b);
    } else {
      const c = JSON.parse(fromUtf8(b));
      if (c?.v === 3 && c.s && typeof c.s === 'object') {
        const scenes = {};
        for (const [id, list] of Object.entries(c.s)) scenes[id] = unpack(list);
        raw = { owner: c.o, scenes, likes: c.l, greeting: c.g };
      } else if (c?.v === 2) {
        raw = { owner: c.o, items: unpack(c.i) }; // 공간이 하나뿐이던 때의 링크
      }
    }
    const home = sanitizeHome(raw);
    return home && home.owner ? home : null;
  } catch {
    return null;
  }
}
