// 가구를 가까이 보는 화면(게임기, 라디오, TV, 책장). 바탕화면을 어둡게 덮고 가운데에 가구를 크게 보여 준다.
// 바깥(어두운 곳)을 누르거나 아래의 닫기 단추, Esc를 누르면 닫는다. 한 번에 하나만 연다.
// 닫기 단추와 안내는 가구에 맞는 말로 쓴다. 손에 드는 게임기는 "내려놓기"(요구 사항의 "게임기 바깥을 누르면 게임기를 내려놓습니다"),
// TV는 "TV 끄기", 라디오와 책장은 "닫기"다(라디오는 닫아도 음악 창이 남으므로 "끄기"라고 쓰지 않는다).
// 창 층(z-index 20)보다 아래에 깔아서 라디오의 음악 창처럼 옆에 띄우는 OS 창은 그 위에 뜬다.
// 열려 있는 동안 아바타는 키를 받지 않는다(os.js의 active). 바탕화면을 떠나거나 공간을 옮기면 os.js가 닫는다.
//
//   const cu = openCloseup(os, { key, title, className, closeLabel, closeTip, build(panel, cu) { ...; return 닫을 때 부를 함수 } })
//   cu.onKey = e => {}   창이 앞에 없을 때 받은 키(Esc는 닫기로 먼저 쓴다)
//   cu.frames            게임기처럼 안에 앱(iframe)을 띄우면 [{ iframe, close, setTitle }]. 앱 SDK가 이걸 창처럼 쓴다(src/sdk-host.js)
import { h, reduceMotion, isField } from './util.js';

export function openCloseup(os, { key, title, className = '', closeLabel = '닫기', closeTip = '바깥을 누르면 닫힙니다.', build }) {
  os.closeup?.close();
  const panel = h('div', { className: `closeup-panel ${className}`.trim() });
  const el = h('div', { className: reduceMotion ? 'closeup still' : 'closeup', role: 'dialog', 'aria-label': title, dataset: { key } },
    panel,
    h('div', { className: 'closeup-foot' },
      h('span', {}, closeTip),
      h('button', { type: 'button', className: 'btn', onclick: () => cu.close() }, closeLabel)));
  const cu = { key, el, panel, frames: [], onKey: null, close };
  let cleanup = null;

  function close() {
    if (os.closeup !== cu) return;
    os.closeup = null;
    window.removeEventListener('keydown', onKey);
    try { cleanup?.(); } finally { el.remove(); }
  }
  function onKey(e) {
    if (os.wm.focusedWin() || e.ctrlKey || e.metaKey || e.altKey) return; // 앞에 창이 있으면 그 창의 키다
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isField(e.target)) e.target.blur(); // 쓰던 칸에서 Esc를 누르면 칸만 빠져나온다
      else close();
      return;
    }
    if (!isField(e.target)) cu.onKey?.(e);
  }

  // 바깥(어두운 바탕)만 닫는다. 패널 안이나 아래 줄을 누른 것은 그대로 둔다
  el.addEventListener('click', e => { if (e.target === el) close(); });
  window.addEventListener('keydown', onKey);
  os.wm.blur(); // 창을 앞에 두지 않아야 키가 이 화면으로 온다
  // 떠 있던 알림은 걷는다. 알림은 화면 아래 가운데에 떠서 이 화면의 아래쪽 단추 줄을 가린다. 손님으로 들어온 직후의
  // "가구를 두 번 눌러 사용해 보세요"(6초)가 바로 그 가구 화면을 가렸다. 이 화면 안에서 띄우는 알림(지우지 못했습니다 등)은 그 뒤에 뜬다
  os.hideToast();
  os.closeup = cu;
  os.stage.querySelector('#desktop').append(el);
  cleanup = build(panel, cu);
  return cu;
}
