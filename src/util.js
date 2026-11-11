// 여러 파일이 같이 쓰는 작은 도구.
import { DOUBLE_CLICK_MS } from './config.js';

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 글을 치는 칸인지. 화면 전체에서 키를 받는 쪽(아바타, 가구 가까이 보기)은 이런 칸에서 친 키를 가로채지 않는다.
export const isField = el => el instanceof HTMLElement && (el.matches('input, textarea, select') || el.isContentEditable);

// 두 번 누르기 판정기. 같은 것(what)을 DOUBLE_CLICK_MS 안에 다시 누르면 true를 돌려준다.
// 바탕화면 아이콘, 바탕화면의 가구와 문, 창 제목 줄이 같이 쓴다. 한 번 누르기와 헷갈리지 않게 브라우저의 dblclick 대신 클릭 간격을 직접 잰다.
//   const twice = doubleClick();
//   onclick: () => { if (twice(app.id)) open(app.id); }
export function doubleClick() {
  let last = null;
  let at = -Infinity;
  return what => {
    const now = performance.now();
    if (what === last && now - at < DOUBLE_CLICK_MS) {
      at = -Infinity;
      return true;
    }
    last = what;
    at = now;
    return false;
  };
}

// 낱말 끝 글자에 받침이 있는지(조사 고르기: 옷장이네, 소파네). 한글이 아니면 없는 것으로 본다.
export function batchim(word) {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return c >= 0 && c < 11172 && c % 28 !== 0;
}

// localStorage 읽고 쓰기. 사생활 보호 모드처럼 저장소를 못 쓰는 환경에서도 오류 없이 넘어간다.
export function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
export function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장소를 못 쓰는 환경 */ }
}

// 요소 하나 만들기.
//   h('button', { className: 'btn', type: 'button', onclick: f, 'aria-label': '닫기' }, '글자', 다른 요소)
// on으로 시작하는 함수는 이벤트로 붙이고, dataset과 style은 객체를 풀어 넣고,
// 요소에 같은 이름의 속성이 있으면(className, type, hidden, value ...) 그 속성에, 없으면 HTML 속성으로 넣는다.
// null, undefined, false인 값과 자식은 건너뛴다.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset' || k === 'style') Object.assign(el[k], v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.flat().filter(c => c != null && c !== false));
  return el;
}
