// 친구 집에서 그 집 주인의 미니게임 기록과 겨루기(F34).
// 주인이 내 컴퓨터에서 낸 최고 기록을 공유 링크와 서버의 방에 붙여 보내고, 손님이 그 집에서 같은 게임을 열면
// 게임이 시작 카드, 넘는 순간의 알림, 결과 화면에서 그 기록을 보여 준다(src/sdk-host.js의 hello, apps/aga-sdk.js의 AGA.info().ownerBest).
// 기록은 게임이 AGA.save('best', 점수)로 남긴 '<앱 id>.best'를 그대로 읽는다. 집과 따로 두고 링크에 담을 때 withRecords로 붙이므로
// (주인 사진의 withPicture와 같다) 집 상태의 records는 링크로 연 친구 집에만 있다.
// 겨룰 수 있는 게임은 점수가 클수록 좋은 우리 미니게임(apps/)뿐이다. 다른 사이트의 게임은 점수를 읽을 수 없다.
// 파일 정리 10의 best는 보통 모드(100초)의 기록이다. 시간 제한 없음 모드의 다 정리 횟수는 할수록 쌓이는 수라 겨루지 않는다.
// 이 파일은 다른 파일을 불러오지 않는다. src/share.js가 이 파일을 부르므로, 브라우저에서만 도는 파일(util.js의 matchMedia)을 부르면
// Node로 도는 링크 점검(tools/link-fuzz.mjs)이 멈추고, 사진이나 이름 파일을 부르면 불러오기가 돌고 돈다(user-name.js가 share.js를 부른다).

// 공유 링크의 짧은 형식은 이 순서대로 기록을 담는다(src/share.js의 recordBytes). 순서를 바꾸면 이미 보낸 링크의 기록이
// 다른 게임의 기록으로 열리므로 새 게임은 끝에만 더한다.
export const RECORD_APPS = ['tidy-up', 'file-ten'];
export const MAX_RECORD = 65535; // 링크에 기록 하나를 2바이트로 담는다. 넘는 기록은 이 값으로 줄인다

// 집 상태의 records 검사. 겨룰 수 있는 게임의 1 이상 정수만 남기고, 하나도 없으면 null이라 집 상태에 records를 두지 않는다.
export function sanitizeRecords(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const id of RECORD_APPS) {
    const v = raw[id];
    if (Number.isInteger(v) && v > 0) out[id] = Math.min(v, MAX_RECORD);
  }
  return Object.keys(out).length ? out : null;
}

// 이 컴퓨터에서 낸 최고 기록. 이 컴퓨터 초기화가 게임 기록과 함께 지운다(src/login.js).
// 저장소를 못 쓰는 환경(사생활 보호 모드)에서는 기록이 없는 것으로 본다
const stored = key => {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
};
export const myRecords = () => sanitizeRecords(Object.fromEntries(RECORD_APPS.map(id => [id, stored(`${id}.best`)])));

// 링크와 서버의 방에 담을 집에 내 기록을 붙인다. 친구 집을 복사해 만든 집에 기록이 남아 있어도 내 기록으로 바꾼다
export const withRecords = home => ({ ...home, records: myRecords() });
