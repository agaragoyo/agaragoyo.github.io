// 이웃집(docs/requirements.md의 F19). data/neighbors.js의 목록을 로그인 화면과 놀이터 울타리에 내놓는다.
// 로그인 화면에서는 사용자처럼 늘어서 누르면 바로 손님으로 들어가고(누르기 전에 이름과 "이웃집 구경하기"가 보인다),
// 놀이터에서는 왼쪽 울타리의 '이웃집' 문 하나를 두 번 누르면 이웃집 목록 창(openNeighbors)이 뜨고, 그 창에서 갈 집을 고른다.
// 내 컴퓨터를 떠나 다른 컴퓨터로 가는 일이라 누르기 전에 어느 집인지 보인다(동물의 숲 꿈 방문은 섬 이름을, Gather는 다른 공간으로 가는 문에서 확인을 받는다).
// 예전에는 이웃마다 문패를 단 문을 하나씩 달았는데, 세 집만으로 울타리 12칸 가운데 8칸이 문이 되어 2026-11-16 문 하나와 목록 창으로 바꿨다(known-issues 90).
// 한 줄은 두 가지다. link(주인이 공유하기에서 만든 링크의 번호)는 방을 서버(src/cloud.js)에서 받아 와서 주인이 방을 고치면 따라 바뀌고,
// room(예전 긴 링크의 글자)은 링크를 보낸 때의 모습에 멈춰 있다. link의 방은 페이지를 연 뒤 한 번만 받고, 로그인 화면과 놀이터가 그 값을 같이 쓴다.
// 이름도 같다. link 이웃집은 받은 방의 주인 이름을 써서 주인이 이름 바꾸기(F28)로 닉네임을 바꾸면 따라 바뀌고, 받기 전과 room 이웃집은 목록의 이름을 쓴다.
// 고정한 이웃집(link 줄에 복사본 keep이 있는 줄)은 서버에 방이 없거나 서버에 닿지 못하거나 받은 방이 깨졌을 때 복사본으로 대신 열어서 사라지지 않는다.
// 그런 방을 올린 브라우저에서는 서버의 방을 지우는 길(이 컴퓨터 초기화, 공유하기의 링크 지우기)을 막는다(pinnedHere).
import { NEIGHBORS } from '../data/neighbors.js';
import { decodeHome, linkId } from './share.js';
import { fetchHome, sharedId } from './cloud.js';
import { line } from './likes.js';
import { pictureEl } from './user-pictures.js';
import { h, fitText } from './util.js';
import { play } from './sound.js';

// 로그인 화면에 이웃집이 이만큼까지 들어간다(style.css의 .user.neighbor). 놀이터의 목록 창도 같은 집을 보이도록 목록 자체를 여기서 자른다.
// 목록 창은 스크롤되어 더 많이 담을 수 있지만, 두 곳의 이웃이 다르면 어느 쪽이 맞는지 헷갈린다. 팀이 여섯 명이라 지금은 넘지 않는다
export const MAX_NEIGHBORS = 6;

// 링크 번호 8글자. 모양이 틀리면 빈 글자다(짧은 링크 #s=와 같은 규칙, src/share.js의 linkId)
const asLink = v => (typeof v === 'string' && linkId(`#s=${v}`)) || '';

// 고정한 집의 복사본. link 줄에서만 쓰고, 풀리지 않는 글자는 없는 것으로 친다(tools/check.py가 오류로 알린다)
const asKeep = n => (asLink(n.link) && typeof n.keep === 'string' && decodeHome(n.keep) ? n.keep : '');

// 이름이 없거나 link도 room도 쓸 수 없는 줄은 뺀다. 둘 다 있으면 link를 쓴다(tools/check.py가 오류로 알린다). 순서는 목록 그대로다.
export const NEIGHBOR_LIST = NEIGHBORS
  .map(n => ({ id: String(n.id), name: line(n.name, 12), link: asLink(n.link), room: String(n.room || ''), keep: asKeep(n) }))
  .filter(n => n.name && (n.link || decodeHome(n.room)))
  .slice(0, MAX_NEIGHBORS);

