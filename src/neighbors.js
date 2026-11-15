// 이웃집(docs/requirements.md의 F19). data/neighbors.js의 목록을 로그인 화면과 놀이터 울타리에 내놓는다.
// 로그인 화면에서는 사용자처럼 늘어서 누르면 바로 손님으로 들어가고(누르기 전에 이름과 "이웃집 구경하기"가 보인다),
// 놀이터에서는 문패를 단 문을 두 번 누르면 어느 집으로 가는지 묻는 창(askVisit)을 띄운 뒤 들어간다.
// 내 컴퓨터를 떠나 다른 컴퓨터로 가는 일이라 누르기 전에 알린다(동물의 숲 꿈 방문은 섬 이름을, Gather는 다른 공간으로 가는 문에서 확인을 받는다).
// 한 줄은 두 가지다. link(주인이 공유하기에서 만든 링크의 번호)는 방을 서버(src/cloud.js)에서 받아 와서 주인이 방을 고치면 따라 바뀌고,
// room(예전 긴 링크의 글자)은 링크를 보낸 때의 모습에 멈춰 있다. link의 방은 페이지를 연 뒤 한 번만 받고, 로그인 화면과 놀이터가 그 값을 같이 쓴다.
// 이름도 같다. link 이웃집은 받은 방의 주인 이름을 써서 주인이 이름 바꾸기(F28)로 닉네임을 바꾸면 따라 바뀌고, 받기 전과 room 이웃집은 목록의 이름을 쓴다.
// 고정한 이웃집(link 줄에 복사본 keep이 있는 줄)은 서버에 방이 없거나 서버에 닿지 못하거나 받은 방이 깨졌을 때 복사본으로 대신 열어서 사라지지 않는다.
// 그런 방을 올린 브라우저에서는 서버의 방을 지우는 길(이 컴퓨터 초기화, 공유하기의 링크 지우기)을 막는다(pinnedHere).
import { NEIGHBORS } from '../data/neighbors.js';
import { N } from './config.js';
import { decodeHome, linkId } from './share.js';
import { fetchHome, sharedId } from './cloud.js';
import { line } from './likes.js';
import { h } from './util.js';
import { play } from './sound.js';

export const MAX_NEIGHBORS = 6;
const GATE_W = 2; // 울타리 문 하나의 폭(칸)

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
function codeOf(n) {
  if (!n.link) return Promise.resolve(n.room);
  if (!asked.has(n.link)) {
    asked.set(n.link, fetchHome(n.link).then(code => {
      const got = n.keep && !(code && decodeHome(code)) ? n.keep : code;
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
export function neighborNow(n) {
  if (!n.link) return toHome(n, n.room);
  return known.has(n.link) ? toHome(n, known.get(n.link)) : undefined;
}

// 지금 보일 이름. 받은 link 이웃집은 서버의 방 주인 이름이고, 받기 전이거나 room 이웃집이면 목록의 이름이다
const shownName = n => neighborNow(n)?.owner || n.name;

// 부팅할 때 link 이웃집의 방을 미리 받는다. 받은 집마다 got(집)을 부른다(가구 그림 미리 받기, src/os.js)
export function prefetchNeighbors(got) {
  for (const n of NEIGHBOR_LIST) if (n.link) neighborHome(n).then(home => home && got(home));
}

// 놀이터 왼쪽 울타리에 다는 문 자리. owner: 그 놀이터가 있는 집의 주인 이름.
// 그 집의 문패는 달지 않는다. 그 놀이터의 아파트 문이 이미 그 집으로 가는 문이라, 같은 곳으로 가는 문이 둘이 되어 어색했다.
// 견주는 이름은 지금 보일 이름(shownName)이라, 이웃집 주인이 이름을 바꿔도 자기 놀이터에 자기 집 문패가 생기지 않는다(known-issues 78).
// 서버에 방이 없다고 확인된 link 이웃집도 달지 않는다. 받는 중이거나 받지 못한 집은 달아 두고, 문을 쓸 때(askVisit) 다시 받는다.
// 네 집까지는 가운데로 모아 한 칸씩 띄우고, 다섯 집부터는 붙여 단다. 한 집이면 오른쪽 울타리의 아파트 문(칸 5~7)과 마주 보는 자리(칸 5~7)에 선다.
export function neighborGates(owner = '') {
  const list = NEIGHBOR_LIST
    .filter(n => neighborNow(n) !== null)
    .map(n => ({ ...n, name: shownName(n) }))
    .filter(n => n.name !== owner);
  const gap = list.length <= 4 ? 1 : 0;
  const start = (N - (list.length * GATE_W + (list.length - 1) * gap)) / 2;
  return list.map((n, i) => ({ ...n, wall: 'L', x: start + i * (GATE_W + gap), w: GATE_W }));
}

// 놀이터의 이웃집 문을 두 번 눌렀을 때 뜨는 창. 어느 집으로 가는지 먼저 보여 주고, 단추는 결과를 말하는 이름으로 둔다(known-issues 32).
// 돌아오는 길(손님 바탕화면의 내 컴퓨터로 아이콘)과 닫히는 창은 사용자가 모르는 것이라 그때만 한 줄로 알린다.
// link 이웃집은 부팅할 때 받아 두어서 보통은 기다리지 않는다. 받는 사이에 다른 컴퓨터로 옮겨 갔으면 창을 띄우지 않는다.
export async function askVisit(os, n) {
  const at = os.home;
  const home = await neighborHome(n);
  if (os.home !== at) return;
  if (!home) {
    os.toast(home === null ? `${n.name}의 집을 찾을 수 없습니다.` : `${n.name}의 집을 불러오지 못했습니다. 잠시 후 다시 눌러 주세요.`, 7000);
    return;
  }
  // 한 줄에 한 가지씩 둔다(창 폭에서 구절 중간에 줄이 꺾이지 않게).
  const notes = [
    os.hasOwnHome ? '돌아올 때는 내 컴퓨터로 아이콘을 두 번 누르세요.' : '',
    os.wm.all().some(w => w.key !== 'neighbor') ? '열려 있는 창은 닫힙니다.' : '',
  ].filter(Boolean);
  os.wm.open({
    key: 'neighbor',
    app: { title: '이웃집', icon: 'builtin:neighbor' },
    title: '이웃집 놀러 가기',
    width: 360,
    height: 150 + notes.length * 22,
    build(body, win) {
      const go = () => {
        win.close();
        play('enter');
        os.visit(home);
      };
      body.append(...[
        h('p', {}, `${home.owner}의 집에 놀러 갑니다.`),
        notes.length ? h('p', { className: 'meta' }, ...notes.flatMap((t, i) => (i ? [h('br'), t] : [t]))) : null,
        h('div', { className: 'link-row' },
          h('button', { className: 'btn', type: 'button', onclick: go }, '놀러 가기'),
          h('button', { className: 'btn', type: 'button', onclick: () => win.close() }, '취소')),
      ].filter(Boolean));
    },
  });
}
