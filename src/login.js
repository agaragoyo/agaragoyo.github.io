// 로그인 화면. 이 컴퓨터의 내 집, 링크로 온 친구 집, 이웃집을 사용자처럼 늘어놓는다.
// 왼쪽 단(.users-own, 로고와 안내 아래)은 나다. 내 집이 있으면 내 사용자와 그 아래 글자 단추(다른 아이디로 로그인, 새 사용자 만들기, 이 컴퓨터 초기화나 이 컴퓨터에서 지우기)를,
// 없으면 새 사용자 만들기(닉네임과 사진)와 "내 아이디로 로그인"을 둔다. 로그인 글자 단추를 누르면 왼쪽 단이 아이디와 비밀번호를 치는 로그인 칸으로 바뀐다(F36, src/sign-in.js).
// 이 컴퓨터에 사용자가 둘 이상이면(F37, src/user-drawers.js) 마지막에 쓴 사용자를 내 사용자로 크게 두고, 그 아래 "다른 사용자" 무리에 나머지를 작은 칸으로 세운다(othersGroup).
// 오른쪽 단(.users-friends)은 친구 집이다. 링크로 온 친구 집이나, 최근에 놀러 간 집과 이웃집의 사진 칸 격자와 그 아래 친구 아이디 칸(handleTile)을 둔다.
// 이웃집은 팀원의 방을 미리 넣어 둔 친구 집이라, 아이디로 찾아가는 칸을 그 아래에 두어 친구에게 가는 길을 한 단에 모았다.
// 격자는 넷플릭스의 프로필 고르기, 윈도우 XP의 사용자 계정 창처럼 사진 아래에 이름 한 줄만 쓴다. 칸마다 같은 설명을 되풀이하지 않고 무리마다 제목을 한 번 둔다.
// 화면 바꾸기, 고른 집으로 들어가기(환영 화면을 지나 바탕화면으로), 진행 중인 연출을 멈추는 실행 번호는 src/os.js에 있고 여기서는 넘겨받아 쓴다.
import { STORAGE_ROOM, STORAGE_ROOM_OLD, NEW_ROOM_DECOR, MAX_USERS } from './config.js';
import { sanitizeHome, decodeHome, linkCode, linkId } from './share.js';
import { fetchHome, sharedId, unshare, myHandle, hasPassword, standUp } from './cloud.js';
import { moved, reseat } from './seat.js';
import { wipeUser } from './home-store.js';
import { drawers, swapTo, clearSeat, seatDone, promoteNext, userCount } from './user-drawers.js';
import { createSignIn, FULL, noSpace } from './sign-in.js';
import { markNews } from './user-account.js';
import { NEIGHBOR_LIST, neighborHome, neighborNow, neighborBoard, pinnedHere, handleInput, brLines, recentVisits, syncVisit } from './neighbors.js';
import { ownPicture, saveOwnPicture, randomPicture, pictureEl, picturePicker } from './user-pictures.js';
import { preloadFurniture } from './room.js';
import { iconEl } from './icons.js';
import { h, wait, loadJSON, saveJSON, fitText } from './util.js';
import { play } from './sound.js';

