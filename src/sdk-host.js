// 앱(iframe) 쪽 SDK(apps/aga-sdk.js)와 주고받는 메시지. 메시지 종류마다 함수가 하나 있다.
// 앱이 { aga: 1, type, ... }를 보내면 HANDLERS[type](창, 메시지)를 부르고, 돌려준 값이 있으면 답으로 보낸다.
// SDK에 새 기능을 더하려면 여기 HANDLERS에 하나, aga-sdk.js에 하나를 더한다.
import { labOn } from './labs.js';

export function createSdkHost(os) {
  // 화면 안 커서(src/cursors.js가 body에 넣은 --cur-*)를 앱에도 나눠 준다.
  const cursorSet = () => {
    const cs = getComputedStyle(document.body);
    const set = {};
    for (const k of ['arrow', 'hand', 'grab', 'grabbing', 'wait']) set[k] = cs.getPropertyValue(`--cur-${k}`).trim();
    return set;
  };

  const HANDLERS = {
    close: win => win.close(),
    title: (win, d) => win.setTitle(String(d.title).slice(0, 40)),
    hello: () => ({ type: 'info', info: { owner: os.home?.owner || '', visitor: os.mode === 'visit' } }),
    cursor: () => ({ type: 'cursor', cursor: cursorSet() }),
  };

  window.addEventListener('message', e => {
    const d = e.data;
    if (!d || d.aga !== 1 || !Object.hasOwn(HANDLERS, d.type)) return;
    // 게임기 화면(src/closeup.js의 frames) 안에서 돌리는 앱도 창처럼 받는다. 닫기는 게임기 첫 화면으로 돌아가기다
    const win = [...os.wm.all(), ...(os.closeup?.frames || [])].find(w => w.iframe?.contentWindow === e.source);
    if (!win) return; // 우리 창이나 게임기에 뜬 앱이 보낸 메시지만 받는다
    const reply = HANDLERS[d.type](win, d);
    if (reply) e.source.postMessage({ aga: 1, ...reply }, '*');
  });

  // 열려 있는 모든 앱에 보낸다.
  const broadcast = msg => {
    for (const w of os.wm.all()) w.iframe?.contentWindow?.postMessage({ aga: 1, ...msg }, '*');
  };

  // 창을 최소화하면 그 창의 앱에 가려졌다고, 다시 띄우면 보인다고 알린다(src/win.js가 부른다, 앱 쪽은 AGA.onHide와 AGA.onShow).
  // 가려졌다는 알림은 실험실의 "최소화하면 게임 멈추기"(pause-hidden)를 켠 동안만 보낸다. 가려졌다고 알린 창에는
  // 그 사이 스위치를 꺼도 다시 띄울 때 보인다고 알린다. 그러지 않으면 게임이 멈춘 채로 남는다
  const hidden = new WeakSet(); // 가려졌다고 알린 창
  const tellVisible = (win, visible) => {
    if (!win.iframe) return; // OS가 직접 그리는 기본 앱은 알 필요가 없다
    if (visible) {
      if (!hidden.delete(win)) return;
    } else {
      if (!labOn('pause-hidden')) return;
      hidden.add(win);
    }
    win.iframe.contentWindow?.postMessage({ aga: 1, type: 'visible', visible }, '*');
  };

  return { broadcast, tellVisible };
}
