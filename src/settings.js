// 이 컴퓨터의 설정(그레인, 볼록, 밤, 시대, 커서 ...)을 한곳에 둔다. 값이 바뀌면 구독한 쪽에 알린다.
//   settings.get('night')                  값 읽기
//   settings.set({ night: true })          바꾸고 저장한 뒤 구독자에게 알린다
//   settings.subscribe((patch, all) => {}) 바뀔 때마다 부른다. 그만 들을 때 부를 함수를 돌려준다
// 새 설정은 DEFAULTS에 기본값을 한 줄 더하면 된다. "이 컴퓨터 초기화"를 눌러도 이 설정은 남는다.
import { STORAGE_SETTINGS } from './config.js';
import { loadJSON, saveJSON } from './util.js';

// cursor: 마우스 앱에서 고른 커서 색, 크기, 직접 그린 그림(자세한 모양은 src/cursors.js 맨 위)
const DEFAULTS = { grain: true, curve: true, night: false, era: '1998', cursor: { line: null, fill: null, size: 1, custom: {} } };
const state = { ...DEFAULTS, ...loadJSON(STORAGE_SETTINGS) };
const listeners = new Set();

export const settings = {
  get: key => state[key],
  set(patch) {
    Object.assign(state, patch);
    saveJSON(STORAGE_SETTINGS, state);
    for (const f of listeners) f(patch, state);
  },
  subscribe(f) {
    listeners.add(f);
    return () => listeners.delete(f);
  },
};
