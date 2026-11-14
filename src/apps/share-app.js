// 기본 앱: 공유하기. 지금 집 모습을 담은 링크를 복사하거나, 방 그림을 PNG 파일로 내려받는다.
// 링크는 두 가지다. 긴 링크(#r=)는 방을 주소에 통째로 담고, 짧은 링크(#s=번호)는 방을 서버(Firebase, src/cloud.js)에 두고 번호만 담는다.
// 짧은 링크는 주인이 "짧은 링크 만들기"를 누를 때 처음 만든다(방이 서버에 저장된다는 것을 누르기 전에 보여 준다).
// 그 뒤에는 방을 고칠 때마다 서버의 방도 따라 고치므로(os.saveHome) 같은 링크가 늘 지금 방을 보여 준다.
// 내려받기는 누르기 전에 결과를 알 수 있게 단추 이름이 "무엇을 PNG로 내려받기"인 것으로 둔다(known-issues 32).
import { SCENES } from '../config.js';
import { encodeHome } from '../share.js';
import { withPicture } from '../user-pictures.js';
import { sharedId, share, unshare, syncNow } from '../cloud.js';
import { line } from '../likes.js';
import { renderRoomImage, IMAGE_W, IMAGE_H } from '../room-image.js';
import { h } from '../util.js';

const MESSENGER_LIMIT = 500; // 카카오톡은 메시지를 500자까지 보여 주고 나머지를 접는다(known-issues 57)

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

export function openShareApp(os, app) {
  const home = () => os.realHome || os.home; // 튜토리얼 연습 방은 공유하지 않는다
  const code = () => encodeHome(withPicture(home())); // 링크에 담는 글자. 내 사진도 담는다(F25)
  const base = () => `${location.origin}${location.pathname}`;
  const longLink = () => `${base()}#r=${code()}`; // 예전 링크는 #room=(src/share.js의 linkCode)
  const shortLink = id => `${base()}#s=${id}`;
  const button = (label, onclick, title) => h('button', { type: 'button', className: 'btn', onclick, title }, label);
  const win = os.wm.open({
    key: app.id,
    app,
    title: '공유하기',
    width: 540,
    height: 440,
    build(body, w) {
      const intro = h('p', {});
      const input = h('input', { type: 'text', readOnly: true, 'aria-label': '공유 링크' });
      // 화면 보호기 인사말(src/screensaver.js). 링크에 같이 담겨 친구 화면의 화면 보호기에도 흘러간다. 연습 방에서는 고치지 않는다.
      const greet = h('input', {
        type: 'text', maxLength: 30, value: home().greeting || '', placeholder: `${home().owner}의 컴퓨터`,
        'aria-label': '화면 보호기 인사말', disabled: !!os.realHome,
      });
      greet.addEventListener('input', () => {
        os.home.greeting = line(greet.value, 30);
        os.saveHome(false);
        w.refreshLink();
      });
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

      // 짧은 링크 만들기: 방을 서버에 올리고 링크 칸을 짧은 링크로 바꾼다. 처음에는 익명 로그인까지 해서 1초쯤 걸린다.
      const create = async e => {
        const b = e.currentTarget;
        b.style.minWidth = `${b.offsetWidth}px`;
        b.disabled = true;
        b.textContent = '링크를 만드는 중';
        try {
          await share(code());
          os.toast('짧은 링크를 만들었습니다.');
        } catch (err) {
          console.warn(err);
          os.toast('짧은 링크를 만들지 못했습니다. 잠시 후 다시 눌러 주세요.', 7000);
        }
        w.refreshLink();
      };

      // 짧은 링크 지우기: 되돌릴 수 없으므로 무엇이 일어나는지 보여 준 뒤 결과를 말하는 단추로 받는다(known-issues 32).
      const remove = async e => {
        e.currentTarget.disabled = true;
        try {
          await unshare();
          os.toast('짧은 링크를 지웠습니다.');
        } catch (err) {
          console.warn(err);
          os.toast('짧은 링크를 지우지 못했습니다. 잠시 후 다시 눌러 주세요.', 7000);
        }
        w.refreshLink();
      };
      const askRemove = () => {
        cloudTip.replaceChildren('서버에서 방과 쪽지를 지웁니다. ', nw('보낸 짧은 링크는 더는 열리지 않습니다.'));
        cloudRow.replaceChildren(button('지우기', remove), button('그대로 두기', () => w.refreshLink()));
      };

      // 창을 열어 둔 사이에 방을 고칠 수 있으므로 링크는 창을 다시 부를 때와 복사할 때마다 새로 만든다.
      w.refreshLink = () => {
        const id = sharedId();
        const long = longLink();
        input.value = id ? shortLink(id) : long;
        if (os.realHome) intro.replaceChildren('연습 방은 공유되지 않습니다. 링크와 그림에는 저장된 내 방이 담깁니다.');
        else if (id) intro.replaceChildren('이 링크를 받은 친구는 내 컴퓨터에 손님으로 들어와 방을 ', nw('구경할 수 있습니다.'), ' 방을 고치면 같은 링크에서 고친 방이 보입니다.');
        else intro.replaceChildren('이 링크를 받은 친구는 내 컴퓨터에 손님으로 들어와 ', nw('지금 모습 그대로'), ' 방을 ', nw('구경할 수 있습니다.'), ' 방을 고친 뒤에는 링크를 다시 복사해서 보내 주세요.');
        if (id) {
          cloudTip.replaceChildren('짧은 링크의 방은 Firebase(구글) 서버에 저장되어 있습니다. ', nw('짧은 링크가'), ' 열리지 않으면 긴 링크를 보내 주세요.');
          cloudRow.replaceChildren(
            button('긴 링크 복사', () => copy(longLink(), '긴 링크를 복사했습니다.'), `${long.length.toLocaleString('ko-KR')}자`),
            button('짧은 링크 지우기', askRemove),
          );
        } else {
          const cut = long.length > MESSENGER_LIMIT ? `이 링크는 ${long.length.toLocaleString('ko-KR')}자라 카카오톡에서 잘립니다. ` : '';
          cloudTip.replaceChildren(`${cut}짧은 링크를 만들면 방이 Firebase(구글) 서버에 저장됩니다.`);
          cloudRow.replaceChildren(button('짧은 링크 만들기', create));
        }
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
            const canvas = await renderRoomImage(home().scenes[scene.id], scene, home().owner, os.avatarSpot(scene), home().decor);
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

      body.append(
        intro,
        h('p', { className: 'share-save-tip' }, '바탕화면을 2분 동안 그냥 두면 화면 보호기에 인사말이 흘러갑니다. 링크를 받은 친구의 화면에도 나옵니다.'),
        h('div', { className: 'share-row' }, greet, button('미리 보기', () => os.saver.show(true))),
        h('div', { className: 'share-row' }, input, button('복사', () => {
          w.refreshLink();
          copy(input.value, '링크를 복사했습니다.');
        })),
        cloudTip,
        cloudRow,
        h('p', { className: 'share-save-tip' }, '그림 한 장으로 보내려면 PNG 파일로 내려받으세요.'),
        h('div', { className: 'share-row share-save' }, ...SCENES.map(saveButton)),
      );
    },
  });
  win.refreshLink();
  // 짧은 링크가 있으면 창을 열 때 서버의 방을 지금 방으로 맞춘다(고친 지 3초가 지나기 전에 열었을 수 있다).
  syncNow(code).catch(err => {
    console.warn(err);
    os.toast('고친 방을 서버에 올리지 못했습니다. 잠시 후 창을 다시 열어 주세요.', 7000);
    win.refreshLink();
  });
  return win;
}
