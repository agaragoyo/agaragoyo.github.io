// 앱(iframe) 쪽 SDK(apps/aga-sdk.js)와 주고받는 메시지. 메시지 종류마다 함수가 하나 있다.
// 앱이 { aga: 1, type, ... }를 보내면 HANDLERS[type](창, 메시지)를 부르고, 돌려준 값이 있으면 답으로 보낸다.
// SDK에 새 기능을 더하려면 여기 HANDLERS에 하나, aga-sdk.js에 하나를 더한다.
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
    const win = os.wm.all().find(w => w.iframe?.contentWindow === e.source);
    if (!win) return; // 우리 창에 뜬 앱이 보낸 메시지만 받는다
    const reply = HANDLERS[d.type](win, d);
    if (reply) e.source.postMessage({ aga: 1, ...reply }, '*');
  });

  // 열려 있는 모든 앱에 보낸다.
  const broadcast = msg => {
    for (const w of os.wm.all()) w.iframe?.contentWindow?.postMessage({ aga: 1, ...msg }, '*');
  };

  return { broadcast };
}
