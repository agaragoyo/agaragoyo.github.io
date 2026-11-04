// 기본 앱: 공유하기. 지금 집 모습을 담은 링크를 복사하거나, 방 그림을 PNG 파일로 내려받는다.
// 내려받기는 누르기 전에 결과를 알 수 있게 단추 이름이 "무엇을 PNG로 내려받기"인 것으로 둔다(known-issues 32).
import { SCENES } from '../config.js';
import { encodeHome } from '../share.js';
import { renderRoomImage, IMAGE_W, IMAGE_H } from '../room-image.js';
import { h } from '../util.js';

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
  const linkNow = () => `${location.origin}${location.pathname}#room=${encodeHome(os.home)}`;
  const win = os.wm.open({
    key: app.id,
    app,
    title: '공유하기',
    width: 540,
    height: 244,
    build(body, w) {
      const input = h('input', { type: 'text', readOnly: true, value: linkNow(), 'aria-label': '공유 링크' });
      // 창을 열어 둔 사이에 방을 고칠 수 있으므로 링크는 창을 다시 부를 때와 복사할 때마다 새로 만든다.
      w.refreshLink = () => { input.value = linkNow(); };
      const copy = async () => {
        w.refreshLink();
        let ok = true;
        try {
          await navigator.clipboard.writeText(input.value);
        } catch {
          input.focus();
          input.select();
          ok = document.execCommand('copy');
        }
        if (ok) os.toast('링크를 복사했습니다.');
        else os.toast('복사하지 못했습니다. 링크가 선택되어 있으니 Ctrl+C(맥은 Cmd+C)로 복사해 주세요.', 7000);
      };

      // 공간마다 그림이 한 장씩이다. 그림은 누르는 순간의 방으로 만든다(창을 열어 둔 사이에 방을 고쳐도 최신이다).
      // PNG를 만드는 데 1초쯤 걸리므로(2560×1440) 그동안 단추에 만드는 중이라고 보여 준다.
      const saveButton = scene => {
        const file = `agarago-${scene.id}.png`;
        const label = `${scene.name} 그림 PNG로 내려받기`;
        const button = h('button', { type: 'button', className: 'btn', title: `${file}로 저장됩니다(${IMAGE_W}×${IMAGE_H}px)` }, label);
        button.addEventListener('click', async () => {
          button.style.minWidth = `${button.offsetWidth}px`; // 글자가 바뀌어도 옆 단추가 밀리지 않게
          button.disabled = true;
          button.textContent = '그림을 만드는 중';
          try {
            const canvas = await renderRoomImage(os.home.scenes[scene.id], scene);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('PNG 파일을 만들지 못했다(canvas.toBlob이 빈 값을 돌려줌)');
            saveFile(blob, file);
            os.toast(`${scene.name} 그림을 ${file}로 내려받았습니다.`);
          } catch (err) {
            console.error(err);
            os.toast('그림 파일을 만들지 못했습니다. 한 번 더 눌러 보시고, 계속 안 되면 페이지를 새로 고친 뒤 다시 해 주세요.', 7000);
          } finally {
            button.textContent = label;
            button.style.minWidth = '';
            button.disabled = false;
          }
        });
        return button;
      };

      body.append(
        h('p', {}, '이 링크를 받은 친구는 내 컴퓨터에 손님으로 들어와 지금 모습 그대로 방을 구경할 수 있습니다. ',
          '방을 고친 뒤에는 링크를 다시 복사해서 보내 주세요.'),
        h('div', { className: 'share-row' }, input, h('button', { type: 'button', className: 'btn', onclick: copy }, '복사')),
        h('p', { className: 'share-save-tip' }, '그림 한 장으로 보내려면 PNG 파일로 내려받으세요.'),
        h('div', { className: 'share-row share-save' }, ...SCENES.map(saveButton)),
      );
    },
  });
  win.refreshLink();
  return win;
}
