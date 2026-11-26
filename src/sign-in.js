// 로그인 화면 왼쪽 단의 로그인 칸과 이 컴퓨터에서 지우기(F36). 로그인 화면(src/login.js)이 쓴다. 계정과 서버에 묻는 일은 src/cloud.js의 "비밀번호"에 있다.
//   로그인   아이디와 비밀번호로 계정과 방을 모두 받은 다음에 이 브라우저의 것을 한꺼번에 바꾼다. 중간에 실패하면 하나도 바꾸지 않는다
//   지우기   서버의 방을 남겨 두고 이 컴퓨터의 것만 지운다. 다시 로그인하면 이어진다. 같이 쓰는 컴퓨터에서 쓴다
// 이 컴퓨터에 다른 사용자가 있으면 비밀번호가 맞은 다음에 무엇이 지워지는지 보이고 결과를 말하는 단추로 받는다(known-issues 32).
//   비밀번호가 있고 서버에 방이 있는 사용자   이 컴퓨터에서 지우기와 같은 검사를 하고 지운다
//   그 밖의 사용자                          이 컴퓨터의 집이 하나뿐이라 지워진다고 알린다. 이웃집에 고정한 방이면 막는다(pinnedHere)
// 같은 사용자의 로그인은 다시 로그인이다. 아무것도 지우지 않고, 올리지 못한 고침은 들어갈 때 서버의 방과 맞춘다(src/home-sync.js).
// 비밀번호는 칸에서 요청으로만 가고 어디에도 남기지 않는다. 브라우저의 비밀번호 저장이 돌게 칸에 autocomplete를 단다.
import { decodeHome } from './share.js';
import {
  logIn, adoptLogin, rejoin, standUp, canReturn, forgetRemoved, hasPassword, sharedId, sentCode, myUid, normalHandle,
  syncNow, pauseSync, MAX_CODE,
} from './cloud.js';
import { sameCode } from './room-merge.js';
import { reseat } from './seat.js';
import { unpackHome, keepBest, usePet, wipeUser, dropPicture } from './home-store.js';
import { pinnedHere, brLines } from './neighbors.js';
import { keyPicture } from './user-pictures.js';
import { h } from './util.js';

const WRONG = ['아이디나 비밀번호가 맞지 않습니다.', '다시 확인해 주세요.'];
const LOCKED = ['비밀번호를 여러 번 잘못 입력했습니다.', '잠시 후 다시 시도해 주세요.'];
const NO_ROOM = ['방을 불러오지 못했습니다.', '잠시 후 다시 시도해 주세요.'];
const FAILED = ['로그인하지 못했습니다.', '잠시 후 다시 시도해 주세요.'];

// 이 컴퓨터에서 지우거나 지우고 로그인하기 전에 보이는 것(비밀번호가 있는 사용자). 서버에 담기지 않아 돌아오지 않는 것도 적는다
const OUT_LINES = [
  '서버의 방은 그대로이고, 다시 로그인하면 이어집니다.',
  '최근에 놀러 간 집과 푼 시험지, 파일 정리 10의 다 정리 횟수는 돌아오지 않습니다.',
];

