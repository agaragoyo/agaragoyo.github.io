// 집 상태 검사와 공유 링크(#r=..., 예전 #room=...) 변환. (localStorage 읽고 쓰기는 util.js에 있다)
// 집 상태: { v: 3, owner, scenes: { room: [가구...] }, likes: { 가구 id: 주인이 담아 둔 것 }, greeting: 화면 보호기 인사말,
//           decor: { wall: 벽지 id, floor: 바닥 id }, picture: 주인 사진 값 }. decor는 기본이 아닌 벽지나 바닥을 골랐을 때만 있고, 고른 쪽만 담는다(F13).
// picture는 링크로 연 친구 집에만 있다(F25). 내 사진은 집과 따로 저장하고, 링크를 만들 때 withPicture(src/user-pictures.js)로 붙인다.
// picture는 목록 사진의 id이거나, 그림 파일로 만든 내 그림('my:'로 시작하는 글, src/custom-picture.js, F26)이다.
// records는 주인이 미니게임에서 낸 최고 기록 { 앱 id: 점수 }다(F34). picture처럼 링크로 연 친구 집에만 있고, 링크를 만들 때 withRecords(src/records.js)로 붙인다.
// likes의 칸과 검사는 src/likes.js에 있다.
import { SCENES } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { WALL_PATTERNS } from '../data/wall-patterns.js';
import { FLOOR_PATTERNS } from '../data/floor-patterns.js';
import { USER_PICTURES } from '../data/user-pictures.js';
import { customBytes, customFromBytes } from './custom-picture.js';
import { canPlace, nearestSpot, onSurface } from './rules.js';
import { sanitizeLikes, line } from './likes.js';
import { RECORD_APPS, sanitizeRecords } from './records.js';

const MAX_ITEMS = 200;
const MAX_NAME = 12;
const MAX_GREETING = 30; // 화면 보호기 인사말(src/screensaver.js)

// 'top'(책상 위 물건)이던 것을 'floor'(바닥 가구)로 바꾼 가구. 바꾸기 전의 저장본과 링크에서 책상이나 식탁 위에 있던 것은
// 받침 가구와 겹친 배치가 되어 둘 가운데 목록에서 뒤에 온 쪽이 버려지므로, 다른 가구를 다 놓은 뒤 가장 가까운 빈 바닥으로 내린다.
// TV는 2026-11-23에 받침까지 그린 그림으로 바꾸며 바닥 가구가 됐다
const WAS_TOP = new Set(['tv']);

// 한 공간의 가구 목록 검사. 모르는 가구, 다른 공간의 가구, 정수가 아닌 좌표, 규칙에 어긋나는 배치는 버린다.
function sanitizeItems(list, sceneId) {
  // 'top' 가구는 받쳐 줄 책상이 먼저 놓여 있어야 검사를 통과한다.
  const rank = it => (BY_ID[it.id].zone === 'top' ? 1 : 0);
  const all = (Array.isArray(list) ? list.slice(0, MAX_ITEMS) : [])
    .filter(it => it && BY_ID[it.id] && BY_ID[it.id].scene === sceneId && Number.isInteger(it.x) && Number.isInteger(it.y))
    .map(it => (BY_ID[it.id].zone === 'wall'
      ? { id: it.id, wall: it.wall, x: it.x, y: it.y }
      : { id: it.id, x: it.x, y: it.y, ...(it.r === 1 ? { r: 1 } : {}) }));
  const lifted = all.filter(it => WAS_TOP.has(it.id) && onSurface(all, it));
  const items = [];
  all.filter(it => !lifted.includes(it))
    .sort((a, b) => rank(a) - rank(b))
    .forEach(it => { if (canPlace(items, it)) items.push(it); });
  for (const it of lifted) {
    const spot = nearestSpot(items, it);
    if (spot) items.push(spot);
  }
  // 내린 가구도 바닥 가구 자리로 정렬해 두어, 다시 검사해도 같은 목록이 나온다
  return items.sort((a, b) => rank(a) - rank(b));
}

// 방 꾸밈. 벽지(wall)와 바닥(floor)이다. 기본(plain)이거나 목록에 없는 id는 빼고, 둘 다 빠지면 null이라 집 상태에 decor를 두지 않는다.
// decor가 없는 집은 벽지를 넣기 전과 저장본, 링크가 똑같다.
function sanitizeDecor(raw) {
  const pick = (list, id) => (id !== 'plain' && list.some(p => p.id === id) ? id : null);
  const wall = raw && typeof raw === 'object' ? pick(WALL_PATTERNS, raw.wall) : null;
  const floor = raw && typeof raw === 'object' ? pick(FLOOR_PATTERNS, raw.floor) : null;
  return wall || floor ? { ...(wall && { wall }), ...(floor && { floor }) } : null;
}

