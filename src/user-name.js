// 이름 바꾸기 창(F28). 시작 메뉴의 "이름 바꾸기" 줄과 맨 위의 내 이름(src/os.js의 openStartMenu), 사진 바꾸기 창의 이름 옆 단추(src/user-pictures.js)에서 열린다.
// 레퍼런스는 윈도우 XP 제어판 사용자 계정의 이름 변경이다. 새 이름을 적고 결과를 말하는 단추("이름 바꾸기", "취소")로 받는다.
// 이름은 집(os.home.owner)에 있어서 바꾸면 os.saveHome으로 저장하고, 짧은 링크를 만든 방이면 서버의 방도 따라 고친다(src/cloud.js의 syncLater).
// 검사는 새 사용자를 만들 때와 같다(src/share.js의 ownerName, 12글자).
// 예전 긴 링크(#r=)는 링크 글자에 이름이 담겨 있어서 이미 보낸 것은 바뀌지 않는다. 실명을 별명으로 바꾸려는 사람이 알아야 해서 창 안에 적는다.
// 튜토리얼 연습 방과 친구 집에서는 시작 메뉴에 이름 바꾸기 줄이 없고 사진과 이름이 단추가 아니라서 열리지 않는다. 연습을 시작하면 열린 창도 모두 닫힌다(known-issues 40).
import { ownerName } from './share.js';
import { sharedId, renameNick } from './cloud.js';
import { ownPicture, saveOwnPicture, pictureEl, shownSize } from './user-pictures.js';
import { h } from './util.js';

// 이름을 바꾼다. 이름이 나오는 곳은 대부분 열 때마다 os.home.owner를 새로 읽는다(로그인 화면, 시작 메뉴, 화면 보호기, 방 그림 PNG, 앱의 AGA.info).
// 연 채로 이름을 보이는 창은 win.refreshOwner로 다시 쓴다.
function rename(os, name) {
  const before = os.home.owner;
  // 사진을 고른 적 없는 사용자의 사진은 이름으로 정한다(ownPicture). 이름과 함께 사진까지 바뀌지 않게 지금 사진을 저장해 둔다
  saveOwnPicture(ownPicture(before));
  renameNick(before, name);
  os.home.owner = name;
  os.saveHome();
  for (const w of os.wm.all()) w.refreshOwner?.();
  os.toast('이름을 바꿨습니다.');
}

// 창 높이는 사진 바꾸기 창처럼 열 때의 사진 크기로 정한다. 사진과 이름 줄, 입력 칸, 도움말 두 줄, 단추 줄, 창 안쪽 여백을 더한 값이다
export function openNameWindow(os) {
  const owner = os.home.owner;
  const shared = !!sharedId();
  const win = os.wm.open({
    key: 'user-name',
    app: { title: '이름 바꾸기', color: '#b8577f' },
    title: '이름 바꾸기',
    width: 400,
    height: Math.ceil(shownSize(48) + (shared ? 176 : 150)),
    build(body) {
      body.classList.add('name-app');
      const input = h('input', { type: 'text', maxLength: 12, value: owner, placeholder: '최대 12글자', autocomplete: 'off' });
      input.spellcheck = false; // h()는 false 값을 건너뛰므로 따로 끈다
      const error = h('p', { className: 'like-error', role: 'alert', hidden: true }, '새 이름을 입력해 주세요.');
      input.addEventListener('input', () => { if (input.value.trim()) error.hidden = true; });
      const submit = e => {
        e.preventDefault();
        const name = ownerName(input.value);
        if (!name) {
          error.hidden = false;
          input.focus();
          return;
        }
        if (os.mode === 'edit' && !os.realHome && name !== os.home.owner) rename(os, name);
        win.close();
      };
      body.append(
        h('div', { className: 'pic-app-head' }, h('span', { className: 'avatar has-pic' }, pictureEl(ownPicture(owner), 48)), h('b', {}, owner)),
        h('form', { className: 'like-form', onsubmit: submit },
          h('label', { className: 'like-field' }, h('span', {}, '새 이름'), input),
          error,
          h('p', { className: 'meta' }, ...(shared ? ['링크로 오는 친구에게도 새 이름이 보입니다.', h('br')] : []), '전에 보낸 긴 링크에는 예전 이름이 남습니다.'),
          h('div', { className: 'link-row' },
            h('button', { type: 'submit', className: 'btn' }, '이름 바꾸기'),
            h('button', { type: 'button', className: 'btn', onclick: () => win.close() }, '취소'))),
      );
      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
    },
  });
  return win;
}
