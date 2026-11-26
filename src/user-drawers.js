// 한 브라우저에 사용자를 MAX_USERS명까지 두는 서랍(F37). 로그인 화면(src/login.js, src/sign-in.js)이 쓰고, 부팅할 때 src/os.js가 resumeSwap을 부른다.
// 앉은 사용자 한 명은 지금 키(src/home-store.js의 userKeys와 설정의 펫)를 그대로 쓰고, 앉지 않은 사용자는 그 키를 통째로 STORAGE_USERS 한 값의 서랍 한 칸에 넣어 둔다.
// 윈도우 XP의 사용자 계정과 크롬 프로필처럼 사용자의 것이 이 컴퓨터에 사용자마다 따로 있어서, 이름을 누르면 비밀번호도 인터넷도 없이 바로 들어간다.
// 저장 꼴: { list: [{ id, keys: { 키: 저장소의 글자 그대로 }, pet: { id, pats } }], to }. list는 최근에 쓴 사용자부터다.
//   id   사용자마다 한 번 정하는 서랍 번호. 앉으면 STORAGE_DRAWER에 두어 서랍과 앉은 자리를 오가도 같은 번호다(지우다 멈춘 사용자를 다시 고를 수 있게)
//   to   바꿔 끼우는 중이라는 표시. 들어올 서랍의 id이거나, 새 사용자를 들이려고 비우는 중이면 NEW다. 다 하면 지운다
// 바꿔 끼우기는 한 동기 작업 안에서 한다. 사용자를 바꾸는 일이라 다른 탭이 앞 사용자의 것을 저장하지 않게 가장 먼저 reseat를 부른다(known-issues 128).
//   1. 떠나는 사용자의 키를 서랍 맨 앞에 넣고 표시(to)를 같은 값에 같이 쓴다. 저장소가 꽉 차 쓰지 못하면 아무것도 바꾸지 않고 false를 돌려준다
//   2. 지금 키를 지우고(wipeUser) 들어올 사용자의 서랍을 키로 푼다
//   3. 들어온 사용자의 서랍과 표시를 지운다
// 1과 3 사이에 꺼지면 다음에 켤 때 resumeSwap이 2와 3을 다시 한다. 떠난 사용자는 1에서 이미 서랍에 있다.
// 서랍과 표시를 한 값에 같이 쓰는 까닭은 둘을 따로 쓰다 그 사이에 꺼지면 같은 사용자가 앉은 자리와 서랍에 둘 다 남기 때문이다.
// 메모리에 든 것(로그인과 예약한 올리기, 서버의 방과 맞추던 일, 튜토리얼 진행)은 부르는 쪽이 버린다(src/login.js의 reseated).
import { STORAGE_USERS, STORAGE_DRAWER, STORAGE_ROOM, STORAGE_ROOM_OLD, STORAGE_SETTINGS, STORAGE_CLOUD, STORAGE_PICTURE, MAX_USERS } from './config.js';
import { sanitizeHome } from './share.js';
import { HANDLE_RE } from './cloud.js';
import { reseat } from './seat.js';
import { userKeys, isUserKey, wipeUser, usePet } from './home-store.js';
import { pictureOf } from './user-pictures.js';
import { loadJSON } from './util.js';

const NEW = 'new'; // to: 새 사용자를 들이려고 비우는 중. 서랍 id는 16진수 8글자라 겹치지 않는다

const parse = text => {
  try { return JSON.parse(text); } catch { return null; }
};
const stored = key => {
  try { return localStorage.getItem(key); } catch { return null; }
};
// 키 묶음 속 집. 이름이 없거나 깨졌으면 null이다(src/login.js의 ownHome과 같은 검사)
const homeOf = keys => {
  const home = sanitizeHome(parse(keys[STORAGE_ROOM]) || parse(keys[STORAGE_ROOM_OLD]));
  return home?.owner ? home : null;
};
const seatedHome = () => homeOf({ [STORAGE_ROOM]: stored(STORAGE_ROOM), [STORAGE_ROOM_OLD]: stored(STORAGE_ROOM_OLD) });
const ID_RE = /^[0-9a-f]{8}$/;
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('');

// 저장된 서랍. 손으로 고쳐졌을 수 있어서 집이 없는 칸은 뺀다
function read() {
  const got = loadJSON(STORAGE_USERS);
  const list = (Array.isArray(got?.list) ? got.list : [])
    .filter(d => ID_RE.test(d?.id) && d.keys && typeof d.keys === 'object' && homeOf(d.keys));
  return { list, to: typeof got?.to === 'string' ? got.to : null };
}

// 서랍을 쓴다. 저장소가 꽉 차 쓰지 못하면 false다(util.js의 saveJSON은 실패를 삼키므로 따로 쓴다). 빈 서랍은 키를 지운다
function write({ list, to = null }) {
  try {
    if (list.length || to) localStorage.setItem(STORAGE_USERS, JSON.stringify(to ? { list, to } : { list }));
    else localStorage.removeItem(STORAGE_USERS);
    return true;
  } catch {
    return false;
  }
}

// 앉은 사용자의 서랍 한 칸. 앉은 사용자(이름이 있는 집)가 없으면 null이다
function packSeat() {
  const keys = {};
  for (const key of userKeys()) {
    const v = stored(key);
    if (v !== null) keys[key] = v;
  }
  if (!homeOf(keys)) return null;
  const saved = loadJSON(STORAGE_SETTINGS) || {};
  const id = parse(keys[STORAGE_DRAWER]);
  return { id: ID_RE.test(id) ? id : newId(), keys, pet: { id: typeof saved.pet === 'string' ? saved.pet : '', pats: Number(saved.petPats) || 0 } };
}