// link 이웃집의 방 글자를 서버에서 받는다. 번호마다 한 번만 받는다.
// 받은 값: 글자, null(서버에 그런 방이 없음), undefined(서버에 닿지 못함. 다음에 다시 받도록 기억하지 않는다)
// 복사본(keep)이 있는 집은 서버에 방이 없거나 받은 글자가 풀리지 않을 때 복사본의 글자가 되고, 서버에 닿지 못할 때도 이번에는 복사본을 쓴다(다음에는 서버에 다시 묻는다).
// 그래서 고정한 집은 null이나 undefined가 되지 않는다.
const asked = new Map(); // 번호 → 받는 중이거나 받은 일(Promise)
const known = new Map(); // 번호 → 받은 글자나 null
const live = new Set();  // 서버에서 받은 방이 풀린 번호. 복사본으로 대신 연 집은 들지 않는다(neighborBoard)
function codeOf(n) {
  if (!n.link) return Promise.resolve(n.room);
  if (!asked.has(n.link)) {
    asked.set(n.link, fetchHome(n.link).then(code => {
      const ok = !!code && !!decodeHome(code);
      if (ok) live.add(n.link);
      const got = n.keep && !ok ? n.keep : code;
      known.set(n.link, got);
      return got;
    }, err => {
      console.warn('이웃집의 방을 받지 못했다', n.id, err);
      asked.delete(n.link);
      return n.keep || undefined;
    }));
  }
  return asked.get(n.link);
}

// 이 브라우저가 올린 방이 고정한 이웃집이면 그 이웃집의 줄, 아니면 null. 그 방을 서버에서 지우는 길(로그인 화면의 이 컴퓨터 초기화, 공유하기의 링크 지우기)은
// 서버의 방을 지우기 전에 이것을 보고 막는다. 지우면 그 이웃집이 복사본(넣은 때의 모습)으로 멈추고 주인의 방도 사라진다. tools/check.py가 unshare()를 부르는 파일에 이 이름이 있는지 본다.
export function pinnedHere() {
  const id = sharedId();
  return (id && NEIGHBOR_LIST.find(n => n.keep && n.link === id)) || null;
}

// 그 집을 열 때마다 글자를 새로 푼다(구경하는 동안 바뀐 것이 목록에 남지 않게).
// link 이웃집은 서버의 방 주인 이름을 그대로 쓴다. room 이웃집은 목록의 이름이다(tools/check.py가 링크 속 이름과 같은지 본다). 이름이 빈 방도 목록의 이름을 쓴다.
function toHome(n, code) {
  const home = code ? decodeHome(code) : null;
  return home && { ...home, owner: (n.link && home.owner) || n.name };
}

// 그 집의 지금 모습(Promise). 집, null(링크가 깨졌거나 서버에 그런 방이 없음), undefined(서버에 닿지 못함)
export async function neighborHome(n) {
  const code = await codeOf(n);
  return code === undefined ? undefined : toHome(n, code);
}

// 기다리지 않고 지금 아는 모습. room 줄은 바로 풀고, link 줄은 받은 뒤에만 집이나 null이고 아직 모르면 undefined다.
// 서버에 닿지 못해 복사본(keep)으로 연 고정한 집도 undefined다(다음에 서버에 다시 묻도록 기억하지 않는다). 그 집으로 들어가는 곳은 neighborHome이 준 집으로 대신한다.
export function neighborNow(n) {
  if (!n.link) return toHome(n, n.room);
  return known.has(n.link) ? toHome(n, known.get(n.link)) : undefined;
}

// 이웃집 손님이 코르크 보드에 쪽지를 붙일 서버의 방 번호(src/os.js의 boardId). 서버에서 받은 link 이웃집이면 그 번호라서
// 짧은 링크로 온 손님처럼 쪽지를 남긴다. room 이웃집과 복사본(keep)으로 대신 연 집은 null이다. 서버 규칙이 서버에 있는 방에만 쪽지를 받는다(firestore.rules).
export const neighborBoard = n => (n.link && live.has(n.link) ? n.link : null);

