// 이 컴퓨터의 설정(밤, 소리, 배경음악 ...)을 한곳에 둔다. 값이 바뀌면 구독한 쪽에 알린다.
//   settings.get('night')                  값 읽기
//   settings.set({ night: true })          바꾸고 저장한 뒤 구독자에게 알린다
//   settings.subscribe((patch, all) => {}) 바뀔 때마다 부른다. 그만 들을 때 부를 함수를 돌려준다
//   settings.hold({ night: false })        저장된 값을 두고 잠시 다른 값으로 쓴다. settings.release()로 돌아온다
//   settings.rereadUser()                  사용자의 것인 설정(펫)을 저장소에서 다시 읽는다. 다른 탭에서 로그인해 펫이 바뀌었을 수 있다
// 새 설정은 DEFAULTS에 기본값을 한 줄 더하면 된다. "이 컴퓨터 초기화"를 눌러도 이 설정은 남는다.
import { STORAGE_SETTINGS } from './config.js';
import { moved } from './seat.js';
import { loadJSON, saveJSON } from './util.js';

// sound: 효과음과 배경음악을 틀지, musicOn: 그 가운데 배경음악을 틀지, music: 바탕화면 내 방의 배경음악(src/sound.js의 ROOM_MUSIC id)
// labsOpen: 실험실을 열었는지, labs: 실험실에서 켠 항목의 id 목록(src/labs.js)
// pet: 펫 창(src/apps/pet-app.js)에서 고른 내 방의 펫('<종류>/<색>', data/pets.js). 비었으면 아직 고르지 않아 기본 펫이 나오고,
//      'none'(src/pet.js의 NO_PET)이면 펫을 두지 않는다. 병아리가 다 자라면 닭('chicken/<색>')으로 바뀐다
// petPats: 지금 펫을 쓰다듬은 횟수(src/pet.js의 patted). 펫 창이 보이고, 병아리는 이 값이 열 번이 되면 닭이 된다(횟수는 이어서 센다).
//      펫 창에서 다른 종류나 "없음"을 고르면 0으로 돌아간다. 2026-11-18까지는 병아리만 세고 닭이 되면 0으로 돌렸다
// tvHint: TV가 다음에 보일 소문의 차례(src/secrets.js의 HINTS, src/apps/tv-app.js). 소문을 보일 때마다 하나씩 는다
const DEFAULTS = { night: false, sound: true, musicOn: true, music: 'kpop', labsOpen: false, labs: [], pet: '', petPats: 0, tvHint: 0 };
// 이 컴퓨터가 아니라 사용자의 것인 설정. 방 글자에 담겨 로그인을 따라다니고(src/pet-link.js), 이 컴퓨터에서 빼면 기본으로 돌아간다(F36)
const USER_KEYS = ['pet', 'petPats'];
// 2026-11-10에 뺀 설정(그레인, 볼록, 시대, 마우스 앱의 커서). 예전에 저장된 값은 읽을 때 버린다.
const DROPPED = ['grain', 'curve', 'era', 'cursor'];
const state = { ...DEFAULTS, ...loadJSON(STORAGE_SETTINGS) };
for (const key of DROPPED) delete state[key];
const listeners = new Set();
let held = null; // 잠시 다른 값으로 쓰는 설정. 저장하지 않으므로 새로 고침을 하면 저장된 값으로 돌아온다
const isHeld = key => !!held && key in held;
const notify = patch => { for (const f of listeners) f(patch, { ...state, ...held }); };
// 저장소에 있는 사용자의 설정 가운데 메모리와 다른 것. 저장된 설정이 없으면(저장소를 못 쓰는 환경) 메모리의 것을 그대로 쓴다
function savedUser() {
  const saved = loadJSON(STORAGE_SETTINGS);
  if (!saved) return {};
  const all = { ...DEFAULTS, ...saved };
  return Object.fromEntries(USER_KEYS.filter(k => all[k] !== state[k]).map(k => [k, all[k]]));
}

export const settings = {
  get: key => (isHeld(key) ? held[key] : state[key]),
  set(patch) {
    for (const key in patch) (isHeld(key) ? held : state)[key] = patch[key];
    if (moved()) Object.assign(state, savedUser()); // 다른 탭에서 사용자가 바뀌었다. 이 탭이 들고 있던 앞 사용자의 펫으로 덮지 않는다(src/seat.js)
    saveJSON(STORAGE_SETTINGS, state);
    notify(patch);
  },
  rereadUser() {
    const patch = savedUser();
    if (!Object.keys(patch).length) return;
    Object.assign(state, patch);
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
