// 앱(iframe) 쪽 SDK(apps/aga-sdk.js)와 주고받는 메시지. 메시지 종류마다 함수가 하나 있다.
// 앱이 { aga: 1, type, ... }를 보내면 HANDLERS[type](창, 메시지)를 부르고, 돌려준 값이 있으면 답으로 보낸다.
// SDK에 새 기능을 더하려면 여기 HANDLERS에 하나, aga-sdk.js에 하나를 더한다.
import { RECORD_APPS } from './records.js';
import { NOTE } from './cloud.js';

export function createSdkHost(os) {
  // 화면 안 커서(src/cursors.js가 body에 넣은 --cur-*)를 앱에도 나눠 준다.
  const cursorSet = () => {
    const cs = getComputedStyle(document.body);
    const set = {};
    for (const k of ['arrow', 'hand', 'grab', 'grabbing', 'wait']) set[k] = cs.getPropertyValue(`--cur-${k}`).trim();
    return set;
  };

  // 친구 집에서 연 미니게임에 알려 줄 것(F34). ownerBest: 그 집 주인의 이 게임 최고 기록(없으면 0),
  // canNote: 그 집 코르크 보드에 쪽지를 남길 수 있는지. 앱 id는 SDK가 자기 폴더 이름으로 보낸다
  const rival = app => {
    const visiting = os.mode === 'visit';
    const best = visiting && RECORD_APPS.includes(app) ? os.home.records?.[app] : 0;
    return { ownerBest: Number.isInteger(best) ? best : 0, canNote: visiting && os.canNote() };
  };

  const HANDLERS = {
    close: win => win.close(),
    title: (win, d) => win.setTitle(String(d.title).slice(0, 40)),
    hello: (win, d) => ({ type: 'info', info: { owner: os.home?.owner || '', visitor: os.mode === 'visit', ...rival(d.app) } }),
    cursor: () => ({ type: 'cursor', cursor: cursorSet() }),
    // 앱이 기록을 남겼다(AGA.save). 겨룰 수 있는 게임의 최고 기록이면 서버의 방도 따라 고친다(src/os.js의 recordChanged)
    saved: (win, d) => { if (d.name === 'best' && RECORD_APPS.includes(d.app)) os.recordChanged(); },
    // 친구 집에서 주인 기록을 넘은 손님이 결과 화면의 쪽지 단추를 눌렀다(AGA.leaveNote). 게임을 닫고 그 집 코르크 보드를 연다.
    // 게임기 화면 안의 게임은 게임기 첫 화면으로 돌아간 뒤 코르크 보드가 게임기를 내려놓게 한다(가까이 보기는 하나만 연다)
    note: (win, d) => {
      if (!os.canNote()) return;
      const text = [...String(d.text ?? '')].slice(0, NOTE.text).join('').trim();
      win.close();
      os.openNoteDraft(text);
    },
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
  // 최소화한 창의 iframe에는 visibilitychange가 오지 않아서 OS가 알려야 한다(known-issues 75). 탭이 뒤로 가는 것은 SDK가 스스로 안다.
  // OS가 직접 그리는 기본 앱(iframe이 없는 창)은 알 필요가 없다
  const tellVisible = (win, visible) => {
    win.iframe?.contentWindow?.postMessage({ aga: 1, type: 'visible', visible }, '*');
  };

  return { broadcast, tellVisible };
}