// 지금 보일 이름. 받은 link 이웃집은 서버의 방 주인 이름이고, 받기 전이거나 room 이웃집이면 목록의 이름이다
const shownName = n => neighborNow(n)?.owner || n.name;

// 부팅할 때 link 이웃집의 방을 미리 받는다. 받은 집마다 got(집)을 부른다(가구 그림 미리 받기, src/os.js)
export function prefetchNeighbors(got) {
  for (const n of NEIGHBOR_LIST) if (n.link) neighborHome(n).then(home => home && got(home));
}

// 놀이터의 이웃집 목록 창에 보일 집. owner: 그 놀이터가 있는 집의 주인 이름.
// 그 집은 뺀다. 그 놀이터의 아파트 문이 이미 그 집으로 가는 문이라, 같은 곳으로 가는 길이 둘이 되어 어색했다.
// 견주는 이름은 지금 보일 이름(shownName)이라, 이웃집 주인이 이름을 바꿔도 자기 놀이터에 자기 집이 나오지 않는다(known-issues 78).
// 서버에 방이 없다고 확인된 link 이웃집도 뺀다. 받는 중이거나 받지 못한 집은 넣어 두고, 목록 창을 열 때 다시 받는다.
export const shownNeighbors = (owner = '') => NEIGHBOR_LIST.filter(n => neighborNow(n) !== null && shownName(n) !== owner);

// 놀이터 왼쪽 울타리의 이웃집 문({ wall: 'L', x, w }). scene: config.js의 SCENES 한 줄(문 자리는 그 줄의 neighborGate).
// 이웃이 몇 집이든 문은 하나다. 보여 줄 이웃이 하나도 없으면(그 놀이터 주인의 집뿐이거나 서버에 방이 없는 집뿐이면) null이고 문을 달지 않는다.
export function neighborGate(scene, owner = '') {
  return scene.neighborGate && shownNeighbors(owner).length ? { wall: 'L', ...scene.neighborGate } : null;
}

