// 팀원 앱(apps/ 폴더의 웹 페이지)을 창 안의 iframe으로 띄운다. data/apps.js에서 src가 있는 앱은 모두 이걸로 열린다.
// 앱은 apps/aga-sdk.js로 창을 닫거나 제목을 바꿀 수 있다(주고받는 메시지는 src/sdk-host.js).
import { h } from '../util.js';
import { holdMusic } from '../sound.js';

// iframe이 앱 폴더 밖으로 나갔는지. 앱 안에서 페이지를 옮기는 것은 괜찮다(같은 폴더 아래면 앱으로 본다).
// 다른 사이트의 앱은 안을 볼 수 없으므로 판단하지 않는다.
function leftApp(frame, src) {
  const home = new URL(src, location.href);
  const folder = home.pathname.replace(/[^/]*$/, '');
  let now;
  try { now = frame.contentWindow.location; now.href; } catch {
    // 같은 사이트 앱인데 안을 볼 수 없으면 data:, blob: 같은 다른 문서로 바뀐 것이다.
    return home.origin === location.origin;
  }
  return now.origin !== home.origin || !now.pathname.startsWith(folder);
}

export function openFrameApp(os, app) {
  const [w, hgt] = app.size || [800, 560];
  return os.wm.open({
    key: app.id,
    app,
    title: app.title,
    width: w,
    height: hgt,
    flush: true,
    build(body, win) {
      body.classList.add('frame-app');
      const frame = h('iframe', { title: app.title, allow: 'autoplay; fullscreen; gamepad; clipboard-write' });
      // 앱 화면이 엉뚱한 페이지로 넘어가면(흰 화면 제보, 2026-10-28) 다시 열기 안내를 띄운다.
      const reopen = () => {
        lost.hidden = true;
        frame.style.visibility = '';
        frame.src = app.src;
      };
      const lost = h('div', { className: 'frame-lost', hidden: true },
        h('p', {}, '앱 화면이 다른 페이지로 넘어갔습니다.'),
        h('p', { className: 'meta' }, '다시 열기를 누르면 처음 화면부터 다시 불러옵니다.'),
        h('button', { className: 'btn', type: 'button', onclick: reopen }, '다시 열기'));
      frame.addEventListener('load', () => {
        if (leftApp(frame, app.src)) {
          lost.hidden = false;
          frame.style.visibility = 'hidden';
        }
      });
      frame.src = app.src;
      win.iframe = frame;
      body.append(frame, lost);
      // data/apps.js의 music: 창이 열려 있는 동안 그 게임의 배경음악을 틀거나('own'이면 게임 안 음악과 겹치지 않게) 사이트 음악을 멈춘다
      const releaseMusic = app.music ? holdMusic(`app:${app.id}`, app.music) : null;
      return () => releaseMusic?.();
    },
  });
}
