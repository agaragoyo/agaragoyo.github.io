// 기본 앱: 공유하기. 내 방을 구경할 수 있는 링크를 만들어 복사하거나, 방 그림을 PNG 파일로 내려받는다.
// 링크는 짧은 링크(#s=번호) 하나다. 방은 서버(Firebase, src/cloud.js)에 두고 링크에는 번호만 담는다.
// 링크는 주인이 "링크 만들기"를 누를 때 처음 만든다(방이 서버에 저장된다는 것을 누르기 전에 보여 준다, known-issues 32).
// 그 뒤에는 방을 고칠 때마다 서버의 방도 따라 고치므로(os.saveHome) 같은 링크가 늘 지금 방을 보여 준다.
// 방을 통째로 주소에 담던 긴 링크(#r=)는 2026-11-14에 이 창에서 뺐다. 이미 보낸 긴 링크는 로그인 화면이 그대로 연다(src/share.js).
// 링크를 만든 뒤에는 방에 아이디를 달 수 있다. 친구는 이웃집 목록 창에서 아이디를 쳐서 링크 없이 찾아온다(src/cloud.js의 "아이디", src/neighbors.js).
// 내려받기는 누르기 전에 결과를 알 수 있게 단추 이름이 "무엇을 PNG로 내려받기"인 것으로 둔다(known-issues 32).
import { SCENES } from '../config.js';
import { encodeHome } from '../share.js';
import { withPicture } from '../user-pictures.js';
import { withRecords } from '../records.js';
import { sharedId, share, unshare, syncNow, myHandle, claimHandle, dropHandle, normalHandle, handleFrom, HANDLE_RE, markLostTold } from '../cloud.js';
import { pinnedHere } from '../neighbors.js';
import { line } from '../likes.js';
import { renderRoomImage, IMAGE_W, IMAGE_H } from '../room-image.js';
import { h } from '../util.js';

// 줄 끝에서 끊기면 어색한 짧은 묶음("구경할 수 / 있습니다" 같은 것). 창 폭이 고정이라 줄 끝은 화면 크기와 상관없이 같다.
const nw = text => h('span', { style: { whiteSpace: 'nowrap' } }, text);

// 브라우저의 기본 다운로드로 저장한다. 저장 창을 따로 띄우지 않는다.
function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// 이 컴퓨터가 올린 방을 더는 고칠 수 없게 되어 번호를 잊었을 때(src/cloud.js의 forget) 주인에게 알리는 창. src/os.js의 tellLost가 띄운다.
// 예전 링크는 마지막으로 올린 방을 그대로 보여 주므로, 이제 안 되는 일과 할 일만 적는다. 아이디도 옛 방을 가리킨 채 남아 다시 정해야 한다.
// 어느 단추로 닫든 onClose에서 봤다고 남겨 다시 띄우지 않는다.
export function openLinkLost(os, app, lost) {
  return os.wm.open({
    key: 'link-lost',
    app,
    title: '공유 링크 끊김',
    width: lost.handle ? 460 : 380, // 두 문장이 한 줄씩 들어가는 폭
    height: 140,
    onClose: markLostTold,
    build(body, win) {
      body.append(
        h('p', {}, lost.handle ? '예전 링크와 아이디로는 고친 방을 ' : '예전 링크로는 고친 방을 ', nw('볼 수 없습니다.')),
        h('p', {}, lost.handle ? '공유하기에서 링크와 아이디를 새로 만들어 ' : '공유하기에서 새 링크를 만들어 ', nw('보내 주세요.')),
        h('div', { className: 'link-row' },
          h('button', { type: 'button', className: 'btn', onclick: () => { win.close(); os.openApp(app.id); } }, '공유하기 열기'),
          h('button', { type: 'button', className: 'btn', onclick: () => win.close() }, '닫기')),
      );
    },
  });
}

