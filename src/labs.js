// 실험실. 팀이 아직 정하지 않은 아이디어를 이 브라우저에서만 켜 보는 숨은 곳이다(docs/requirements.md의 F24, 시험).
// 내 컴퓨터의 바탕화면에서 말풍선에 PASSWORD를 말하면 바탕화면에 실험실 아이콘이 생기고(src/os.js),
// 그 창(src/apps/labs-app.js)에서 항목을 켜고 끈다. 열림과 켠 항목은 설정(src/settings.js의 labsOpen, labs)에 남아,
// 새로 고침해도 그대로이고 친구 집을 구경할 때도 적용된다. "실험실 닫기"는 모든 항목을 끄고 아이콘을 다시 숨긴다.
//
// 항목을 더하는 법
//   1. 아래 LABS에 한 줄을 더한다(id는 영어 소문자와 하이픈).
//   2. 기능 쪽에서 labOn('<id>')으로 켜졌는지 묻는다.
//   3. docs/requirements.md의 "아직 정하지 않은 것"에 `<id>`가 든 한 줄을 쓴다(tools/check.py의 check_labs가 본다).
//   팀이 정하면 labOn 없이 기본으로 켜거나 코드와 함께 지운다.
// 실험실 항목은 화면과 동작만 바꾼다. 집 저장 형식(sanitizeHome), 공유 링크(src/share.js), 서버 규칙(firestore.rules)을 바꾸는
// 아이디어는 스위치 뒤에 두지 않는다. 한번 보낸 링크와 서버에 올린 방은 스위치를 꺼도 되돌릴 수 없다(자동 점검이 그 파일들에서 labOn을 막는다).
import { settings } from './settings.js';

// 말풍선에 이 말을 하면 실험실이 열린다(앞뒤 공백은 뺀다)
export const PASSWORD = '실험실 열려라';

// title: 창에 나오는 이름, desc: 켜면 무엇이 달라지는지 한 줄(창이 좁으면 \n을 넣어 뜻이 끊기는 자리에서 줄을 바꾼다)
export const LABS = [
  { id: 'fast-saver', title: '화면 보호기 빨리 보기', desc: '바탕화면을 2분 대신 20초 동안 그냥 두면\n화면 보호기가 나옵니다.' },
];

export const labsOpen = () => !!settings.get('labsOpen');
export const labOn = id => labsOpen() && (settings.get('labs') || []).includes(id);

export function setLab(id, on) {
  const rest = (settings.get('labs') || []).filter(x => x !== id && LABS.some(l => l.id === x));
  settings.set({ labs: on ? [...rest, id] : rest });
}

export const openLabs = () => settings.set({ labsOpen: true });
export const closeLabs = () => settings.set({ labsOpen: false, labs: [] });
