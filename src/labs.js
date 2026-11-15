// 실험실. 팀이 아직 정하지 않은 아이디어를 이 브라우저에서만 켜 보는 숨은 곳이다(docs/requirements.md의 F24, 시험).
// 내 컴퓨터의 바탕화면에서 말풍선에 암호(src/secrets.js의 SECRETS)를 말하면 바탕화면에 실험실 아이콘이 생기고,
// 그 창(src/apps/labs-app.js)에서 항목을 켜고 끈다. 열림과 켠 항목은 설정(src/settings.js의 labsOpen, labs)에 남아,
// 새로 고침해도 그대로이고 친구 집을 구경할 때도 적용된다. "실험실 닫기"는 모든 항목을 끄고 아이콘을 다시 숨긴다.
//
// 항목을 더하는 법
//   1. 아래 LABS에 한 줄을 더한다(id는 영어 소문자와 하이픈).
//   2. 기능 쪽에서 labOn('<id>')으로 켜졌는지 묻는다.
//   3. docs/requirements.md의 "아직 정하지 않은 것"에 `<id>`가 든 한 줄을 쓴다(tools/check.py의 check_labs가 본다).
//   팀이 정하면 labOn 없이 기본으로 켜거나 코드와 함께 지운다.
// 실험실에는 켜 봐야 좋은지 아는 것(사람마다 반응이 갈리거나 팀이 두 방식 가운데 고를 것)만 넣는다. 끄는 쪽을 고를 사람이 없는 고침은
// 스위치 없이 바로 기본으로 넣는다(known-issues 76).
// 실험실 항목은 화면과 동작만 바꾼다. 집 저장 형식(sanitizeHome), 공유 링크(src/share.js), 서버 규칙(firestore.rules)을 바꾸는
// 아이디어는 스위치 뒤에 두지 않는다. 한번 보낸 링크와 서버에 올린 방은 스위치를 꺼도 되돌릴 수 없다(자동 점검이 그 파일들에서 labOn을 막는다).
import { settings } from './settings.js';
import { reduceMotion } from './util.js';

// title: 창에 나오는 이름, desc: 켜면 무엇이 달라지는지 한 줄(창이 좁으면 \n을 넣어 뜻이 끊기는 자리에서 줄을 바꾼다)
export const LABS = [
  { id: 'fast-saver', title: '화면 보호기 빨리 보기', desc: '바탕화면을 2분 대신 20초 동안 그냥 두면\n화면 보호기가 나옵니다.' },
  { id: 'host-avatar', title: '주인 아바타 남기기', desc: '친구 집에 가면 주인 아바타가 방에 서 있고,\n내 아바타는 빨간 옷을 입습니다.' },
  { id: 'like-sparkle', title: '담긴 가구 반짝임', desc: '주인이 무언가 담아 둔 가구 위에\n작은 반짝임이 뜹니다.' },
  { id: 'pet', title: '펫 데려오기', desc: '내 방에 고양이 한 마리가 돌아다니고,\n두 번 누르면 쓰다듬을 수 있습니다.' },
  { id: 'home-bgm', title: '친구 집 배경음악', desc: '친구 집에 가면 라디오의 첫 유튜브 CD가\n배경음악으로 자동 재생되어 소리가 납니다.' },
  // 움직임 줄이기를 켠 사람에게는 눈이 내리지 않으므로(src/snow.js) 켜도 달라지는 것이 없는 까닭을 설명에 적는다
  { id: 'snow', title: '놀이터에 눈', desc: reduceMotion ? '움직임 줄이기를 켠 컴퓨터에서는\n놀이터에 눈이 내리지 않습니다.' : '놀이터에 나가면 날짜와 상관없이\n눈이 계속 내립니다.' },
  // 움직임 줄이기를 켠 사람에게는 아바타가 혼자 걷지 않고 바로 옆 가구에만 말한다(src/idle-talk.js)
  { id: 'idle-talk', title: '심심할 때 혼잣말', desc: reduceMotion ? '바탕화면을 30초 동안 그냥 두면\n아바타가 바로 옆 가구에 혼잣말을 합니다.' : '바탕화면을 30초 동안 그냥 두면\n아바타가 가구로 가서 혼잣말을 합니다.' },
];

export const labsOpen = () => !!settings.get('labsOpen');
export const labOn = id => labsOpen() && (settings.get('labs') || []).includes(id);

export function setLab(id, on) {
  const rest = (settings.get('labs') || []).filter(x => x !== id && LABS.some(l => l.id === x));
  settings.set({ labs: on ? [...rest, id] : rest });
}

export const openLabs = () => settings.set({ labsOpen: true });
export const closeLabs = () => settings.set({ labsOpen: false, labs: [] });