export function openShareApp(os, app) {
  const home = () => os.realHome || os.home; // 튜토리얼 연습 방은 공유하지 않는다(known-issues 40)
  const code = () => encodeHome(withRecords(withPicture(home()))); // 서버에 올리는 방 글자. 내 사진(F25, 그림 파일로 만든 사진은 F26)과 미니게임 최고 기록(F34)도 담는다
  const link = id => `${location.origin}${location.pathname}#s=${id}`;
  const button = (label, onclick, title) => h('button', { type: 'button', className: 'btn', onclick, title }, label);
  const win = os.wm.open({
    key: app.id,
    app,
    title: '공유하기',
    width: 540,
    height: 530, // 링크와 아이디 줄이 있을 때 맨 아래 단추 밑에 30px쯤 남고, 아이디 칸 아래에 오류가 한 줄 떠도 스크롤되지 않는다(known-issues 73)

    build(body, w) {
      const intro = h('p', {});
      const input = h('input', { type: 'text', readOnly: true, 'aria-label': '공유 링크' });
      // 링크 줄은 링크를 만든 뒤에만 보인다. .share-row가 display: flex라서 hidden 대신 자리(linkSlot)에 넣고 뺀다(known-issues 10)
      const linkRow = h('div', { className: 'share-row' }, input, button('복사', () => {
        w.refreshLink(); // 다른 탭에서 링크를 지웠을 수 있다
        if (sharedId()) copy(input.value, '링크를 복사했습니다.');
      }));
      const linkSlot = h('div', {});
      // 화면 보호기 인사말(src/screensaver.js). 서버의 방에 같이 담겨 친구 화면의 화면 보호기에도 흘러간다. 연습 방에서는 고치지 않는다.
      const greet = h('input', {
        type: 'text', maxLength: 30, value: home().greeting || '', placeholder: `${home().owner}의 컴퓨터`,
        'aria-label': '화면 보호기 인사말', disabled: !!os.realHome,
      });
      greet.addEventListener('input', () => {
        os.home.greeting = line(greet.value, 30);
        os.saveHome(false); // 링크를 만들어 둔 방이면 서버의 방도 따라 고친다
      });
      // 창을 연 채 이름을 바꾸면(src/user-name.js) 인사말이 빈 칸에 보이는 "주인 이름의 컴퓨터"도 새 이름으로 바꾼다
      w.refreshOwner = () => { greet.placeholder = `${home().owner}의 컴퓨터`; };
      const cloudTip = h('p', { className: 'share-save-tip' });
      const cloudRow = h('div', { className: 'share-row' });

      // 클립보드에 바로 넣지 못하면 링크 칸에 넣고 골라 둔 뒤 브라우저의 복사 명령을 쓴다. 그것도 안 되면 골라 둔 채로 둔다.
      const copy = async (text, done) => {
        let ok = true;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          input.value = text;
          input.focus();
          input.select();
          ok = document.execCommand('copy');
        }
        if (ok) {
          os.toast(done);
          w.refreshLink();
        } else {
          os.toast('복사하지 못했습니다. 링크가 선택되어 있으니 Ctrl+C(맥은 Cmd+C)로 복사해 주세요.', 7000);
        }
      };

      // 서버 일이 실패한 것을 알린다. 방 번호를 잊은 것(lost)은 따로 뜨는 창(openLinkLost)이 알리므로 겹쳐 알리지 않는다.
      const failed = (err, text) => {
        console.warn(err);
        if (err.reason !== 'lost') os.toast(text, 7000);
      };

      // 링크 만들기: 방을 서버에 올리고 받은 번호로 링크 줄을 보인다. 처음에는 익명 로그인까지 해서 1초쯤 걸린다.
      // 서버가 막힌 날에는 링크 대신 방 그림을 보내는 길이 이 창 아래에 있어서 실패 알림에 같이 적는다.
      const create = async e => {
        const b = e.currentTarget;
        b.style.minWidth = `${b.offsetWidth}px`;
        b.disabled = true;
        b.textContent = '링크를 만드는 중';
        try {
          await share(code());
          os.toast('링크를 만들었습니다.');
        } catch (err) {
          failed(err, '링크를 만들지 못했습니다. 잠시 후 다시 누르거나 방 그림을 PNG로 내려받아 보내 주세요.');
        }
        w.refreshLink();
      };

      // 링크 지우기: 되돌릴 수 없으므로 무엇이 일어나는지 보여 준 뒤 결과를 말하는 단추로 받는다(known-issues 32).
      const remove = async e => {
        e.currentTarget.disabled = true;
        if (pinnedHere()) { // 이웃집에 고정한 방은 지우지 않는다(data/neighbors.js의 keep). 단추는 보이지 않지만 다른 탭에서 고정되었을 수 있다
          w.refreshLink();
          return;
        }
        try {
          await unshare();
          os.toast('링크를 지웠습니다.');
        } catch (err) {
          failed(err, '링크를 지우지 못했습니다. 잠시 후 다시 눌러 주세요.');
        }
        w.refreshLink();
      };
      const askRemove = () => {
        cloudTip.replaceChildren(myHandle() ? '서버에서 방과 쪽지, 아이디를 지웁니다. ' : '서버에서 방과 쪽지를 지웁니다. ', nw('이 링크는 더는 열리지 않습니다.'));
        cloudRow.replaceChildren(button('지우기', remove), button('그대로 두기', () => w.refreshLink()));
      };

      // 아이디(src/cloud.js의 "아이디"). 링크가 있을 때만 보인다. 정하기 전에는 닉네임에서 쓸 수 있는 글자를 칸에 미리 넣어 두어,
      // 대부분은 이름 그대로 아이디가 된다. 정한 뒤에는 칸을 읽기 전용으로 두고 지우기 단추를 둔다.
      // 칸의 꼴과 이미 쓰는 아이디는 칸 바로 아래에 알리고, 서버에 닿지 못한 것은 링크 만들기처럼 알림으로 띄운다.
      const handleTip = h('p', { className: 'share-save-tip' });
      const handleInput = h('input', { type: 'text', maxLength: 24, placeholder: '한글, 영문, 숫자 2~12자', 'aria-label': '내 아이디', autocomplete: 'off' });
      handleInput.spellcheck = false; // h()는 false 값을 건너뛰므로 따로 끈다(known-issues 50)
      const handleError = h('p', { className: 'like-error share-error', role: 'alert', hidden: true });
      const handleFail = text => {
        handleError.textContent = text;
        handleError.hidden = false;
        handleInput.focus();
      };
      handleInput.addEventListener('input', () => { handleError.hidden = true; });
      const claim = async e => {
        e.preventDefault();
        const b = handleRow.querySelector('button[type="submit"]');
        if (handleInput.readOnly || !b || b.disabled) return;
        const handle = normalHandle(handleInput.value);
        if (!handle) return handleFail('아이디를 입력해 주세요.');
        if (!HANDLE_RE.test(handle)) return handleFail('아이디는 한글, 영문, 숫자 2~12자입니다. 다시 입력해 주세요.');
        b.style.minWidth = `${b.offsetWidth}px`;
        b.disabled = true;
        b.textContent = '정하는 중';
        try {
          await claimHandle(handle);
          os.toast('아이디를 정했습니다.');
        } catch (err) {
          if (err.reason === 'taken') {
            w.refreshLink();
            return handleFail('이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.');
          }
          failed(err, '아이디를 정하지 못했습니다. 잠시 후 다시 눌러 주세요.');
        }
        w.refreshLink();
      };
      const handleRow = h('form', { className: 'share-row', onsubmit: claim });
      // 아이디 지우기도 링크 지우기처럼 되돌리기 어려운 일이라 한 번 더 묻는다. 지운 아이디는 다른 사람이 가져갈 수 있다(known-issues 32)
      const drop = async e => {
        e.currentTarget.disabled = true;
        try {
          await dropHandle();
          os.toast('아이디를 지웠습니다.');
        } catch (err) {
          failed(err, '아이디를 지우지 못했습니다. 잠시 후 다시 눌러 주세요.');
        }
        w.refreshLink();
      };
      const askDrop = () => {
        handleTip.replaceChildren('지운 아이디는 다른 사람이 정할 수 있습니다.');
        handleRow.replaceChildren(button('지우기', drop), button('그대로 두기', () => w.refreshLink()));
      };
      const handleSlot = h('div', {});
      let shownHandle = null; // 아이디 칸을 마지막으로 그린 때의 아이디(정하기 전이면 ''). 정하기 전 그대로면 사용자가 친 글자를 남긴다
      const refreshHandle = id => {
        if (!id) {
          shownHandle = null;
          handleSlot.replaceChildren();
          return;
        }
        const handle = myHandle() || '';
        handleInput.readOnly = !!handle;
        if (handle) {
          handleTip.replaceChildren('친구는 방의 현관문을 두 번 눌러 ', nw('이 아이디로 찾아옵니다.'));
          handleInput.value = handle;
          handleRow.replaceChildren(handleInput, button('아이디 지우기', askDrop));
        } else {
          handleTip.replaceChildren('아이디를 정하면 링크 없이도 친구가 ', nw('찾아올 수 있습니다.'));
          if (shownHandle !== '') handleInput.value = handleFrom(home().owner);
          handleRow.replaceChildren(handleInput, h('button', { type: 'submit', className: 'btn' }, '아이디 정하기'));
        }
        if (shownHandle !== handle) handleError.hidden = true;
        shownHandle = handle;
        handleSlot.replaceChildren(handleTip, handleRow, handleError);
      };

      // 링크 줄과 안내를 지금 상태로 맞춘다. 창을 다시 부를 때, 링크를 만들거나 지운 뒤, 복사할 때 부른다(다른 탭에서 만들거나 지웠을 수 있다).
      w.refreshLink = () => {
        const id = sharedId();
        input.value = id ? link(id) : '';
        linkSlot.replaceChildren(...(id ? [linkRow] : []));
        if (os.realHome) intro.replaceChildren('연습 방은 공유되지 않습니다. 링크와 그림에는 저장된 내 방이 담깁니다.');
        else intro.replaceChildren('링크를 받은 친구는 내 컴퓨터에 손님으로 들어와 방을 ', nw('구경할 수 있습니다.'), ' 방을 고치면 같은 링크에서 고친 방이 보입니다.');
        if (id && pinnedHere()) {
          // 이웃집에 고정한 방은 링크를 지울 수 없다. 지우면 그 이웃집이 복사본으로 멈추고 이 방도 사라진다(src/neighbors.js의 pinnedHere)
          cloudTip.replaceChildren('링크의 방은 이웃집에 고정되어 있어 지울 수 없습니다.');
          cloudRow.replaceChildren();
        } else if (id) {
          cloudTip.replaceChildren('링크의 방은 Firebase(구글) 서버에 저장되어 있습니다.');
          cloudRow.replaceChildren(button('링크 지우기', askRemove));
        } else {
          cloudTip.replaceChildren('링크를 만들면 방이 Firebase(구글) 서버에 저장됩니다.');
          cloudRow.replaceChildren(button('링크 만들기', create));
        }
        refreshHandle(id);
      };

      // 공간마다 그림이 한 장씩이다. 그림은 누르는 순간의 방으로 만든다(창을 열어 둔 사이에 방을 고쳐도 최신이다).
      // 아바타도 누르는 순간 선 자리에 넣는다. 다른 공간에 나가 있으면 그 공간에 들어갈 때 서는 문 앞에 세운다(os.avatarSpot).
      // PNG를 만드는 데 1초쯤 걸리므로(2560×1440) 그동안 단추에 만드는 중이라고 보여 준다.
      const saveButton = scene => {
        const file = `agarago-${scene.id}.png`;
        const label = `${scene.name} 그림 PNG로 내려받기`;
        const b = button(label, null, `${file}로 저장됩니다(${IMAGE_W}×${IMAGE_H}px)`);
        b.addEventListener('click', async () => {
          b.style.minWidth = `${b.offsetWidth}px`; // 글자가 바뀌어도 옆 단추가 밀리지 않게
          b.disabled = true;
          b.textContent = '그림을 만드는 중';
          try {
            const canvas = await renderRoomImage(home().scenes[scene.id], scene, os.avatarSpot(scene), home().decor);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('PNG 파일을 만들지 못했다(canvas.toBlob이 빈 값을 돌려줌)');
            saveFile(blob, file);
            os.toast(`${scene.name} 그림을 ${file}로 내려받았습니다.`);
          } catch (err) {
            console.error(err);
            os.toast('그림 파일을 만들지 못했습니다. 페이지를 새로고침한 뒤 다시 눌러 주세요.', 7000);
          } finally {
            b.textContent = label;
            b.style.minWidth = '';
            b.disabled = false;
          }
        });
        return b;
      };

      // 링크를 설명한 바로 아래에 링크 줄과 만들기(지우기) 단추, 아이디를 두고, 인사말과 그림 내려받기는 그 아래에 둔다
      body.append(
        intro,
        linkSlot,
        cloudTip,
        cloudRow,
        handleSlot,
        h('p', { className: 'share-save-tip' }, '바탕화면을 2분 동안 그냥 두면 화면 보호기에 인사말이 흘러갑니다. 링크를 받은 친구의 화면에도 나옵니다.'),
        h('div', { className: 'share-row' }, greet, button('미리 보기', () => os.saver.show(true))),
        h('p', { className: 'share-save-tip' }, '그림 한 장으로 보내려면 PNG 파일로 내려받으세요.'),
        h('div', { className: 'share-row share-save' }, ...SCENES.map(saveButton)),
      );
    },
  });
  win.refreshLink();
  // 링크가 있으면 창을 열 때 서버의 방을 지금 방으로 맞춘다(고친 지 3초가 지나기 전에 열었을 수 있다).
  syncNow(code).catch(err => {
    console.warn(err);
    if (err.reason !== 'lost') os.toast('고친 방을 서버에 올리지 못했습니다. 잠시 후 창을 다시 열어 주세요.', 7000);
    win.refreshLink();
  });
  return win;
}