// 주인 이름(닉네임) 검사. 한 줄로 만들고 12글자까지 남긴다. 집 상태 검사와 이름 바꾸기 창(src/user-name.js)이 같이 쓴다.
// slice로 자르면 12번째 자리에 걸친 이모지가 반으로 잘려 깨진 글자가 남아서 글자 단위로 센다(src/likes.js의 line).
export const ownerName = value => line(value, MAX_NAME);

// 주인 사진. 목록(data/user-pictures.js)에 있는 id와 풀 수 있는 내 그림만 남기고, 아니면 null이라 집 상태에 picture를 두지 않는다.
// 내 그림은 푼 바이트로 글을 다시 적는다(같은 그림이 늘 같은 글이 된다).
const sanitizePicture = v => (USER_PICTURES.some(p => p.id === v) ? v : customFromBytes(customBytes(v)));

// 저장본이나 링크에서 온 집 상태는 손으로 고쳐졌을 수 있으므로 항상 이걸 거친다.
// 공간이 하나뿐이던 옛 형식({ owner, items })은 내 방으로 옮긴다.
export function sanitizeHome(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const owner = ownerName(raw.owner);
  const src = raw.scenes && typeof raw.scenes === 'object' ? raw.scenes : { room: raw.items };
  const scenes = {};
  for (const sc of SCENES) scenes[sc.id] = sanitizeItems(src[sc.id], sc.id);
  const decor = sanitizeDecor(raw.decor);
  const picture = sanitizePicture(raw.picture);
  const records = sanitizeRecords(raw.records);
  return {
    v: 3, owner, scenes, likes: sanitizeLikes(raw.likes), greeting: line(raw.greeting, MAX_GREETING),
    ...(decor && { decor }), ...(picture && { picture }), ...(records && { records }),
  };
}

// ---------- 공유 링크 ----------
// 긴 링크는 주소 뒤에 #r=<글자>를 붙인 꼴이다(2026-11-11 전에 만든 링크는 #room=). 짧은 링크(#s=번호)는 같은 글자를 서버에 둔다(src/cloud.js).
// 카카오톡은 메시지를 500자까지만 보여 주고 나머지를 접어서,
// 가구 이름을 글자로 적던 JSON(형식 3) 대신 가구 하나를 2바이트로 담는 짧은 형식(4)으로 만든다(known-issues 57).
// 예전 형식의 링크와 이웃집 목록(data/neighbors.js)도 그대로 열린다.

// 짧은 형식에서 가구를 가리키는 번호(배열 순서). 순서를 바꾸거나 중간에 끼우면 이미 보낸 링크의 가구가 다른 가구로 열리므로
// 새 가구는 끝에만 더한다. 여기 없는 가구도 링크에 담기지만 id 글자를 그대로 넣어 조금 길어진다(tools/check.py가 알린다).
// 'sandbox'부터 'streetlight'까지 일곱 개는 2026-11-17에 뺀 놀이터의 가구다. 자리를 지키려고 남겨 두었고, 예전 링크에 든 이 가구는 풀 때 버린다.
export const LINK_CODES = [
  'desk', 'dining-table', 'bed', 'sofa', 'bookshelf', 'wardrobe', 'armchair', 'fridge', 'lamp', 'audio',
  'big-plant', 'computer', 'tv', 'console', 'camera', 'diary', 'desk-lamp', 'desk-lamp-2', 'mug', 'plant',
  'books', 'clock', 'radio', 'fishbowl', 'window', 'wide-window', 'beads-window', 'wide-beads-window', 'frame', 'poster',
  'wall-clock', 'sandbox', 'slide', 'swing', 'seesaw', 'bench', 'tree', 'streetlight', 'corkboard', 'test-paper',
  'dining-chair',
];
const CODE = new Map(LINK_CODES.map((id, i) => [id, i]));
const ESCAPE = 127; // LINK_CODES에 없는 가구: 이 번호 뒤에 id의 바이트 수와 id 글자를 넣는다