// 넘겨받는 것은 로그인 화면(src/login.js의 createLogin)의 것이다.
// staleLogin(): 다른 탭에서 사용자가 바뀌었으면 로그인 화면을 다시 그리고 참을 돌려준다. forgetSync(): 서버의 방과 맞추던 일 버리기. keySound(칸): 글자를 칠 때의 소리
export function createSignIn({ os, ownHome, showLogin, staleLogin, enter, toast, clearHash, isCurrent, forgetSync, keySound }) {
  const button = (label, onclick, type = 'button') => h('button', { type, className: 'btn', onclick }, label);
  // 기다리는 동안 단추를 잠그고 하는 일을 보인다. 폭은 그대로 둔다
  const lock = (b, text) => {
    const label = b.textContent;
    b.style.minWidth = `${b.offsetWidth}px`;
    b.disabled = true;
    b.textContent = text;
    return () => {
      b.style.minWidth = '';
      b.disabled = false;
      b.textContent = label;
    };
  };

  // 로그인 칸. 오류는 새 사용자 만들기의 닉네임 칸처럼 칸을 빨갛게 두르고 노란 풍선으로 띄운다. 빈 아이디는 아이디 칸 아래에, 나머지는 비밀번호 칸 아래에 띄운다.
  // 풍선이 떠 있는 동안 칸 아래 안내는 자리만 남기고 감춘다(높이가 바뀌면 가운데로 맞춘 단이 움직인다).
  // my: 로그인 화면의 실행 번호. box: 왼쪽 단(확인을 물을 자리). title: 칸의 제목
  function form({ my, box, title }) {
    const id = h('input', { type: 'text', name: 'username', maxLength: 24, placeholder: '아이디', 'aria-label': '아이디', autocomplete: 'username', autocapitalize: 'none' });
    id.spellcheck = false; // h()는 false 값을 건너뛰므로 따로 끈다(known-issues 50)
    const password = h('input', { type: 'password', name: 'password', placeholder: '비밀번호', 'aria-label': '비밀번호', autocomplete: 'current-password' });
    const send = button('로그인', null, 'submit');
    const tip = h('p', { className: 'name-tip', id: 'sign-in-tip', role: 'alert', hidden: true });
    const hint = h('small', {}, '비밀번호는 시작 메뉴에서 만듭니다.');
    const idRow = h('span', { className: 'new-row' }, id);
    const passwordRow = h('span', { className: 'new-row' }, password, send);
    const clear = () => {
      tip.hidden = true;
      hint.style.visibility = '';
      for (const input of [id, password]) input.removeAttribute('aria-invalid');
    };
    const fail = (lines, ...fields) => {
      clear();
      (fields.includes(password) ? passwordRow : idRow).append(tip);
      tip.replaceChildren(...brLines(lines));
      tip.hidden = false;
      hint.style.visibility = 'hidden';
      for (const input of fields) input.setAttribute('aria-invalid', 'true');
      fields.at(-1).focus();
      fields.at(-1).select();
    };
    for (const input of [id, password]) {
      input.setAttribute('aria-describedby', 'sign-in-tip');
      input.addEventListener('input', clear);
      keySound(input);
    }
    const submit = async e => {
      e.preventDefault();
      if (send.disabled) return;
      const handle = normalHandle(id.value);
      if (!handle) return fail(['아이디를 입력해 주세요.'], id);
      if (!password.value) return fail(['비밀번호를 입력해 주세요.'], password);
      clear();
      const unlock = lock(send, '로그인 중');
      let got = null;
      let home = null;
      try {
        got = await logIn(handle, password.value);
        home = decodeHome(got.code);
      } catch (err) {
        unlock();
        if (err.reason === 'wrong') return fail(WRONG, id, password);
        if (err.reason === 'locked') return fail(LOCKED, password);
        console.warn('로그인하지 못했다', err);
        return fail(err.reason === 'noroom' ? NO_ROOM : FAILED, password);
      }
      unlock();
      if (!isCurrent(my) || !el.isConnected || staleLogin()) return;
      if (!home?.owner) return fail(NO_ROOM, password); // 풀 수 없는 방(새 형식을 모르는 예전 페이지 등)
      decide({ got, home, my, box });
    };
    const el = h('form', { className: 'user new sign-in', onsubmit: submit },
      h('span', { className: 'avatar has-pic' }, keyPicture()),
      h('span', { className: 'user-name' }, title, idRow, passwordRow, hint));
    setTimeout(() => id.focus(), 50);
    return el;
  }

  // 로그인이 되었다. 이 컴퓨터에 있는 사용자에 따라 바로 바꾸거나, 무엇이 지워지는지 먼저 보인다
  function decide(job) {
    const own = ownHome();
    if (job.got.me.uid === myUid()) return own ? back(job, own) : settle(job); // 같은 사용자다. 집만 사라진 브라우저면 서버의 방을 푼다
    if (!own && (!sharedId() || hasPassword())) return settle(job); // 지워질 것이 없다
    if (own && hasPassword() && sharedId()) {
      return ask(job.box, [`이 컴퓨터에서 ${own.owner}의 집을 지웁니다.`, ...OUT_LINES], '지우고 로그인', '지우는 중', showLogin, async () => {
        const why = await blocked();
        if (!isCurrent(job.my) || staleLogin()) return null;
        return why || settle(job);
      });
    }
    if (pinnedHere()) return ask(job.box, ['내 방이 이웃집에 고정되어 있어 지울 수 없습니다.', '먼저 시작 메뉴에서 비밀번호를 만들어 주세요.'], null, null, showLogin);
    const KEEPS = '링크의 방은 서버에 남지만 더는 고칠 수 없습니다.';
    const lines = !own ? [`이 컴퓨터에서 만든 ${KEEPS}`, '되돌릴 수 없습니다.'] // 집은 없고 올린 기록만 남았다
      : [`이 컴퓨터에 저장된 ${own.owner}의 집과 게임 기록을 지웁니다. 되돌릴 수 없습니다.`,
        ...(sharedId() ? [KEEPS, '계속 고치려면 먼저 시작 메뉴에서 비밀번호를 만들어 주세요.'] : [])];
    return ask(job.box, lines, '지우고 로그인', '로그인 중', showLogin, () => {
      if (!isCurrent(job.my) || staleLogin()) return null;
      if (pinnedHere()) return showLogin(); // 물어보는 사이에 다른 탭에서 방이 고정되었을 수 있다
      return settle(job);
    });
  }

  // 확인. lines를 한 줄씩 보이고 yes(없으면 막힌 것이라 그대로 두기만)와 그대로 두기를 둔다. keep: 그대로 두기를 눌렀을 때 할 일
  // run이 안 된 까닭(줄들)을 돌려주면 그 줄들로 바꾸고 다시 누를 수 있게 한다. 되었으면 null이다. busy: 하는 동안 단추에 보일 글
  function ask(box, lines, yes, busy, keep, run) {
    const text = h('div', { className: 'ask-lines' });
    const say = list => text.replaceChildren(...list.map(line => h('p', {}, line)));
    say(lines);
    const go = async e => {
      const unlock = lock(e.currentTarget, busy);
      const why = await run();
      unlock();
      if (why && text.isConnected) say(why);
    };
    const part = h('div', { className: 'reset-box' }, text,
      h('div', { className: 'reset-row' }, yes ? button(yes, go) : null, button('그대로 두기', keep)));
    box.replaceChildren(part);
  }

  // 이 컴퓨터의 사용자를 지우면 안 되는 까닭과 할 일(한 줄씩). 지워도 되면 null이다.
  // 올리지 못한 고침이 있으면 먼저 올리고, 다시 로그인해 이어 갈 수 있게 서버에 방과 아이디가 있는지 본다
  async function blocked() {
    const CHANGED = ['다른 브라우저에서도 이 방을 고쳤습니다.', '내 컴퓨터로 들어가 남길 방을 골라 주세요.'];
    const code = os.roomCode(ownHome());
    try {
      if (!sameCode(code, sentCode())) {
        if (code.length > MAX_CODE) return ['방에 쓴 글이 너무 길어 서버에 올리지 못했습니다.', '내 컴퓨터로 들어가 글을 줄여 주세요.'];
        pauseSync(false); // 고르지 않고 닫아 멈춰 둔 올리기. 서버의 방이 다르면 판에 걸려 올라가지 않는다(src/cloud.js)
        await syncNow(() => code);
        if (!sameCode(code, sentCode())) return CHANGED;
      }
      const why = await canReturn();
      if (why === 'handle') return ['아이디가 없으면 다시 로그인할 수 없습니다.', '내 컴퓨터로 들어가 시작 메뉴의 아이디와 비밀번호에서 아이디를 정해 주세요.'];
      if (why !== 'room') return null;
      forgetRemoved();
      return gone('다른 브라우저에서 링크를 지워 서버에 방이 없습니다.');
    } catch (err) {
      if (err.reason === 'changed') return CHANGED;
      if (err.reason === 'signedout') return ['로그인이 풀려 고친 방을 올리지 못했습니다.', '내 컴퓨터로 들어가 다시 로그인해 주세요.'];
      if (err.reason === 'removed') return gone('다른 브라우저에서 링크를 지워 서버에 방이 없습니다.');
      if (err.reason === 'lost' || err.reason === 'denied') return gone('서버의 방을 고칠 수 없어 지우지 않았습니다.');
      console.warn('서버의 방을 확인하지 못했다', err);
      return ['서버에 연결하지 못했습니다.', '잠시 후 다시 시도해 주세요.'];
    }
  }
  // 서버에 방이 없다는 것을 이제 알았다. 지우면 이 컴퓨터의 방까지 사라지므로 지우지 않고, 로그인 화면을 지금 상태로 다시 그린 뒤 알린다
  function gone(text) {
    showLogin();
    toast(text, 7000);
    return [text];
  }

  // 이 컴퓨터에서 지우기. box는 글자 단추들이 있던 자리이고, idle은 그 단추들로 돌아가는 함수다
  function askTakeOut(box, idle) {
    ask(box, [`이 컴퓨터에서 ${ownHome()?.owner}의 집을 지웁니다.`, ...OUT_LINES], '지우기', '지우는 중', idle, async () => {
      if (staleLogin()) return null;
      const why = await blocked();
      if (!box.isConnected || staleLogin()) return null; // 기다리는 사이에 내 컴퓨터로 들어갔거나 다른 탭에서 사용자가 바뀌었다
      if (why) return why;
      const name = ownHome()?.owner || '';
      reseat();
      wipeUser();
      standUp();
      usePet(null);
      forgetSync();
      showLogin();
      toast(`${name}의 집을 이 컴퓨터에서 지웠습니다.`, 5000);
      return null;
    });
  }

  // 받은 계정과 방으로 이 브라우저를 한꺼번에 바꾸고 내 컴퓨터로 들어간다. 다른 사용자가 있었으면 그 사용자의 것을 먼저 지운다(기록과 펫이 섞이지 않게).
  // 사용자가 없었으면 남은 게임 기록과는 큰 쪽을 남긴다
  function settle({ got, home: full, my, box }) {
    const had = !!ownHome();
    reseat(); // 다른 탭이 앞 사용자의 집을 저장하지 못하게 가장 먼저 남긴다
    if (had) wipeUser();
    dropPicture();
    const home = unpackHome(full);
    keepBest(full.records);
    adoptLogin(got);
    usePet(full.pet);
    os.tutorial.disarm();
    start(home, my, box);
    return null;
  }

  // 같은 사용자의 다시 로그인. 이 컴퓨터의 방은 그대로 두고 로그인만 잇는다
  function back({ got, my, box }, own) {
    rejoin(got);
    start(own, my, box);
  }

  // 내 컴퓨터로 들어간다. 로그인 칸은 화면에서 뺀다. 비밀번호가 칸에 남지 않고, 브라우저도 로그인이 된 것을 알고 비밀번호 저장을 묻는다
  function start(home, my, box) {
    box.replaceChildren();
    forgetSync();
    clearHash();
    enter('edit', home, my);
  }

  return { form, askTakeOut };
}
