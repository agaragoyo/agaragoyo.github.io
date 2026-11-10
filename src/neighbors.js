// 이웃집(docs/requirements.md의 F19). data/neighbors.js의 공유 링크를 풀어 로그인 화면과 놀이터 울타리에 내놓는다.
// 로그인 화면에서는 사용자처럼 늘어서 누르면 바로 손님으로 들어가고(누르기 전에 이름과 "이웃집 구경하기"가 보인다),
// 놀이터에서는 문패를 단 문을 두 번 누르면 어느 집으로 가는지 묻는 창(askVisit)을 띄운 뒤 들어간다.
// 내 컴퓨터를 떠나 다른 컴퓨터로 가는 일이라 누르기 전에 알린다(동물의 숲 꿈 방문은 섬 이름을, Gather는 다른 공간으로 가는 문에서 확인을 받는다).
import { NEIGHBORS } from '../data/neighbors.js';
import { N } from './config.js';
import { decodeHome } from './share.js';
import { line } from './likes.js';
import { h } from './util.js';
import { play } from './sound.js';

export const MAX_NEIGHBORS = 6;
const GATE_W = 2; // 울타리 문 하나의 폭(칸)

// 링크가 깨졌거나 이름이 없는 줄은 뺀다. 순서는 목록 그대로다.
export const NEIGHBOR_LIST = NEIGHBORS
  .map(n => ({ id: String(n.id), name: line(n.name, 12), room: String(n.room || '') }))
  .filter(n => n.name && decodeHome(n.room))
  .slice(0, MAX_NEIGHBORS);

// 그 집을 열 때마다 링크를 새로 푼다(구경하는 동안 바뀐 것이 목록에 남지 않게). 집 이름은 문패 이름으로 맞춘다.
export function neighborHome(n) {
  const home = decodeHome(n.room);
  return home && { ...home, owner: n.name };
}

// 놀이터 왼쪽 울타리에 다는 문 자리. owner: 그 놀이터가 있는 집의 주인 이름.
// 그 집의 문패는 달지 않는다. 그 놀이터의 아파트 문이 이미 그 집으로 가는 문이라, 같은 곳으로 가는 문이 둘이 되어 어색했다.
// 네 집까지는 가운데로 모아 한 칸씩 띄우고, 다섯 집부터는 붙여 단다. 한 집이면 오른쪽 울타리의 아파트 문(칸 5~7)과 마주 보는 자리(칸 5~7)에 선다.
export function neighborGates(owner = '') {
  const list = NEIGHBOR_LIST.filter(n => n.name !== owner);
  const gap = list.length <= 4 ? 1 : 0;
  const start = (N - (list.length * GATE_W + (list.length - 1) * gap)) / 2;
  return list.map((n, i) => ({ ...n, wall: 'L', x: start + i * (GATE_W + gap), w: GATE_W }));
}

// 놀이터의 이웃집 문을 두 번 눌렀을 때 뜨는 창. 어느 집으로 가는지 먼저 보여 주고, 단추는 결과를 말하는 이름으로 둔다(known-issues 32).
// 돌아오는 길(손님 바탕화면의 내 컴퓨터로 아이콘)과 닫히는 창은 사용자가 모르는 것이라 그때만 한 줄로 알린다.
export function askVisit(os, n) {
  const home = neighborHome(n);
  if (!home) return;
  // 한 줄에 한 가지씩 둔다(창 폭에서 구절 중간에 줄이 꺾이지 않게).
  const notes = [
    os.hasOwnHome ? '돌아올 때는 내 컴퓨터로 아이콘을 두 번 누르세요.' : '',
    os.wm.all().some(w => w.key !== 'neighbor') ? '열려 있는 창은 닫힙니다.' : '',
  ].filter(Boolean);
  os.wm.open({
    key: 'neighbor',
    app: { title: '이웃집', color: '#8a5a32' },
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
        h('p', {}, `${n.name}의 집에 놀러 갑니다.`),
        notes.length ? h('p', { className: 'meta' }, ...notes.flatMap((t, i) => (i ? [h('br'), t] : [t]))) : null,
        h('div', { className: 'link-row' },
          h('button', { className: 'btn', type: 'button', onclick: go }, '놀러 가기'),
          h('button', { className: 'btn', type: 'button', onclick: () => win.close() }, '취소')),
      ].filter(Boolean));
    },
  });
}
