// 이 브라우저에 저장된 사용자의 것을 풀고 지운다(F36). 서버에서 받은 방(decodeHome으로 푼 집)을 이 브라우저의 집으로 삼는 길은 둘이다.
// 다른 브라우저에서 고친 내 방으로 바꿀 때(src/home-sync.js)와 로그인할 때(src/sign-in.js)다. 둘 다 여기의 함수를 쓴다.
// 집 상태에는 사진, 기록, 펫을 두지 않는다. 사진은 STORAGE_PICTURE, 기록은 '<앱 id>.best', 펫은 설정에 따로 저장한다.
// 지우는 일(wipeUser)은 이 컴퓨터 초기화, 이 컴퓨터에서 빼기, 다른 사용자를 지우고 로그인하기가 같이 쓴다.
import { STORAGE_ROOM, STORAGE_SETTINGS, STORAGE_SEAT, STORAGE_PICTURE } from './config.js';
import { APPS } from '../data/apps.js';
import { saveOwnPicture } from './user-pictures.js';
import { myRecords } from './records.js';
import { settings } from './settings.js';
import { saveJSON } from './util.js';

// 받은 방을 내 집으로 저장하고 그 집을 돌려준다. 방에 사진이 있으면 사진도 바꾼다
export function unpackHome({ picture, records: _records, pet: _pet, ...home }) {
  saveJSON(STORAGE_ROOM, home);
  if (picture) saveOwnPicture(picture);
  return home;
}

// 받은 기록이 이 브라우저의 기록보다 큰 게임만 바꾼다
export function keepBest(records) {
  const mine = myRecords() || {};
  for (const [id, v] of Object.entries(records || {})) {
    if (v > (mine[id] || 0)) saveJSON(`${id}.best`, v);
  }
}

// 펫 설정을 받은 펫({ id, pats })으로 바꾼다. 없으면(null) 고르지 않은 기본으로 돌린다
export const usePet = pet => settings.set({ pet: pet?.id ?? '', petPats: pet?.pats ?? 0 });

// 배포 주소에 따라 다른 사이트와 저장소를 같이 쓸 수 있으므로 우리 키만 고른다(known-issues 17).
// 우리 키: 'agarago.'로 시작하는 것과, apps/ 안 앱이 자기 id로 시작하게 만든 것('tidy-up.best')
const OWN_APPS = APPS.filter(a => a.src?.startsWith('apps/')).map(a => `${a.id}.`);
const ownKey = key => key.startsWith('agarago.') || OWN_APPS.some(p => key.startsWith(p));
// 이 컴퓨터의 설정(밤, 소리, 배경음악, 펫)과 앉은 사용자가 바뀌었다는 표시(src/seat.js)는 남긴다
const KEEP = [STORAGE_SETTINGS, STORAGE_SEAT];

// 저장된 사용자의 것(집, 사진, 게임 기록, 올린 방의 번호와 계정, 튜토리얼, 놀러 간 집, 시험지)을 모두 지운다
export function wipeUser() {
  try {
    for (const key of Object.keys(localStorage)) if (ownKey(key) && !KEEP.includes(key)) localStorage.removeItem(key);
  } catch { /* 저장소를 못 쓰는 환경 */ }
}

// 사진을 저장하지 않은 것으로 되돌린다. 그러면 닉네임으로 정한 사진이 나온다(src/user-pictures.js의 ownPicture)
export function dropPicture() {
  try { localStorage.removeItem(STORAGE_PICTURE); } catch { /* 저장소를 못 쓰는 환경 */ }
}
