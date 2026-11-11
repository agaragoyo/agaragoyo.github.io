// 로그인 화면. 이 컴퓨터의 내 집, 링크로 온 친구 집, 이웃집을 사용자처럼 늘어놓고,
// 맨 끝에 내 집이 있으면 이 컴퓨터 초기화를, 없으면 새 사용자 만들기를 둔다.
// 화면 바꾸기, 고른 집으로 들어가기(환영 화면을 지나 바탕화면으로), 진행 중인 연출을 멈추는 실행 번호는 src/os.js에 있고 여기서는 넘겨받아 쓴다.
import { STORAGE_ROOM, STORAGE_ROOM_OLD, STORAGE_SETTINGS } from './config.js';
import { APPS } from '../data/apps.js';
import { sanitizeHome, decodeHome, linkCode, linkId } from './share.js';
import { fetchHome, sharedId, unshare } from './cloud.js';
import { NEIGHBOR_LIST, neighborHome } from './neighbors.js';
import { h, wait, loadJSON, saveJSON } from './util.js';
import { play } from './sound.js';

// os: 창 닫기(os.wm), 모드 비우기(os.mode), 새 사용자의 튜토리얼 켜기(os.tutorial)에 쓴다. el: 화면 요소들(여기서는 el.login만 쓴다)
// show(...names): 보일 화면 고르기. enter(mode, home, my, boardId): 고른 집으로 들어가기. toast(msg, ms): 알림. clearHash(): 주소의 방 링크 지우기
// nextRun(): 새 실행 번호 받기(전원을 끄거나 로그아웃하면 번호가 바뀐다). isCurrent(my): my가 아직 지금 실행인지
// 돌려주는 것: 부팅할 때 미리 받기(loginHomes, cloudHome), 내 집(ownHome), 로그인 화면(showLogin), 시작 메뉴의 사용자 그림(avatar)
export function createLogin({ os, el, show, enter, toast, clearHash, nextRun, isCurrent }) {
  // 이 컴퓨터에 저장된 내 집. 없거나 이름이 없으면 null이다.
  function ownHome() {
    const own = sanitizeHome(loadJSON(STORAGE_ROOM) || loadJSON(STORAGE_ROOM_OLD));
    return own && own.owner ? own : null;
  }

  // 로그인 화면에서 고를 수 있는 집들: 내 집, 링크로 온 친구 집, 이웃집. 부팅할 때 이 집들의 가구 그림을 미리 받는다.
  // 짧은 링크(#s=)로 온 친구 집은 서버에서 받아야 해서 여기 없고, cloudHome이 받은 뒤에 따로 미리 받는다.
  function loginHomes() {
    const m = linkCode(location.hash);
    return [ownHome(), m && decodeHome(m), ...NEIGHBOR_LIST.map(neighborHome)].filter(Boolean);
  }

  // 짧은 링크(#s=번호)의 방을 서버에서 받아 온다(src/cloud.js). 링크마다 한 번만 받는다.
  // 받은 값: 집, null(그런 방이 없거나 깨짐), undefined(서버에 닿지 못함. 이때는 다음에 다시 받도록 기억하지 않는다)
  const cloudHomes = new Map();
  function cloudHome(id) {
    if (!cloudHomes.has(id)) {
      cloudHomes.set(id, fetchHome(id).then(code => (code ? decodeHome(code) : null), err => {
        console.warn('짧은 링크의 방을 받지 못했다', err);
        cloudHomes.delete(id);
        return undefined;
      }));
    }
    return cloudHomes.get(id);
  }

  // 짧은 링크로 온 친구 집의 자리. 받아 오는 동안은 누를 수 없게 두고, 받으면 손님으로 구경하기로 바꾼다.
  function cloudTile(id, my) {
    const tile = h('button', { type: 'button', className: 'user', disabled: true },
      h('span', { className: 'avatar' }, '…'),
      h('span', { className: 'user-name' }, '친구 방', h('small', {}, '불러오는 중')));
    cloudHome(id).then(friend => {
      if (!isCurrent(my) || !tile.isConnected) return;
      if (friend) {
        tile.replaceWith(userTile(friend.owner, '손님으로 구경하기', () => enter('visit', friend, my, id)));
        return;
      }
      tile.remove();
      if (friend === null) toast('링크의 방을 찾을 수 없습니다. 친구에게 링크를 다시 받아 주세요.', 7000);
      else toast('친구 방을 불러오지 못했습니다. 페이지를 새로고침해 주세요.', 7000);
    });
    return tile;
  }

  function showLogin() {
    const my = nextRun();
    os.wm.closeAll();
    os.mode = null;
    show('login');
    const users = el.login.querySelector('.users');
    users.replaceChildren();
    const own = ownHome();

    const m = linkCode(location.hash);
    const sid = linkId(location.hash);
    if (m) {
      const friend = decodeHome(m);
      if (friend) users.append(userTile(friend.owner, '손님으로 구경하기', () => enter('visit', friend, my)));
      else toast('링크가 깨져서 친구 컴퓨터를 열 수 없었습니다.');
    } else if (sid) {
      users.append(cloudTile(sid, my));
    }
    // 이웃집(data/neighbors.js)은 친구 링크로 오지 않았을 때 사용자처럼 늘어선다. 누르면 바로 손님으로 들어간다.
    // 처음 온 사람에게는 새 사용자 만들기보다 위에 두어, 빈 방을 꾸미기 전에 채워진 방을 먼저 볼 수 있게 한다.
    const linked = !!(m || sid);
    const nearby = linked ? [] : NEIGHBOR_LIST.map(n => userTile(n.name, '이웃집 구경하기', () => enter('visit', neighborHome(n), my), 'neighbor'));
    if (own) {
      users.append(userTile(own.owner, linked ? '내 컴퓨터로 가기' : '내 컴퓨터', () => {
        clearHash();
        enter('edit', own, my);
      }));
      users.append(...nearby, resetButton());
    } else {
      users.append(...nearby);
      users.append(newUserTile(name => {
        clearHash();
        const home = sanitizeHome({ owner: name });
        saveJSON(STORAGE_ROOM, home);
        os.tutorial.arm();
        enter('edit', home, my);
      }));
    }
  }

  // 이 컴퓨터 초기화: 저장된 집(계정)과 게임 최고 점수를 지운다. 이 컴퓨터의 설정(밤, 소리, 배경음악)은 남긴다.
  // 새 계정 만들기와 친구 링크 구경을 다시 시험할 때 쓴다.
  // 배포 주소에 따라 다른 사이트와 저장소를 같이 쓸 수 있으므로, 우리 키만 골라 지운다.
  // 우리 키: 'agarago.'로 시작하는 것과, apps/ 안 앱이 자기 id로 시작하게 만든 것('tidy-up.best').
  const ownApps = APPS.filter(a => a.src?.startsWith('apps/')).map(a => a.id + '.');
  const ownKey = key => key.startsWith('agarago.') || ownApps.some(p => key.startsWith(p));
  // 되돌릴 수 없는 일이라 바로 지우지 않고, 지울 것을 보여 준 뒤 결과를 말하는 단추로 받는다(known-issues 32).
  // 짧은 링크로 서버에 올린 방(src/cloud.js)도 같이 지운다. 서버가 늦으면 3초까지만 기다리고 이 컴퓨터의 것은 지운다.
  function resetButton() {
    const box = h('div', { className: 'reset-box' });
    const wipe = async () => {
      if (sharedId()) await Promise.race([unshare().catch(err => console.warn('서버의 방을 지우지 못했다', err)), wait(3000)]);
      try {
        for (const key of Object.keys(localStorage)) if (ownKey(key) && key !== STORAGE_SETTINGS) localStorage.removeItem(key);
      } catch { /* 저장소를 못 쓰는 환경 */ }
      showLogin();
    };
    const ask = () => box.replaceChildren(
      h('p', {}, sharedId()
        ? '이 컴퓨터의 집과 게임 기록, 짧은 링크의 방과 쪽지를 지웁니다. 되돌릴 수 없습니다.'
        : '이 컴퓨터에 저장된 집과 게임 기록을 지웁니다. 되돌릴 수 없습니다.'),
      h('div', { className: 'reset-row' },
        h('button', { type: 'button', className: 'btn', onclick: wipe }, '지우기'),
        h('button', { type: 'button', className: 'btn', onclick: idle }, '그대로 두기')),
    );
    const idle = () => box.replaceChildren(h('button', { type: 'button', className: 'reset-link', onclick: ask }, '이 컴퓨터 초기화'));
    idle();
    return box;
  }

  const avatar = name => h('span', { className: 'avatar' }, [...name][0] || '?');

  function userTile(name, sub, onPick, kind = '') {
    return h('button', { type: 'button', className: kind ? `user ${kind}` : 'user', onclick: onPick },
      avatar(name),
      h('span', { className: 'user-name' }, name, h('small', {}, sub)));
  }

  function newUserTile(onCreate) {
    const input = h('input', { maxLength: 12, autocomplete: 'off', placeholder: '닉네임 (최대 12글자)', 'aria-label': '닉네임' });
    // 아이디를 칠 때 한 글자마다 키보드 소리(사운드 정리표의 "ID 입력 사운드"). 누르고 있어 되풀이되는 키와 Enter, 조합 키는 빼고, 한글 입력 중(Process)도 소리를 낸다.
    input.addEventListener('keydown', e => {
      if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || ['Backspace', 'Delete', 'Process'].includes(e.key))) play('key');
    });
    // 빈 칸으로 확인을 누르면 입력칸을 빨갛게 두르고 그 아래에 풍선 안내를 띄운다. 글자를 치면 거둔다.
    const tip = h('p', { className: 'name-tip', id: 'name-tip', role: 'alert', hidden: true }, '닉네임을 입력해 주세요.');
    const showTip = on => {
      tip.hidden = !on;
      if (on) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    };
    input.setAttribute('aria-describedby', 'name-tip');
    input.addEventListener('input', () => { if (input.value.trim()) showTip(false); });
    const form = h('form', {
      className: 'user new',
      onsubmit: e => {
        e.preventDefault();
        const name = input.value.trim().slice(0, 12);
        if (name) onCreate(name);
        else {
          showTip(true);
          input.focus();
        }
      },
    },
    h('span', { className: 'avatar' }, '+'),
    h('span', { className: 'user-name' }, '새 사용자 만들기',
      h('span', { className: 'new-row' }, input, h('button', { type: 'submit', className: 'btn' }, '확인'), tip)));
    setTimeout(() => input.focus(), 50);
    return form;
  }

  return { ownHome, loginHomes, cloudHome, showLogin, avatar };
}
