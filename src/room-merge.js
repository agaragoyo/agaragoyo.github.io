// 이 컴퓨터의 방과 서버의 방을 견줘 어느 쪽을 쓸지 정한다(F36). 같은 사용자의 방을 두 브라우저에서 고쳤을 때 쓴다(src/home-sync.js).
// 방 글자(서버에 두는 글자) 셋을 본다. base는 이 브라우저가 마지막으로 올리거나 받은 방, mine은 이 컴퓨터의 방, theirs는 서버의 방이다.
// 세 글자를 모두 decodeHome으로 풀어 지금 형식으로 다시 적은 뒤 견준다. 사이트가 바뀌면 같은 방도 글자가 달라지기 때문이다
// (책상 칸 줄이기, 펫 담기). 글자가 같은지만 보면 사이트를 고칠 때마다 고친 적 없는 방까지 바뀐 방이 된다.
// 이 파일은 화면 파일을 부르지 않는다. Node로 도는 링크 점검(tools/link-fuzz.mjs)이 이 파일을 불러 재기 때문이다(known-issues 110).
import { sanitizeRecords } from './records.js';
import { decodeHome, encodeHome } from './share.js';

// 방을 이루는 것: 주인 이름, 가구, 가구에 담은 것, 인사말, 벽지와 바닥, 사진. 게임 기록과 펫은 따로 본다.
// 가구를 놓은 차례는 방의 모습이 아니라서 차례만 다른 방은 같은 방으로 본다
const itemKey = it => [it.id, it.wall || '', it.x, it.y, it.r || 0].join(',');
function roomKey({ records, pet, ...room }) { // 빼낸 records와 pet은 쓰지 않는다
  const scenes = Object.fromEntries(Object.entries(room.scenes).map(([id, items]) => [id, [...items].sort((a, b) => (itemKey(a) < itemKey(b) ? -1 : 1))]));
  return encodeHome({ ...room, scenes });
}
const petKey = home => JSON.stringify(home.pet || null);
const recordKey = home => JSON.stringify(home.records || null);

// 두 방 글자가 방, 펫, 기록까지 모두 같은지. 풀 수 없는 글자는 다르다고 본다
export function sameCode(a, b) {
  if (a === b) return true;
  const x = decodeHome(a);
  const y = decodeHome(b);
  return !!x && !!y && roomKey(x) === roomKey(y) && petKey(x) === petKey(y) && recordKey(x) === recordKey(y);
}

// 게임마다 큰 쪽(겨루는 게임의 차례로). 하나도 없으면 null이다
function biggest(a, b) {
  const out = { ...a };
  for (const [id, v] of Object.entries(b || {})) out[id] = Math.max(out[id] || 0, v);
  return sanitizeRecords(out);
}

// 돌려주는 것
//   room     same 두 방이 같다, mine 이 컴퓨터만 바뀌었다, theirs 서버만 바뀌었다, ask 양쪽이 다르게 바뀌어 고르게 한다,
//            unreadable 서버의 글자를 풀 수 없다(이 컴퓨터의 방을 그대로 둔다)
//   pet      same 같다, mine 이 컴퓨터의 펫, theirs 서버의 펫, ask 고른 방의 펫(room이 ask일 때)
//   records  양쪽 가운데 큰 쪽만 모은 기록(없으면 null). 늘 큰 쪽이라 어느 방을 고르든 같다
//   mine, theirs  풀어 낸 두 방
// 펫은 "고르지 않음"(null)이 바뀐 것인지 잊은 것인지 알 수 없다. 펫을 담지 않는 예전 페이지가 올린 방도 null이라서, 한쪽만 null이면 다른 쪽을 쓴다.
export function mergeRooms({ base, mine, theirs }) {
  const t = decodeHome(theirs);
  if (!t) return { room: 'unreadable', pet: 'same', records: null, mine: null, theirs: null };
  const m = decodeHome(mine);
  if (!m) return { room: 'theirs', pet: t.pet ? 'theirs' : 'same', records: t.records || null, mine: null, theirs: t }; // 이 컴퓨터의 방이 깨졌다
  const b = decodeHome(base);
  const [M, T, B] = [roomKey(m), roomKey(t), b && roomKey(b)];
  const room = M === T ? 'same' : !b ? 'ask' : M === B ? 'theirs' : T === B ? 'mine' : 'ask';
  return { room, pet: petSide(room, m.pet, t.pet, b?.pet, !!b), records: biggest(m.records, t.records), mine: m, theirs: t };
}

// 펫의 어느 쪽을 쓸지. m, t, b는 이 컴퓨터, 서버, 바탕의 펫이다(없으면 undefined). known은 바탕을 아는지다
function petSide(room, m, t, b, known) {
  const [M, T, B] = [m, t, b].map(p => JSON.stringify(p || null));
  if (M === T) return 'same';
  if (!t) return 'mine';
  if (!m) return 'theirs';
  if (room === 'ask') return 'ask'; // 방을 고를 때 같이 고른다
  if (known && M === B) return 'theirs';
  if (known && T === B) return 'mine';
  if (m.id === t.id) return m.pats >= t.pats ? 'mine' : 'theirs'; // 같은 펫을 두 곳에서 쓰다듬었으면 많이 쓰다듬은 쪽이다
  return room === 'theirs' ? 'theirs' : 'mine';
}

// 결론. choice는 주인이 고른 쪽('mine', 'theirs')이고, 비우면 바뀐 쪽을 따른다(양쪽이 다르게 바뀐 방은 골라야 하므로 비우면 이 컴퓨터의 방이다).
//   room     'mine'이나 'theirs'. theirs면 이 컴퓨터의 방을 서버의 방으로 바꾼다
//   pet      이 컴퓨터에 쓸 펫({ id, pats }). 바꿀 것이 없으면 null이다. 주인이 골랐으면 고른 방의 펫이다
//   records  큰 쪽만 모은 기록
export function decide(merge, choice = null) {
  const room = choice || (merge.room === 'theirs' ? 'theirs' : 'mine');
  const side = choice || merge.pet;
  return { room, pet: side === 'theirs' ? merge.theirs.pet || null : null, records: merge.records };
}
