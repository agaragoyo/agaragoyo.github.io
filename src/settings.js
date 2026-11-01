// 이 컴퓨터의 설정(그레인, 볼록, 밤, 시대 ...)을 한곳에 둔다. 값이 바뀌면 구독한 쪽에 알린다.
//   settings.get('night')                  값 읽기
//   settings.set({ night: true })          바꾸고 저장한 뒤 구독자에게 알린다
//   settings.subscribe((patch, all) => {}) 바뀔 때마다 부른다. 그만 들을 때 부를 함수를 돌려준다
// 새 설정은 DEFAULTS에 기본값을 한 줄 더하면 된다. "이 컴퓨터 초기화"를 눌러도 이 설정은 남는다.
import { STORAGE_SETTINGS } from './config.js';
import { loadJSON, saveJSON } from './util.js';

const DEFAULTS = { grain: true, curve: true, night: false, era: '1998' };
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
