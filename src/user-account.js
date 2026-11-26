// 아이디와 비밀번호 창(F36). 시작 메뉴의 "아이디와 비밀번호" 줄(src/os.js의 openStartMenu)과 공유하기 창의 "비밀번호 만들기"(src/apps/share-app.js)에서 열리고,
// 로그인이 풀렸으면 내 컴퓨터로 들어올 때 저절로 뜬다(src/os.js의 tellSignedOut). 서버에 묻는 일은 src/cloud.js의 "비밀번호"에 있다.
// 창은 지금 상태에 맞는 한 가지를 보인다(modeNow).
//   create   비밀번호가 없다. 아이디와 비밀번호를 정한다. 링크가 없으면 방 올리기, 아이디 정하기, 비밀번호 붙이기 차례로 하고,
//            남이 쓰는 아이디인지는 방을 올리기 전에 본다
//   change   비밀번호가 있다. 지금 비밀번호를 확인하고 바꾼다
//   publish  비밀번호는 있는데 링크나 아이디를 지웠다. 다른 브라우저에서 로그인할 수 없으므로 방을 다시 올리고 아이디를 정하는 길만 둔다
//   login    로그인이 풀렸다(다른 브라우저에서 비밀번호를 바꿈). 비밀번호만 묻는다
// 비밀번호는 앞뒤 공백을 자르지 않는다. 칸에서 요청으로만 가고 저장하지 않으며, 창을 닫으면 칸과 함께 사라진다.
// 아이디 칸은 바꿀 수 없을 때도 둔다. 브라우저의 비밀번호 저장이 어느 아이디의 비밀번호인지 알아본다(autocomplete).
// 튜토리얼 연습 방과 친구 집에서는 시작 메뉴에 이 줄이 없고, 그리로 갈 때 열린 창이 모두 닫힌다(known-issues 40).
import {
  sharedId, myHandle, hasPassword, signedOut, share, claimHandle, handleFree, linkPassword, changePassword, logBackIn,
  normalHandle, handleFrom, HANDLE_RE, MIN_PASSWORD, MAX_CODE, CloudError,
} from './cloud.js';
import { ownPicture, pictureEl, shownSize } from './user-pictures.js';
import { brLines } from './neighbors.js';
import { STORAGE_NEWS } from './config.js';
import { h, loadJSON, saveJSON } from './util.js';

const APP = { title: '아이디와 비밀번호', icon: 'builtin:key' };

const modeNow = () => {
  if (signedOut()) return 'login';
  if (!hasPassword()) return 'create';
  return sharedId() && myHandle() ? 'change' : 'publish';
};