// 놀이터의 이웃집 문을 두 번 눌렀을 때 뜨는 목록 창. 아바타가 문 앞까지 걸어간 뒤에 뜬다(src/os.js의 useNeighbor).
// 갈 곳을 한 창에서 고르게 한다(동물의 숲 비행장 카운터, 해비호텔 내비게이터). 줄마다 주인 사진과 이름, "놀러 가기" 단추를 두고,
// 단추를 누르면 바로 그 집에 손님으로 들어간다. 단추 옆에 어느 집인지 보이므로 한 번 더 묻지 않는다(로그인 화면의 이웃집 자리와 같다, known-issues 32).
// 돌아오는 길(손님 바탕화면의 내 컴퓨터로 아이콘)과 닫히는 창은 사용자가 모르는 것이라 그때만 목록 아래에 한 줄씩 알린다.
// link 이웃집은 부팅할 때 받아 두어 보통은 바로 놀러 갈 수 있다. 아직 받는 중인 집은 "불러오는 중"으로 눌리지 않게 두었다가 받으면 바꾸고,
// 서버에 방이 없거나 받지 못했거나 받은 방의 주인이 이 놀이터의 주인이면 그 줄을 뺀다(로그인 화면처럼 따로 알리지 않는다).
// 창 높이는 열 때의 줄 수로 정하고(ROWS줄까지), 그보다 많으면 목록만 창 안에서 스크롤한다.
const ROW_H = 60; // 목록 한 줄의 높이(style.css의 .neighbor-row)
const ROWS = 6;   // 스크롤하지 않고 보이는 줄 수
export function openNeighbors(os) {
  const owner = os.home.owner;
  const list = shownNeighbors(owner);
  // 한 줄에 한 가지씩 둔다(창 폭에서 구절 중간에 줄이 꺾이지 않게)
  const notes = [
    os.hasOwnHome ? '돌아올 때는 내 컴퓨터로 아이콘을 두 번 누르세요.' : '',
    os.wm.all().some(w => w.key !== 'neighbor') ? '열려 있는 창은 닫힙니다.' : '',
  ].filter(Boolean);
  return os.wm.open({
    key: 'neighbor',
    app: { title: '이웃집', icon: 'builtin:neighbor' },
    title: '이웃집 놀러 가기',
    width: 400,
    // 창 안쪽 여백(28), 줄들, 알림 줄(위 여백 10, 한 줄 23), 닫기 단추 줄(46)
    height: 28 + Math.max(1, Math.min(list.length, ROWS)) * ROW_H + (notes.length ? 10 + notes.length * 23 : 0) + 46,
    build(body, win) {
      body.classList.add('neighbor-app');
      const rows = h('ul', { className: 'neighbor-list' });
      let missed = false; // 서버에 닿지 못해 뺀 집이 있는가(빈 목록에 띄울 글을 고른다)
      // 오류는 일어난 일과 할 일을 한 줄씩 쓴다. 두 문장을 이어 쓰면 창 폭(360px)을 넘어 둘째 문장의 구절 중간에서 꺾인다
      const empty = () => {
        if (rows.children.length) return;
        rows.append(h('li', { className: 'neighbor-empty meta' },
          ...(missed ? ['이웃집을 불러오지 못했습니다.', h('br'), '잠시 후 다시 시도해 주세요.'] : ['놀러 갈 수 있는 이웃집이 없습니다.'])));
      };
      // 누를 때마다 새로 푼 집(neighborNow)이라 구경하는 동안 바뀐 것이 목록에 남지 않는다. 서버에 닿지 못해 복사본(keep)으로 연 고정한 집은
      // neighborNow가 모르므로(다음에 서버에 다시 묻는다) 받은 집(got)으로 간다. 로그인 화면의 이웃집 자리(src/login.js의 neighborTile)와 같다
      const go = (n, got) => {
        win.close();
        play('enter');
        os.visit(neighborNow(n) || got, neighborBoard(n));
      };
      const ready = (n, home) => row(n, home.owner, home.picture, () => go(n, home));
      for (const n of list) {
        const now = neighborNow(n);
        if (now) {
          rows.append(ready(n, now));
          continue;
        }
        const wait = row(n, n.name);
        rows.append(wait);
        neighborHome(n).then(home => {
          if (!wait.isConnected) return;
          if (home && home.owner !== owner) {
            const done = ready(n, home);
            wait.replaceWith(done);
            fitName(done);
            return;
          }
          if (home === undefined) missed = true;
          wait.remove();
          empty();
        });
      }
      empty();
      body.append(...[
        rows,
        notes.length ? h('p', { className: 'meta' }, ...notes.flatMap((t, i) => (i ? [h('br'), t] : [t]))) : null,
        h('div', { className: 'link-row' }, h('button', { className: 'btn', type: 'button', onclick: () => win.close() }, '닫기')),
      ].filter(Boolean));
      for (const r of rows.children) fitName(r);
    },
  });
}

// 목록 창의 한 줄. onGo가 없으면 받는 중인 줄이다(사진 자리에 '…', 이름 아래에 "불러오는 중", 단추는 눌리지 않는다).
// 사진이 없는 예전 링크의 집은 로그인 화면처럼 이름의 첫 글자를 보인다. 사진은 줄 높이(60px)에 들도록 고르는 줄의 크기(36)로 둔다
function row(n, name, picture = null, onGo = null) {
  const face = picture
    ? h('span', { className: 'avatar has-pic' }, pictureEl(picture, 36))
    : h('span', { className: 'avatar' }, onGo ? [...name][0] || '?' : '…');
  return h('li', { className: 'neighbor-row', dataset: { neighbor: n.id } },
    face,
    h('span', { className: 'neighbor-name' }, h('b', {}, name), onGo ? null : h('small', { className: 'meta' }, '불러오는 중')),
    h('button', { className: 'btn', type: 'button', disabled: !onGo, onclick: onGo }, '놀러 가기'));
}

// 이름은 두 줄까지 쓰고, 넘치면 글자 사이에서도 줄을 바꾸며 그래도 넘치면 말줄임표로 끝내고 전체 이름을 풍선 도움말로 단다(known-issues 83)
const fitName = r => {
  const b = r.querySelector('.neighbor-name b');
  if (b) fitText(b);
};