// os: 창 닫기(os.wm), 모드 비우기(os.mode), 새 사용자의 튜토리얼 켜기(os.tutorial)에 쓴다. el: 화면 요소들(여기서는 el.login만 쓴다)
// show(...names): 보일 화면 고르기. enter(mode, home, my, boardId): 고른 집으로 들어가기. toast(msg, ms): 알림. clearHash(): 주소의 방 링크 지우기
// nextRun(): 새 실행 번호 받기(전원을 끄거나 로그아웃하면 번호가 바뀐다). isCurrent(my): my가 아직 지금 실행인지
// takeSeat(): 저장된 사용자를 새로 읽는다고 알리기(src/seat.js). forgetSync(): 서버의 방과 맞추던 일 버리기(src/home-sync.js)
// 돌려주는 것: 부팅할 때 미리 받기(loginHomes, cloudHome), 내 집(ownHome), 로그인 화면(showLogin), 시작 메뉴의 사용자 그림(avatar)
// 이 컴퓨터의 내 사용자에는 고른 사진(src/user-pictures.js)이 보이고, 링크로 온 친구 집, 최근에 놀러 간 집, 이웃집에는 링크에 담긴 주인 사진이 보인다.
// 사진을 넣기 전에 만든 링크와, 그림 파일로 만든 사진(내 그림)을 쓰는 주인의 긴 링크는 사진이 없으므로 이름의 첫 글자가 보인다.
export function createLogin({ os, el, show, enter, toast, clearHash, takeSeat, nextRun, isCurrent, forgetSync }) {
  // 이 컴퓨터에 저장된 내 집. 없거나 이름이 없으면 null이다.
  function ownHome() {
    const own = sanitizeHome(loadJSON(STORAGE_ROOM) || loadJSON(STORAGE_ROOM_OLD));
    return own && own.owner ? own : null;
  }

  // 로그인 화면에서 고를 수 있는 집들: 내 집, 이 컴퓨터의 다른 사용자, 링크로 온 친구 집, 이웃집. 부팅할 때 이 집들의 가구 그림을 미리 받는다.
  // 짧은 링크(#s=)로 온 친구 집과 link 이웃집은 서버에서 받아야 해서 여기 없고, 받은 뒤에 따로 미리 받는다(src/os.js의 boot).
  function loginHomes() {
    const m = linkCode(location.hash);
    return [ownHome(), ...drawers().map(d => d.home), m && decodeHome(m), ...NEIGHBOR_LIST.map(neighborNow)].filter(Boolean);
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
        tile.replaceWith(userTile(friend.owner, '손님으로 구경하기', () => enter('visit', friend, my, id), '', friend.picture));
        return;
      }
      tile.remove();
      if (friend === null) toast('링크의 방을 찾을 수 없습니다. 친구에게 링크를 다시 받아 주세요.', 7000);
      else toast('친구 방을 불러오지 못했습니다. 페이지를 새로고침해 주세요.', 7000);
    });
    return tile;
  }

  // 이웃집이 이 브라우저의 사용자가 올린 방인가. 앉은 사용자가 올린 짧은 링크 번호(src/cloud.js의 sharedId)나 서랍에 든 다른 사용자가 올린 번호(F37)가
  // 이웃집의 link와 같으면 그렇다. rooms가 그 번호들이다. 그 방은 내 사용자나 다른 사용자 칸으로 이미 떠 있다.
  // 이름으로 견주지 않는다. 손님이 이웃과 같은 닉네임을 골랐을 때 그 이웃집이 사라지기 때문이다. 이웃집 목록 창만 지금 집 주인의 이름으로 거른다(src/neighbors.js의 shownNeighbors).
  // 이 컴퓨터 초기화처럼 올린 기록이 없어지면 걸리지 않는다.
  const uploadedHere = (n, rooms) => !!n.link && rooms.includes(n.link);

  // 오른쪽 단 격자의 사진 칸(최근에 놀러 간 집, 이웃집). 사진 아래에 이름 한 줄만 쓰고, 누르면 바로 그 집에 손님으로 들어간다.
  // 이름은 넘치면 말줄임표로 끝내고 전체 이름을 title로 단다(fitName, known-issues 83). 이름 글자는 이름 상자의 첫 글자 마디다(tools/smoke.mjs가 그렇게 읽는다).
  // onPick이 없으면 받는 중인 칸이다. 사진 자리에 '…'를 두고 누를 수 없으며, 마우스를 올리면 "불러오는 중"이 뜬다.
  function gridTile(kind, name, picture, onPick = null) {
    return h('button', { type: 'button', className: `user friend-tile ${kind}`, disabled: !onPick, title: onPick ? null : '불러오는 중', onclick: onPick },
      onPick ? avatar(name, picture, 'tile') : h('span', { className: 'avatar' }, '…'),
      h('span', { className: 'user-name' }, name));
  }
  const fitName = tile => {
    const name = tile.querySelector('.user-name');
    if (name) fitText(name);
  };
  // 서버에 방이 없는 칸을 뺀다. 그 무리에 칸이 하나도 남지 않으면 무리의 제목도 거둔다
  function dropTile(tile) {
    const col = tile.parentElement;
    tile.remove();
    for (const head of col?.querySelectorAll('.friend-head') || []) {
      if (!head.nextElementSibling?.matches('.friend-tile')) head.remove();
    }
  }

  // 이웃집의 칸. link 이웃집(src/neighbors.js)은 서버에서 받는 동안 목록의 이름만 보이고 누를 수 없게 둔다(cloudTile과 같은 방식).
  // 받으면 서버의 방 주인 이름으로 보인다(주인이 이름 바꾸기로 닉네임을 바꾸면 따라 바뀐다).
  // 서버에 방이 없거나 받지 못하면 그 이웃집을 뺀다. 사용자가 부른 집이 아니라서 따로 알리지 않는다. 서버에 방이 없다고 이미 알면 null이다.
  function neighborTile(n, my) {
    const ready = home => gridTile('neighbor', home.owner, home.picture, () => enter('visit', neighborNow(n) || home, my, neighborBoard(n)));
    const now = neighborNow(n);
    if (now !== undefined) return now && ready(now);
    const tile = gridTile('neighbor', n.name, null);
    neighborHome(n).then(home => {
      if (!isCurrent(my) || !tile.isConnected) return;
      if (!home) return dropTile(tile);
      const done = ready(home);
      tile.replaceWith(done);
      fitName(done);
    });
    return tile;
  }

  // 최근에 놀러 간 집의 칸(src/neighbors.js의 recentVisits). 기억한 이름과 사진으로 바로 그리고, 서버에서 방을 받으면 지금 주인 이름과 사진으로 바꿔 기억도 고친다.
  // 받는 일은 짧은 링크로 온 친구 집과 같이 쓴다(cloudHome, 페이지를 연 뒤 방마다 한 번).
  // 누르면 받은 방에 손님으로 들어간다. 아이디로 찾은 방(handleTile)처럼 환영 화면을 지나는 동안 가구 그림을 받고, 코르크 보드에 쪽지를 남기도록 방 번호를 넘긴다.
  // 받기 전에 눌렀으면 받을 때까지 눌리지 않게 두었다가 들어간다. 서버에 방이 없으면 칸을 빼고 기억에서도 지우며, 누른 뒤였다면 알린다.
  // 서버에 닿지 못하면 기억한 모습 그대로 두고, 누르면 다시 받는다.
  function recentTile(v, my) {
    let wanted = false; // 받기 전에 눌렀다
    let asking = null;  // 받는 중인 일
    const tile = gridTile('recent', v.name, v.picture, () => {
      wanted = true;
      tile.disabled = true;
      ask();
    });
    const ask = () => {
      asking ||= cloudHome(v.room).then(home => {
        asking = null;
        syncVisit(v.room, home);
        if (!isCurrent(my) || !tile.isConnected) return;
        const go = wanted;
        wanted = false;
        tile.disabled = false;
        if (home === null) {
          dropTile(tile);
          if (go) toast('친구 방을 찾을 수 없습니다. 친구에게 링크를 다시 받아 주세요.', 7000);
          return;
        }
        if (home) {
          tile.replaceChildren(avatar(home.owner, home.picture, 'tile'), h('span', { className: 'user-name' }, home.owner));
          fitName(tile);
        }
        if (!go) return;
        if (!home) {
          toast('친구 방을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 7000);
          return;
        }
        clearHash();
        preloadFurniture([home]);
        enter('visit', home, my, v.room);
      });
    };
    ask();
    return tile;
  }

  // 다른 탭에서 사용자가 바뀌었으면(src/seat.js) 이 화면의 내 사용자는 앞 사용자다. 하려던 일을 하지 않고 지금 사용자로 다시 그린 뒤 알린다. 바뀌었으면 참이다
  function staleLogin() {
    if (!moved()) return false;
    showLogin();
    toast('다른 탭에서 사용자가 바뀌었습니다.', 7000);
    return true;
  }

  // 이 탭에서 앉은 사용자를 바꿨다(F37). 메모리에 든 앞 사용자의 로그인과 예약한 올리기, 서버의 방과 맞추던 일을 버리고, 펫과 튜토리얼 진행을 새로 읽는다
  function reseated() {
    standUp();
    forgetSync();
    takeSeat();
  }
  // 서버의 답을 기다리는 동안 로그인 화면을 누를 수 없게 한다. 기다리는 사이에 다른 사용자로 들어가면 지우려던 사용자가 바뀐다
  const hold = on => { el.login.inert = on; };
  // 사용자를 더 두지 못할 때의 알림(F37). 다섯 명이 찼으면 먼저 지우라고 알린다
  const tellFull = lines => toast(lines.join(' '), 7000);

  function showLogin() {
    const my = nextRun();
    os.wm.closeAll();
    os.mode = null;
    show('login');
    takeSeat();
    el.login.classList.remove('entering'); // 서버의 방을 기다리던 환영 화면(src/os.js의 enter)에서 전원을 껐다 켜 왔으면 걷는다
    const mine = el.login.querySelector('.users-own');
    const friends = el.login.querySelector('.users-friends');
    mine.replaceChildren();
    friends.replaceChildren();
    const own = ownHome();

    const m = linkCode(location.hash);
    const sid = linkId(location.hash);
    if (m) {
      const friend = decodeHome(m);
      if (friend) friends.append(userTile(friend.owner, '손님으로 구경하기', () => enter('visit', friend, my), '', friend.picture));
      else toast('링크가 깨져서 친구 컴퓨터를 열 수 없었습니다.');
    } else if (sid) {
      friends.append(cloudTile(sid, my));
    }
    // 최근에 놀러 간 집, 이웃집(data/neighbors.js), 친구 아이디 칸은 친구 링크로 오지 않았을 때만 오른쪽 단에 늘어선다. 링크로 왔으면 그 친구 집 하나에 눈이 가게 모두 뺀다.
    // 최근에 놀러 간 집과 이웃집은 3열 사진 칸 격자(.friend-grid)로 서고, 무리마다 위에 제목을 한 번 둔다. 칸이 없는 무리는 제목도 두지 않는다.
    // 이웃집은 누르면 바로 손님으로 들어간다. 처음 온 사람도 빈 방을 꾸미기 전에 채워진 방을 먼저 볼 수 있다.
    // 이 브라우저에서 올린 방은 내 사용자로 이미 떠 있어서 이웃집 칸에서 뺀다(같은 방이 두 번 뜨지 않게, known-issues 84).
    const others = drawers();
    const listing = !(m || sid);
    friends.classList.toggle('friend-grid', listing);
    if (listing) {
      const group = (title, tiles) => (tiles.length ? [h('h2', { className: 'friend-head' }, title), ...tiles] : []);
      const rooms = [sharedId(), ...others.map(d => d.room)].filter(Boolean);
      friends.append(
        ...group('최근에 놀러 간 집', recentVisits().map(v => recentTile(v, my))),
        ...group('이웃집', NEIGHBOR_LIST.filter(n => !uploadedHere(n, rooms)).map(n => neighborTile(n, my)).filter(Boolean)),
        handleTile(my));
      for (const tile of friends.querySelectorAll('.friend-tile')) fitName(tile);
    }
    const showMine = () => (own ? showOwn() : showNew());
    showMine();

    // 내 사용자. 그 아래에 다른 아이디로 로그인, 새 사용자 만들기, 이 컴퓨터 초기화나 이 컴퓨터에서 지우기를 글자 단추로 두고, 다른 사용자가 있으면 그 무리를 둔다
    function showOwn() {
      mine.replaceChildren(userTile(own.owner, m || sid ? '내 컴퓨터로 가기' : '내 컴퓨터', () => {
        if (staleLogin()) return;
        clearHash();
        enter('edit', own, my);
      }, '', ownPicture(own.owner)), ownLinks(openForm, openNew, own, others.length > 0, my), ...othersGroup(others, my));
    }
    // 앉은 사용자가 없다. 다른 사용자는 앉은 사용자를 지울 때 하나가 앉으므로, 서랍만 남는 것은 저장소를 손으로 고쳤을 때뿐이다
    function showNew() {
      mine.replaceChildren(newUserTile(create), linkButton('내 아이디로 로그인', openForm), ...othersGroup(others, my));
    }
    // 내 사용자가 있을 때의 새 사용자 만들기. 만들면 내 사용자는 지우지 않고 다른 사용자로 간다(F37). 그 아래 글자 단추로 돌아간다
    function openNew() {
      if (userCount() >= MAX_USERS) return tellFull(FULL);
      mine.replaceChildren(newUserTile(create), linkButton('내 사용자로 돌아가기', showMine));
    }
    function create(name, picture) {
      if (staleLogin()) return;
      const cleared = clearSeat(); // 앉은 사용자를 서랍에 넣고 비운다. 없었으면 손님으로 놀다 남은 기록을 새 사용자가 이어 쓴다
      if (cleared !== true) return tellFull(cleared === 'full' ? FULL : noSpace('새 사용자를 만들지'));
      if (own) reseated();
      clearHash();
      const home = sanitizeHome({ owner: name, decor: NEW_ROOM_DECOR });
      saveOwnPicture(picture);
      os.tutorial.arm();
      markNews(); // 새 기능 안내는 튜토리얼 끝 카드가 대신한다
      saveJSON(STORAGE_ROOM, home); // 집을 맨 나중에 쓴다. 그 전에 꺼지면 앞 사용자가 다시 앉는다(src/user-drawers.js)
      seatDone();
      enter('edit', home, my);
    }
    // 로그인 칸(src/sign-in.js). 그 아래 글자 단추로 돌아간다. 내 사용자가 있으면 받은 계정이 사용자 하나를 더하므로 다섯 명이 찼으면 먼저 알린다
    function openForm() {
      if (own && userCount() >= MAX_USERS) return tellFull(FULL);
      mine.replaceChildren(signIn.form({ my, box: mine, title: own ? '다른 아이디로 로그인' : '내 아이디로 로그인' }),
        linkButton(own ? '내 사용자로 돌아가기' : '새 사용자 만들기', showMine));
    }
  }

  // 이 컴퓨터의 다른 사용자(F37). 무리 제목 "다른 사용자" 아래에 작은 칸(사진, 이름, 아이디)을 최근에 쓴 사용자부터 세우고, 누르면 비밀번호 없이 그 사용자로 바꿔 들어간다.
  // 다음에 로그인 화면에 오면 그 사용자가 내 사용자 칸에 크게 선다. 다른 사용자가 없으면 아무것도 두지 않는다.
  // 맨 아래 "사용자 지우기"를 누르면 칸마다 왼쪽에 지우기 단추가 뜨고(구글 계정 고르기의 계정 삭제), 누른 칸은 밝게, 다른 칸은 흐리게 두고 그 아래에
  // 무엇이 지워지는지 보인 뒤 결과를 말하는 단추로 받는다(src/sign-in.js의 askRemove). "완료"를 누르면 지우기 단추를 거둔다.
  // 지우기를 고르는 동안(.removing) 내 사용자 아래 글자 단추는 숨긴다. 사용자가 다섯 명일 때 확인 줄까지 떠도 가운데 띠 안에 들게 한다
  function othersGroup(others, my) {
    if (!others.length) return [];
    const mine = el.login.querySelector('.users-own');
    const list = h('div', { className: 'others' });
    const foot = h('div', { className: 'reset-box' });
    const link = (label, onclick) => h('button', { type: 'button', className: 'reset-link', onclick }, label);
    const tile = d => h('button', { type: 'button', className: 'user other', onclick: () => switchTo(d, my) },
      avatar(d.name, d.picture, 36),
      h('span', { className: 'user-name' }, d.name, d.handle ? h('small', {}, `아이디 ${d.handle}`) : null));
    const idle = () => {
      mine.classList.remove('removing');
      list.replaceChildren(...others.map(tile));
      foot.replaceChildren(link('사용자 지우기', () => removing()));
    };
    // 지우기를 고르는 중. picked: 지우기를 누른 사용자
    const removing = (picked = null) => {
      mine.classList.add('removing');
      list.replaceChildren(...others.map(d => {
        const t = tile(d);
        t.disabled = true;
        t.classList.toggle('picked', d === picked);
        t.classList.toggle('dim', !!picked && d !== picked);
        return h('div', { className: 'other-row' },
          h('button', { type: 'button', className: 'btn other-drop', title: `${d.name} 지우기`, onclick: () => pick(d) }, '지우기'), t);
      }));
      if (!picked) foot.replaceChildren(link('완료', idle));
    };
    const pick = d => {
      if (staleLogin()) return;
      removing(d);
      signIn.askRemove(d, foot, () => removing(), my);
    };
    idle();
    return [h('div', { className: 'others-box' }, h('h2', { className: 'friend-head others-head' }, '다른 사용자'), list, foot)];
  }

  // 다른 사용자 칸을 눌렀다. 그 사용자를 앉히고(앉아 있던 사용자는 다른 사용자로 간다) 내 컴퓨터로 들어간다
  function switchTo(d, my) {
    if (staleLogin()) return;
    const home = swapTo(d.id);
    if (home === null) return showLogin(); // 다른 탭에서 그 사용자를 지웠다
    if (!home) return tellFull(noSpace('사용자를 바꾸지'));
    reseated();
    clearHash();
    enter('edit', ownHome() || home, my);
  }

  // 친구 아이디로 놀러 가기(F31). 오른쪽 단의 이웃집 격자 아래에 단의 폭으로 서고, 처음 온 사람도 사용자를 만들지 않고 아이디만으로 들어간다.
  // 아이디를 찾고 오류를 고르는 일은 이웃집 목록 창 아래의 칸과 같이 쓴다(src/neighbors.js의 handleInput). 그림은 이웃집 창의 집 아이콘이다.
  // 오류는 새 사용자 만들기의 닉네임 칸처럼 칸을 빨갛게 두르고 노란 풍선으로 띄운다(윈도우 XP도 암호가 틀리면 칸 아래에 풍선을 띄운다).
  // 풍선이 떠 있는 동안 칸 아래 안내는 자리만 남기고 감춘다. 단이 가운데 정렬이라 높이가 바뀌면 위의 이웃집까지 움직인다.
  // 찾으면 짧은 링크로 온 친구 집(cloudTile)처럼 손님으로 들어간다. 그 방의 코르크 보드에 쪽지를 남기도록 방 번호를 boardId로 넘긴다.
  // 아이디로 찾은 방은 부팅할 때 받아 두지 않았으므로 환영 화면을 지나는 동안 가구 그림을 받는다(known-issues 54).
  function handleTile(my) {
    const tip = h('p', { className: 'name-tip', id: 'handle-tip', role: 'alert', hidden: true });
    const hint = h('small', {}, '아이디는 친구가 공유하기 창에서 정합니다.');
    const { input, button, submit } = handleInput({
      fail: lines => {
        tip.replaceChildren(...brLines(lines));
        tip.hidden = false;
        hint.style.visibility = 'hidden';
        input.setAttribute('aria-invalid', 'true');
      },
      clear: () => {
        tip.hidden = true;
        hint.style.visibility = '';
        input.removeAttribute('aria-invalid');
      },
      go: (home, room) => {
        if (!isCurrent(my)) return;
        clearHash();
        preloadFurniture([home]);
        enter('visit', home, my, room);
      },
    });
    input.setAttribute('aria-describedby', 'handle-tip');
    keySound(input);
    return h('form', { className: 'user by-handle', onsubmit: submit },
      h('span', { className: 'avatar' }, iconEl({ icon: 'builtin:neighbor', title: '이웃집' }, 32)),
      h('span', { className: 'user-name' }, '친구 아이디로 놀러 가기',
        h('span', { className: 'new-row' }, input, button, tip),
        hint));
  }

  // 로그인 화면 왼쪽 단의 글자 단추. 로그인 칸을 열거나 거기서 돌아온다
  const linkButton = (label, onclick) => h('button', { type: 'button', className: 'own-link', onclick }, label);

  // 내 사용자 아래의 작은 글자 단추들: 다른 아이디로 로그인, 새 사용자 만들기, 이 컴퓨터 초기화(비밀번호가 있고 서버에 방이 있으면 이 컴퓨터에서 지우기).
  // 다른 아이디로 로그인과 새 사용자 만들기는 내 사용자를 지우지 않고 다른 사용자로 보낸다(F37).
  // 이 컴퓨터 초기화: 저장된 집(계정)과 게임 최고 점수를 지운다. 이 컴퓨터의 설정(밤, 소리, 배경음악)은 남긴다(src/home-store.js의 wipeUser).
  // 새 계정 만들기와 친구 링크 구경을 다시 시험할 때 쓴다. 다른 사용자가 있으면(others) 이 컴퓨터의 것이 다 지워지지 않으므로 "이 컴퓨터에서 지우기"로 쓰고
  // 확인 줄에 누구의 것인지 적는다(known-issues 130). 지운 뒤에는 가장 최근에 쓴 다른 사용자가 내 사용자 칸에 선다.
  // 이 컴퓨터에서 지우기: 서버의 방을 남겨 두고 이 컴퓨터의 것만 지운다(F36, src/sign-in.js의 askTakeOut).
  // 되돌릴 수 없는 일이라 바로 지우지 않고, 지울 것을 보여 준 뒤 결과를 말하는 단추로 받는다(known-issues 32).
  // 초기화는 짧은 링크로 서버에 올린 방(src/cloud.js)도 같이 지운다. 서버가 늦으면 3초까지만 기다리고 이 컴퓨터의 것은 지운다.
  // 이웃집에 고정한 방(data/neighbors.js의 keep)을 올린 브라우저에서는 초기화를 내놓지 않고 이유만 보인다.
  // 서버의 방이 지워지면 그 이웃집이 복사본(넣은 때의 모습)으로 멈추고, 이 컴퓨터의 방도 사라지기 때문이다. 서버의 방을 남기는 이 컴퓨터에서 지우기는 막지 않는다.
  function ownLinks(openForm, openNew, own, others, my) {
    const box = h('div', { className: 'reset-box own-links' });
    const link = (label, onclick) => h('button', { type: 'button', className: 'reset-link', onclick }, label);
    const ask = (lines, yes) => box.replaceChildren(
      ...lines.map(text => h('p', {}, text)),
      h('div', { className: 'reset-row' }, yes, h('button', { type: 'button', className: 'btn', onclick: idle }, '그대로 두기')));
    const wipe = async e => {
      if (pinnedHere()) return showLogin(); // 확인 창을 띄워 둔 사이에 다른 탭에서 방이 고정되었을 수 있다
      e.currentTarget.disabled = true;
      hold(true); // 서버를 기다리는 사이에 다른 사용자로 들어가면 그 사용자를 지운다
      try {
        if (sharedId()) await Promise.race([unshare().catch(err => console.warn('서버의 방을 지우지 못했다', err)), wait(3000)]);
      } finally {
        hold(false);
      }
      if (staleLogin()) return; // 누르기 전이나 기다리는 사이에 다른 탭에서 사용자가 바뀌었다. 서버의 방은 unshare가 지우지 않는다(src/cloud.js의 queueMine)
      reseat();
      wipeUser();
      standUp();
      forgetSync();
      const next = promoteNext(); // 다른 사용자가 있으면 가장 최근에 쓴 사용자를 앉힌다
      if (next) reseated();
      if (!isCurrent(my)) return; // 기다리는 사이에 전원을 껐다. 다음에 켜면 지금 상태로 그린다
      showLogin();
      if (next) toast(`${own.owner}의 집을 이 컴퓨터에서 지웠습니다.`, 5000); // 내 사용자 칸이 다른 사용자로 바뀌었다
    };
    const linked = () => `링크의 방과 쪽지${myHandle() ? ', 아이디' : ''}`;
    const askReset = () => ask(others
      ? [`이 컴퓨터에 저장된 ${own.owner}의 집과 게임 기록을 지웁니다.`, sharedId() ? `${linked()}도 지웁니다. 되돌릴 수 없습니다.` : '되돌릴 수 없습니다.']
      : [sharedId() ? `이 컴퓨터의 집과 게임 기록, ${linked()}를 지웁니다. 되돌릴 수 없습니다.` : '이 컴퓨터에 저장된 집과 게임 기록을 지웁니다. 되돌릴 수 없습니다.'],
    h('button', { type: 'button', className: 'btn', onclick: wipe }, '지우기'));
    const last = () => {
      if (hasPassword() && sharedId()) return link('이 컴퓨터에서 지우기', () => signIn.askTakeOut(box, idle, my));
      if (pinnedHere()) return h('p', {}, `내 방이 이웃집에 고정되어 있어 ${others ? '지울' : '초기화할'} 수 없습니다.`);
      return link(others ? '이 컴퓨터에서 지우기' : '이 컴퓨터 초기화', askReset);
    };
    const idle = () => box.replaceChildren(link('다른 아이디로 로그인', openForm), link('새 사용자 만들기', openNew), last());
    idle();
    return box;
  }

  // 로그인 화면의 칸(닉네임, 친구 아이디, 로그인 칸)에 글자를 칠 때 한 글자마다 키보드 소리(사운드 정리표의 "ID 입력 사운드").
  // 누르고 있어 되풀이되는 키와 Enter, 조합 키는 빼고, 한글 입력 중(Process)도 소리를 낸다.
  const keySound = input => input.addEventListener('keydown', e => {
    if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || ['Backspace', 'Delete', 'Process'].includes(e.key))) play('key');
  });

  // 사용자 그림. picture(사진 값: 사진 id나 내 그림)가 있으면 사진을, 없으면 이름의 첫 글자를 보인다.
  // slot: 사진 자리(src/user-pictures.js). 내 사용자와 시작 메뉴는 48, 친구 집 격자의 칸은 tile이다
  const avatar = (name, picture = null, slot = 48) => (picture
    ? h('span', { className: 'avatar has-pic' }, pictureEl(picture, slot))
    : h('span', { className: 'avatar' }, [...name][0] || '?'));

  function userTile(name, sub, onPick, kind = '', picture = null) {
    return h('button', { type: 'button', className: kind ? `user ${kind}` : 'user', onclick: onPick },
      avatar(name, picture),
      h('span', { className: 'user-name' }, name, h('small', {}, sub)));
  }

  // 새 사용자 만들기. 닉네임 칸 위에 사진을 고르는 줄과 그림 파일 찾아보기가 있고, 왼쪽의 큰 그림이 고른 사진을 보여 준다.
  // 그림 파일을 고르면 픽셀 그림으로 줄인 내 그림이 큰 그림 자리에 뜨고, 확인을 누를 때 저장한다(src/custom-picture.js).
  // 아무 사진이나 하나를 미리 골라 두므로 사진을 고르지 않고 확인을 눌러도 된다. onCreate(닉네임, 사진 값)
  function newUserTile(onCreate) {
    let picture = randomPicture();
    const face = avatar('', picture);
    const picker = picturePicker(picture, v => {
      picture = v;
      face.replaceChildren(pictureEl(v, 48));
    }, toast);
    const input = h('input', { maxLength: 12, autocomplete: 'off', placeholder: '닉네임 (최대 12글자)', 'aria-label': '닉네임' });
    keySound(input);
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
        if (name) onCreate(name, picture);
        else {
          showTip(true);
          input.focus();
        }
      },
    },
    face,
    h('span', { className: 'user-name' }, '새 사용자 만들기',
      picker,
      h('span', { className: 'new-row' }, input, h('button', { type: 'submit', className: 'btn' }, '확인'), tip)));
    setTimeout(() => input.focus(), 50);
    return form;
  }

  const signIn = createSignIn({ os, ownHome, showLogin, staleLogin, enter, toast, clearHash, isCurrent, forgetSync, keySound, reseated, hold });

  return { ownHome, loginHomes, cloudHome, showLogin, avatar };
}