// auto: 저절로 띄웠는지. 저절로 뜬 창은 글자 칸에 초점을 두지 않는다(쓰던 글이 비밀번호 칸으로 들어가지 않게)
export function openAccountWindow(os, { auto = false } = {}) {
  const win = os.wm.open({
    key: 'user-account',
    app: APP,
    title: APP.title,
    width: 416,
    height: Math.ceil(shownSize(48) + 260), // 여는 순간의 높이. 바로 내용에 맞춘다(fit)
    build(body, w) {
      body.classList.add('account-app');
      const face = h('span', { className: 'avatar has-pic' });
      const name = h('b', {});
      const part = h('div', {}); // 모드마다 바뀌는 자리
      body.append(h('div', { className: 'pic-app-head' }, face, name), part);
      // 창을 연 채 이름이나 방이 바뀌면 이름과 사진을 다시 쓴다(src/user-name.js)
      w.refreshOwner = () => {
        face.replaceChildren(pictureEl(ownPicture(os.home.owner), 48));
        name.textContent = os.home.owner;
      };
      w.refreshOwner();
      // 창 높이를 내용에 맞춘다. 사진 크기가 무대 배율마다 다르고 모드와 오류에 따라 줄 수가 바뀐다
      const fit = () => {
        if (w.maximized || w.minimized) return;
        w.el.style.height = 'auto';
        w.el.style.height = `${w.el.offsetHeight}px`;
      };

      let mode = null;
      // 지금 상태에 맞는 모드로 그린다. 같은 모드면 치던 글자를 두고, 정해진 아이디만 맞춘다
      w.refreshAccount = (focus = true) => {
        const now = modeNow();
        if (now === mode) return settleId();
        mode = now;
        w.setTitle(mode === 'login' ? '다시 로그인' : APP.title);
        part.replaceChildren(MODES[mode]());
        fit();
        if (focus) setTimeout(() => part.querySelector('input:not([readonly])')?.focus(), 50);
      };

      // ---------- 칸 ----------
      const input = (type, autocomplete, placeholder = '') => {
        const el = h('input', { type, name: type === 'password' ? autocomplete : 'username', autocomplete, placeholder, autocapitalize: 'none' });
        el.spellcheck = false; // h()는 false 값을 건너뛰므로 따로 끈다(known-issues 50)
        el.addEventListener('input', () => hideError());
        return el;
      };
      const field = (label, el) => h('label', { className: 'like-field' }, h('span', {}, label), el);
      const error = h('p', { className: 'like-error', role: 'alert', hidden: true });
      const hideError = () => {
        if (error.hidden) return;
        error.hidden = true;
        fit();
      };
      // 오류. 일어난 일과 할 일을 한 줄씩 쓰고 고칠 칸에 초점을 둔다
      const fail = (lines, at) => {
        error.replaceChildren(...brLines(lines));
        error.hidden = false;
        fit();
        at?.focus();
      };
      // 아이디 칸. 정한 아이디가 있으면 그것을 읽기 전용으로, 없으면 닉네임에서 쓸 수 있는 글자를 미리 넣는다
      let idInput = null;
      let savedNote = null;
      const idField = () => {
        idInput = input('text', 'username', '한글, 영문, 숫자 2~12자');
        idInput.maxLength = 24;
        idInput.value = myHandle() || handleFrom(os.home.owner);
        settleId();
        return field('아이디', idInput);
      };
      const settleId = () => {
        const handle = myHandle();
        if (!idInput) return;
        idInput.readOnly = !!handle;
        if (handle) idInput.value = handle;
        savedNote?.replaceChildren(...brLines(createNotes()));
      };
      // 만들기의 안내. 방이 서버에 저장된다는 줄은 링크가 아직 없을 때만 보인다
      const createNotes = () => [
        '다른 브라우저에서도 로그인해 이 방을 고칠 수 있습니다.',
        '비밀번호를 잊으면 되찾을 수 없습니다.',
        '다른 곳에서 쓰지 않는 비밀번호로 정해 주세요.',
        ...(sharedId() ? [] : ['만들면 방이 Firebase(구글) 서버에 저장됩니다.']),
      ];
      const row = (label, later = '취소') => h('div', { className: 'link-row' },
        h('button', { type: 'submit', className: 'btn' }, label),
        h('button', { type: 'button', className: 'btn', onclick: () => w.close() }, later));
      const meta = (...lines) => h('p', { className: 'meta' }, ...brLines(lines));
      // 양식 하나. work()가 오류(글 줄들과 칸)를 알리지 않고 끝나면 창을 닫고 done을 알린다. 하는 동안 단추를 잠근다
      let running = false;
      const form = (busy, work, done, ...parts) => h('form', {
        className: 'like-form',
        onsubmit: async e => {
          e.preventDefault();
          if (running) return;
          const b = e.currentTarget.querySelector('button[type="submit"]');
          const label = b.textContent;
          const lockUp = () => {
            running = true;
            hideError();
            b.style.minWidth = `${b.offsetWidth}px`;
            b.disabled = true;
            b.textContent = busy;
          };
          const unlock = () => {
            running = false;
            b.style.minWidth = '';
            b.disabled = false;
            b.textContent = label;
          };
          try {
            const ok = await work(lockUp);
            if (!ok) return;
            w.close();
            done();
          } catch (err) {
            explain(err);
          } finally {
            unlock();
            refreshShare(os);
          }
        },
      }, ...parts);

      // 아이디가 쓸 수 있는 꼴인지 본다. 아니면 알리고 빈 글자를 돌려준다
      const readId = () => {
        const handle = myHandle() || normalHandle(idInput.value);
        if (!handle) fail(['아이디를 입력해 주세요.'], idInput);
        else if (!HANDLE_RE.test(handle)) fail(['아이디는 한글, 영문, 숫자 2~12자입니다.', '다시 입력해 주세요.'], idInput);
        else return handle;
        return '';
      };
      // 새 비밀번호와 확인 칸을 본다
      const newOk = (first, second) => {
        if (!first.value) fail(['비밀번호를 입력해 주세요.'], first);
        else if (first.value.length < MIN_PASSWORD) fail([`비밀번호는 ${MIN_PASSWORD}자 이상으로 입력해 주세요.`], first);
        else if (!second.value) fail(['비밀번호 확인을 입력해 주세요.'], second);
        else if (first.value !== second.value) fail(['비밀번호가 일치하지 않습니다.', '다시 입력해 주세요.'], second);
        else return true;
        return false;
      };

      // 서버 일이 실패한 까닭을 알린다. 방 번호를 잊은 것과 사용자가 바뀐 것은 따로 알리고, 로그인이 풀렸으면 다시 로그인하는 모드로 바뀐다
      const FAILED = {
        create: ['비밀번호를 만들지 못했습니다.', '잠시 후 다시 시도해 주세요.'],
        change: ['비밀번호를 바꾸지 못했습니다.', '잠시 후 다시 시도해 주세요.'],
        publish: ['아이디를 정하지 못했습니다.', '잠시 후 다시 시도해 주세요.'],
        login: ['로그인하지 못했습니다.', '잠시 후 다시 시도해 주세요.'],
      };
      const explain = err => {
        if (!body.isConnected) return;
        const was = mode;
        w.refreshAccount();
        if (mode !== was || err.reason === 'moved' || err.reason === 'lost') return;
        const pass = part.querySelector('input[type="password"]');
        if (err.reason === 'taken') return fail(['이미 사용 중인 아이디입니다.', '다른 아이디를 입력해 주세요.'], idInput);
        if (err.reason === 'wrong') return fail([mode === 'change' ? '지금 비밀번호가 맞지 않습니다.' : '비밀번호가 맞지 않습니다.', '다시 확인해 주세요.'], pass);
        if (err.reason === 'locked' || err.code === 'TOO_MANY_ATTEMPTS_TRY_LATER') return fail(['비밀번호를 여러 번 잘못 입력했습니다.', '잠시 후 다시 시도해 주세요.'], pass);
        if (err.code === 'WEAK_PASSWORD' || err.code === 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS') return fail(['쓸 수 없는 비밀번호입니다.', '다른 비밀번호를 입력해 주세요.'], part.querySelector('input[autocomplete="new-password"]'));
        if (err.reason === 'unsure') return fail(['비밀번호가 바뀌었는지 확인하지 못했습니다.', '잠시 후 다시 시도해 주세요.'], pass);
        if (err.reason === 'denied' && os.roomCode(os.home).length > MAX_CODE) return fail(['방에 쓴 글이 너무 길어 서버에 올리지 못했습니다.', '글을 줄인 뒤 다시 시도해 주세요.']);
        console.warn('아이디와 비밀번호 창의 일을 하지 못했다', err);
        fail(FAILED[mode]);
      };

      // 방을 올리고(링크가 없으면) 아이디를 정한다. 남이 쓰는 아이디면 방을 올리지 않는다
      const publish = async handle => {
        if (!sharedId()) {
          if (!await handleFree(handle)) throw new CloudError('taken', handle);
          await share(os.roomCode(os.home));
        }
        if (myHandle() !== handle) await claimHandle(handle);
      };
      const inMyRoom = () => os.mode === 'edit' && !os.realHome; // 튜토리얼 연습 방의 집을 올리지 않는다(known-issues 40)

      // ---------- 모드 ----------
      const MODES = {
        create() {
          const first = input('password', 'new-password', `${MIN_PASSWORD}자 이상`);
          const second = input('password', 'new-password');
          const id = idField();
          const work = async start => {
            const handle = readId();
            if (!handle || !newOk(first, second) || !inMyRoom()) return false;
            start();
            await publish(handle);
            await linkPassword(first.value);
            return true;
          };
          return form('만드는 중', work, () => os.toast('비밀번호를 만들었습니다. 다른 브라우저에서도 로그인해 보세요.', 6000),
            id, field('비밀번호', first), field('비밀번호 확인', second), error,
            savedNote = meta(...createNotes()),
            row('비밀번호 만들기'));
        },
        change() {
          const now = input('password', 'current-password');
          const first = input('password', 'new-password', `${MIN_PASSWORD}자 이상`);
          const second = input('password', 'new-password');
          const work = async start => {
            if (!now.value) {
              fail(['지금 비밀번호를 입력해 주세요.'], now);
              return false;
            }
            if (!newOk(first, second) || !inMyRoom()) return false;
            start();
            await changePassword(now.value, first.value);
            return true;
          };
          return form('바꾸는 중', work, () => os.toast('비밀번호를 바꿨습니다.', 4000),
            idField(), field('지금 비밀번호', now), field('새 비밀번호', first), field('비밀번호 확인', second), error,
            meta('바꾸면 다른 브라우저에서는 다시 로그인해야 합니다.', '비밀번호를 잊으면 되찾을 수 없습니다.'),
            row('비밀번호 바꾸기'));
        },
        publish() {
          const shared = !!sharedId();
          const work = async start => {
            const handle = readId();
            if (!handle || !inMyRoom()) return false;
            start();
            await publish(handle);
            return true;
          };
          const lines = shared
            ? ['아이디가 없으면 다른 브라우저에서 로그인할 수 없습니다.', '아이디를 정하면 같은 비밀번호로 로그인합니다.']
            : ['링크가 없으면 다른 브라우저에서 로그인할 수 없습니다.', '아이디를 정하면 같은 비밀번호로 로그인합니다.', '방은 Firebase(구글) 서버에 저장됩니다.'];
          return form('정하는 중', work, () => os.toast('아이디를 정했습니다.', 4000),
            idField(), error, meta(...lines),
            row(shared ? '아이디 정하기' : '방 올리고 아이디 정하기'));
        },
        login() {
          const password = input('password', 'current-password');
          const work = async start => {
            if (!password.value) {
              fail(['비밀번호를 입력해 주세요.'], password);
              return false;
            }
            start();
            await logBackIn(password.value);
            return true;
          };
          return form('로그인 중', work, () => {
            os.toast('다시 로그인했습니다.', 4000);
            os.syncAgain();
          },
          h('p', {}, '로그인이 풀렸습니다. 다시 로그인해 주세요.'),
          myHandle() ? idField() : null, field('비밀번호', password), error,
          meta('로그인하기 전에 고친 방은 이 컴퓨터에만 저장됩니다.'),
          row('로그인', '나중에'));
        },
      };
    },
  });
  win.refreshAccount(!auto);
  return win;
}

// 공유하기 창이 열려 있으면 링크와 아이디, 비밀번호 줄을 지금 상태로 맞춘다
const refreshShare = os => os.wm.get('share')?.refreshLink?.();

// 새 기능 안내. 아이디와 비밀번호가 생기기 전부터 있던 사용자에게 내 컴퓨터로 들어올 때 한 번 띄운다(src/os.js의 tellNews).
// 비밀번호를 이미 만들었거나 로그인이 풀린 사용자(다시 로그인 창이 뜬다)에게는 띄우지 않는다.
// 새 사용자는 튜토리얼 끝 카드가 같은 것을 알리므로 만들 때 본 것으로 둔다(src/login.js의 showNew). 창을 어떻게 닫든 본 것으로 둔다.
// 같이 쓰는 컴퓨터의 줄은 로그아웃만으로는 이 컴퓨터에 사용자가 남는다는 것을 알린다(로그인 화면에서 비밀번호 없이 들어갈 수 있다)
const NEWS = 'login';
export const newsDue = () => !hasPassword() && !signedOut() && loadJSON(STORAGE_NEWS) !== NEWS;
export const markNews = () => saveJSON(STORAGE_NEWS, NEWS);

// 메뉴와 단추 이름. 윈도우 도움말처럼 굵게 쓰고, 이름 가운데나 뒤의 조사 앞에서 줄이 꺾이지 않게 한 묶음으로 둔다
const named = (name, tail) => h('span', { style: { whiteSpace: 'nowrap' } }, h('b', {}, name), tail);

export function openLoginNews(os) {
  return os.wm.open({
    key: 'login-news',
    app: APP,
    title: '새 기능 안내',
    width: 470,
    height: 190, // 여는 순간의 높이. 바로 내용에 맞춘다
    onClose: markNews,
    build(body, win) {
      body.append(
        h('p', {}, '아이디와 비밀번호로 로그인하는 기능이 추가되었습니다.'),
        h('ol', { className: 'news-steps' },
          h('li', {}, '시작 메뉴의 ', named('아이디와 비밀번호', '에서'), ' 비밀번호를 만드세요.'),
          h('li', {}, '다른 브라우저의 로그인 화면에서 ', named('내 아이디로 로그인', '을'), ' 누르세요.'),
          h('li', {}, '같이 쓰는 컴퓨터라면 다 쓴 뒤 ', named('로그아웃', '하고'), ' ', named('이 컴퓨터에서 지우기', '를'), ' 누르세요.')),
        h('div', { className: 'link-row' },
          h('button', { type: 'button', className: 'btn', onclick: () => { win.close(); openAccountWindow(os); } }, '비밀번호 만들기'),
          h('button', { type: 'button', className: 'btn', onclick: () => win.close() }, '닫기')),
      );
      win.el.style.height = 'auto';
      win.el.style.height = `${win.el.offsetHeight}px`;
    },
  });
}