// 서랍 한 칸을 앉은 사용자의 키로 푼다. 저장소가 꽉 차 쓰지 못하면 오류를 던진다
function unpack(d) {
  for (const [key, v] of Object.entries(d.keys)) if (isUserKey(key) && typeof v === 'string') localStorage.setItem(key, v);
  localStorage.setItem(STORAGE_DRAWER, JSON.stringify(d.id));
  usePet(d.pet);
}

// 서랍의 사용자(id)를 앉힌다. 앉아 있던 사용자는 서랍 맨 앞에 넣는다. 앉은 사용자가 없었으면 남은 키(손님으로 놀러 간 기록 등)는 지운다.
// 돌려주는 것: 앉힌 사용자의 집, 그 서랍이 없으면 null(다른 탭에서 지웠다), 저장소가 꽉 차서 바꾸지 못했으면 false
export function swapTo(id) {
  const { list } = read();
  const next = list.find(d => d.id === id);
  if (!next) return null;
  reseat();
  const out = packSeat();
  const kept = out ? [out, ...list] : list;
  if (!write({ list: kept, to: id })) return false;
  wipeUser();
  try {
    unpack(next);
  } catch {
    // 들어올 사용자를 다 풀지 못했다. 떠나려던 사용자를 다시 앉히고 서랍을 처음대로 둔다. 1에서 이만큼을 쓸 수 있었으므로 들어간다
    wipeUser();
    try {
      if (out) unpack(out);
      write({ list });
    } catch { /* 표시가 남아 다음에 켤 때 resumeSwap이 다시 한다 */ }
    return false;
  }
  write({ list: kept.filter(d => d !== next) });
  return homeOf(next.keys);
}

// 새 사용자를 들이려고 앉은 사용자를 서랍 맨 앞에 넣고 지금 키를 비운다(새 사용자 만들기, 다른 아이디로 로그인). 펫은 기본으로 돌린다.
// 새 사용자의 것을 다 쓴 뒤에 seatDone을 부른다. 그 전에 꺼지면 다음에 켤 때 resumeSwap이 떠난 사용자를 다시 앉힌다.
// 돌려주는 것: true(비웠다. 앉은 사용자가 없었으면 아무것도 하지 않는다), 'full'(사용자가 이미 MAX_USERS명), false(저장소가 꽉 참)
export function clearSeat() {
  if (!seatedHome()) return true;
  const { list } = read();
  if (list.length + 1 >= MAX_USERS) return 'full';
  reseat();
  const out = packSeat();
  if (!out || !write({ list: [out, ...list], to: NEW })) return false;
  wipeUser();
  usePet(null);
  return true;
}

// 새 사용자의 것을 다 썼다. 바꾸는 중이라는 표시를 지운다
export function seatDone() {
  const now = read();
  if (now.to === NEW) write({ list: now.list });
}

// 앉은 사용자를 지운 뒤(이 컴퓨터에서 지우기, 초기화, 사용자 지우기) 가장 최근에 쓴 다른 사용자를 앉힌다.
// 그 사용자의 집이나, 다른 사용자가 없거나 앉히지 못했으면 null이다
export function promoteNext() {
  const [next] = read().list;
  return (next && swapTo(next.id)) || null;
}

// 서랍 한 칸을 지운다(서버에 할 일이 없는 사용자 지우기). 지웠으면 true다
export function dropDrawer(id) {
  const now = read();
  if (!now.list.some(d => d.id === id)) return false;
  return write({ ...now, list: now.list.filter(d => d.id !== id) });
}

// 부팅할 때 부른다. 바꿔 끼우다 꺼졌으면 마저 하고, 새 사용자를 들이다 꺼졌으면 떠난 사용자를 다시 앉힌다(반쯤 만든 새 사용자는 지운다)
export function resumeSwap() {
  const { list, to } = read();
  if (!to) return;
  const next = to === NEW ? list[0] : list.find(d => d.id === to);
  if (!next) { // 표시만 남았다(서랍을 손으로 고쳤다). 앉은 사용자는 그대로 둔다
    write({ list });
    return;
  }
  reseat();
  wipeUser();
  try {
    unpack(next);
  } catch {
    return; // 표시를 두고 다음에 다시 한다
  }
  write({ list: list.filter(d => d !== next) });
}

// 서랍에 든 사용자들. 최근에 쓴 사용자부터 { id, home: 집, name, picture, handle: 아이디, uid: 계정 번호, room: 올린 방 번호, pw: 비밀번호가 있는지 }
export function drawers() {
  return read().list.map(d => {
    const home = homeOf(d.keys);
    const cloud = parse(d.keys[STORAGE_CLOUD]) || {};
    const room = typeof cloud.id === 'string' && cloud.id ? cloud.id : null;
    return {
      id: d.id,
      home,
      name: home.owner,
      picture: pictureOf(parse(d.keys[STORAGE_PICTURE]), home.owner),
      handle: room && typeof cloud.handle === 'string' && HANDLE_RE.test(cloud.handle) ? cloud.handle : null,
      uid: typeof cloud.uid === 'string' && cloud.uid ? cloud.uid : null,
      room,
      pw: cloud.pw === true,
    };
  });
}

// 서랍에 든 사용자들이 올린 방 번호. 로그인 화면의 이웃집과 최근에 놀러 간 집에서 이 방들을 빼서 다른 사용자 칸과 두 번 뜨지 않게 한다(known-issues 84)
export const drawerRooms = () => drawers().map(d => d.room).filter(Boolean);

// 이 컴퓨터의 사용자 수(앉은 사용자와 서랍의 사용자)
export const userCount = () => read().list.length + (seatedHome() ? 1 : 0);
