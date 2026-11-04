// 이 컴퓨터의 설정(그레인, 볼록, 밤, 시대, 커서 ...)을 한곳에 둔다. 값이 바뀌면 구독한 쪽에 알린다.
//   settings.get('night')                  값 읽기
//   settings.set({ night: true })          바꾸고 저장한 뒤 구독자에게 알린다
//   settings.subscribe((patch, all) => {}) 바뀔 때마다 부른다. 그만 들을 때 부를 함수를 돌려준다
//   settings.hold({ night: false })        저장된 값을 두고 잠시 다른 값으로 쓴다. settings.release()로 돌아온다
// 새 설정은 DEFAULTS에 기본값을 한 줄 더하면 된다. "이 컴퓨터 초기화"를 눌러도 이 설정은 남는다.
import { STORAGE_SETTINGS } from './config.js';
import { loadJSON, saveJSON } from './util.js';

// cursor: 마우스 앱에서 고른 커서 색, 크기, 직접 그린 그림(자세한 모양은 src/cursors.js 맨 위)
const DEFAULTS = { grain: true, curve: true, night: false, era: '1998', cursor: { line: null, fill: null, size: 1, custom: {} } };
const state = { ...DEFAULTS, ...loadJSON(STORAGE_SETTINGS) };
const listeners = new Set();
let held = null; // 잠시 다른 값으로 쓰는 설정. 저장하지 않으므로 새로 고침을 하면 저장된 값으로 돌아온다
const isHeld = key => !!held && key in held;
const notify = patch => { for (const f of listeners) f(patch, { ...state, ...held }); };

export const settings = {
  get: key => (isHeld(key) ? held[key] : state[key]),
  set(patch) {
    for (const key in patch) (isHeld(key) ? held : state)[key] = patch[key];
    saveJSON(STORAGE_SETTINGS, state);
    notify(patch);
  },
  // 튜토리얼 연습 방의 밤낮처럼 저장된 값을 건드리지 않고 써 보는 값. 그동안 같은 키의 set도 저장되지 않는다.
  hold(patch) {
    held = { ...patch };
    notify(patch);
  },
  release() {
    const patch = held;
    held = null;
    if (patch) notify(patch);
  },
  subscribe(f) {
    listeners.add(f);
    return () => listeners.delete(f);
  },
};