// 주소의 #r=(예전 링크는 #room=) 뒤 글자. 없으면 null
export function linkCode(hash) {
  const m = String(hash || '').match(/^#(?:r|room)=(.+)$/);
  return m ? m[1] : null;
}

// 짧은 링크(#s=)의 방 번호. 방은 서버에 있다(src/cloud.js). 없으면 null
export function linkId(hash) {
  const m = String(hash || '').match(/^#s=([0-9A-Za-z]{8})$/);
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
// 짧은 이름은 모든 깊이의 칸 이름에 같이 쓰므로 겹치지 않게 고른다(시험지의 question, choices, answer는 q, o, k).
const KEY_SHORT = {
  computer: 'C', console: 'G', bookshelf: 'B', radio: 'R', tv: 'T', 'test-paper': 'Q',
  title: 't', author: 'a', note: 'n', color: 'c', url: 'u', name: 'm', year: 'y', by: 'b', link: 'l', poster: 'p', why: 'w',
  question: 'q', choices: 'o', answer: 'k',
};
const KEY_LONG = Object.fromEntries(Object.entries(KEY_SHORT).map(([k, v]) => [v, k]));
// ~w 뒤의 위키백과 문서 이름은 퍼센트 인코딩을 풀어 한글 그대로 담는다(한 글자가 9자에서 4자 남짓으로 준다)
// 새 표시를 더해도 옛 링크는 그대로 열린다. 원래 ~로 시작하는 글은 ~~로 담아 왔으므로 옛 링크에는 새 표시가 나올 수 없다.
// 앞의 것부터 맞춰 보므로 ~h(https:// 전부)는 늘 맨 끝에 둔다. ~p는 2026-11-14에 라디오의 유튜브 재생목록 CD 때문에 더했다.
const URL_SHORT = [
  ['~w', 'https://ko.wikipedia.org/wiki/'],
  ['~s', 'https://open.spotify.com/'],
  ['~a', 'https://music.apple.com/'],
  ['~y', 'https://www.youtube.com/watch?v='],
  ['~p', 'https://www.youtube.com/playlist?list='],
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
// 짧은 형식(5): 방을 꾸몄거나(decor) 주인 사진(picture)이 있는 집이다. 인사말 뒤에 [덧붙임 바이트 수]와 덧붙임 바이트가 붙고 나머지는 4와 같다.
//   덧붙임 바이트: [벽지 번호(data/wall-patterns.js의 순서, 0은 기본 벽)] [주인 사진 번호 + 1(data/user-pictures.js의 순서, 0은 사진 없음)]
//   사진 번호 + 1 자리가 255(MY_PICTURE)면 주인 사진은 내 그림이고, 뒤에 [내 그림 바이트 수] [내 그림 바이트(src/custom-picture.js)]가 온다.
//   내 그림은 200~300자가 늘어서, 긴 링크를 만들던 때에는 짧은 링크의 방에만 담았다(known-issues 57). 공유하기 창은 2026-11-14부터 짧은 링크만 만든다.
//   사진이 없으면 벽지 번호 하나만 담는다(벽지를 넣을 때 정한 모양). 바닥 같은 칸이 늘면 뒤에 더한다(내 그림이 있으면 그 바이트 뒤).
//   주인의 게임 기록(F34)은 사진 뒤(내 그림이 있으면 그 바이트 뒤)에 [기록 수] [기록마다 2바이트, 큰 자리 먼저]로 붙는다(recordBytes).
//   기록은 RECORD_APPS(src/records.js)의 순서이고 0은 그 게임의 기록이 없다는 뜻이다. 기록이 있으면 사진이 없어도 사진 자리에 0을 둔다.
//   바닥(F13)은 기록 뒤에 [바닥 번호(data/floor-patterns.js의 순서)] 한 바이트로 붙는다. 기본 바닥이면 담지 않고,
//   바닥을 담을 때는 사진 자리와 기록 수 자리를 비워 두지 않는다(사진이 없으면 0, 기록이 없으면 기록 수 0). 바닥을 넣기 전의 페이지는 기록 뒤를 건너뛰어 기본 바닥으로 연다.
//   푸는 쪽은 아는 바이트만 읽고 나머지는 건너뛴다. 그래서 사진을 넣기 전의 페이지도 사진이 든 링크를 사진 없이 열고,
//   내 그림을 넣기 전의 페이지는 255를 모르는 사진 번호로 읽어 사진 없이 연다. 덧붙임 바이트는 모두 255개까지라 내 그림은 240바이트까지다.
//   벽지도 사진도 없는 집은 벽지를 넣기 전과 같은 형식 4로 만든다(그 전의 페이지로 열어도 열린다).
// 담을 수 없는 집(좌표가 15를 넘거나 글이 255바이트를 넘음)이면 RangeError를 던지고, encodeHome이 예전 형식으로 만든다.
const MY_PICTURE = 255;

// 기록을 덧붙임 바이트로. 마지막 기록 뒤의 빈 칸은 담지 않고, 기록이 하나도 없으면 빈 배열이다
function recordBytes(records) {
  const clean = sanitizeRecords(records) || {};
  const values = RECORD_APPS.map(id => clean[id] || 0);
  while (values.length && !values[values.length - 1]) values.pop();
  return values.length ? [values.length, ...values.flatMap(v => [v >> 8, v & 255])] : [];
}
// 덧붙임 바이트의 at 자리부터 기록을 읽는다. 모르는 게임(RECORD_APPS보다 뒤)의 기록과 끊긴 바이트는 건너뛴다
function readRecords(d, at) {
  const out = {};
  for (let i = 0; at < d.length && i < d[at] && at + 2 + 2 * i < d.length; i++) {
    const v = d[at + 1 + 2 * i] * 256 + d[at + 2 + 2 * i];
    if (RECORD_APPS[i] && v) out[RECORD_APPS[i]] = v;
  }
  return out;
}

function encodeShort(home) {
  const wall = WALL_PATTERNS.findIndex(w => w.id === home.decor?.wall);
  const floor = FLOOR_PATTERNS.findIndex(f => f.id === home.decor?.floor);
  const pic = USER_PICTURES.findIndex(p => p.id === home.picture);
  const mine = customBytes(home.picture);
  const records = recordBytes(home.records);
  const extra = mine ? [Math.max(wall, 0), MY_PICTURE, mine.length, ...mine, ...records]
    : pic >= 0 || records.length || floor > 0 ? [Math.max(wall, 0), pic + 1, ...records] : wall > 0 ? [wall] : [];
  if (floor > 0) extra.push(...(records.length ? [] : [0]), floor);
  const out = [extra.length ? 5 : 4];
  const text = str => {
    const b = utf8(str || '');
    if (b.length > 255) throw new RangeError('글이 길어 짧은 형식에 담을 수 없다');
    out.push(b.length, ...b);
  };
  text(home.owner);
  text(home.greeting);
  if (extra.length > 255) throw new RangeError('덧붙임 바이트가 255개를 넘어 짧은 형식에 담을 수 없다'); // 겨룰 게임이 늘어 기록이 길어질 때
  if (extra.length) out.push(extra.length, ...extra);
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
  const decor = {};
  let picture, records;
  if (b[0] === 5) {
    const d = bytes(byte());
    if (d.length) decor.wall = WALL_PATTERNS[d[0]]?.id; // 모르는 번호면 기본 벽(sanitizeHome이 지운다)
    let at = 2; // 사진 뒤. 게임 기록(F34)이 여기서 시작한다
    if (d.length > 1 && d[1] === MY_PICTURE) {
      picture = customFromBytes(d.length > 2 && d.length >= 3 + d[2] ? d.slice(3, 3 + d[2]) : null);
      at = d.length > 2 ? 3 + d[2] : d.length;
    } else if (d.length > 1) {
      picture = USER_PICTURES[d[1] - 1]?.id; // 0이나 모르는 번호면 사진 없음
    }
    records = readRecords(d, at);
    const end = at < d.length ? at + 1 + 2 * d[at] : d.length; // 기록 뒤. 바닥 번호가 여기 있다
    if (end < d.length) decor.floor = FLOOR_PATTERNS[d[end]]?.id; // 모르는 번호면 기본 바닥(sanitizeHome이 지운다)
  }
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
  return { owner, greeting, scenes, likes: rest ? grow(JSON.parse(rest)) : undefined, decor, picture, records };
}

// 예전 형식(3): { v: 3, o: 이름, s: { 공간: [[id, x, y], [벽 가구 id, x, y, 'L'|'R'], [돌린 가구 id, x, y, 1], ...] }, l: likes, g: 인사말, d: decor, p: 주인 사진 값, b: 게임 기록 }
const pack = items => items.map(it => (it.wall ? [it.id, it.x, it.y, it.wall] : it.r ? [it.id, it.x, it.y, 1] : [it.id, it.x, it.y]));
const unpack = list => (Array.isArray(list)
  ? list.filter(Array.isArray).map(([id, x, y, extra]) => (typeof extra === 'string' ? { id, x, y, wall: extra } : { id, x, y, r: extra === 1 ? 1 : 0 }))
  : []);
function encodeJson(home) {
  const s = {};
  for (const [id, items] of Object.entries(home.scenes)) if (items.length) s[id] = pack(items);
  const l = home.likes && Object.keys(home.likes).length ? home.likes : undefined;
  return toB64(utf8(JSON.stringify({ v: 3, o: home.owner, s, l, g: home.greeting || undefined, d: home.decor, p: home.picture, b: sanitizeRecords(home.records) || undefined })));
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

// 링크 글자를 집 상태로. 첫 바이트가 4나 5면 짧은 형식, '{'면 예전 JSON 형식이다. 풀 수 없거나 주인 이름이 없으면 null
export function decodeHome(str) {
  try {
    const b = fromB64(str);
    let raw = null;
    if (b[0] === 4 || b[0] === 5) {
      raw = decodeShort(b);
    } else {
      const c = JSON.parse(fromUtf8(b));
      if (c?.v === 3 && c.s && typeof c.s === 'object') {
        const scenes = {};
        for (const [id, list] of Object.entries(c.s)) scenes[id] = unpack(list);
        raw = { owner: c.o, scenes, likes: c.l, greeting: c.g, decor: c.d, picture: c.p, records: c.b };
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
